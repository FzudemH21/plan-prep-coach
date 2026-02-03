
# Fix: Ad-Hoc Method Parameter Grid Not Appearing

## Problem Analysis

When adding exercises via the ad-hoc workflow in the Athlete Calendar, the parameter grid doesn't appear for methods that are NOT in the method periodization table. However, if a method IS in the periodization table (like "Lower Body Resistance Training - Strength"), parameters appear correctly.

### Root Cause

The issue is in `handleAdHocMethodSelected` in `WorkoutSessionSheet.tsx`. The function filters `toolboxData.entries` to find method parameters, but the matching logic fails silently in certain cases:

```typescript
const methodEntries = toolboxData?.entries.filter(entry => 
  entry.category === toolboxCategory && 
  (toolboxSubCategory === '' ? entry.subCategory === '' : entry.subCategory === toolboxSubCategory)
) || [];
```

**Two issues identified:**

1. **Empty result on mismatch**: If `methodEntries` returns empty (due to case sensitivity, spacing differences, or data format issues), `buildExerciseParams()` returns `{}`, causing `WorkoutExerciseCard` to show no parameter grid.

2. **No fallback handling**: When `methodEntries` is empty, there's no fallback to create at least a basic set of parameters (like "Sets" with a default of 3).

### Flow Analysis

```text
User selects exercise in ad-hoc session
        ↓
AdHocMethodSelectionDialog shows methods from toolboxData
        ↓
User selects method (e.g., "Sprinting - Acceleration") 
and configures parameter visibility
        ↓
handleAdHocMethodSelected receives:
  - methodId: "Sprinting - Acceleration"
  - categoryName: "Acceleration"
  - parameterVisibility: {...}
  - initialParameters: {...}
        ↓
Filter toolboxData for matching entries ← FAILS HERE (returns [])
        ↓
buildExerciseParams() returns {} (empty)
        ↓
Exercise added with empty parameters
        ↓
WorkoutExerciseCard shows no grid
```

## Solution

Fix the `handleAdHocMethodSelected` function to:

1. Use a more robust matching approach that handles edge cases
2. Add fallback logic when no entries are found  
3. Use the `initialParameters` passed from the dialog (which has correct parameters from `generateInitialParameters`)

### Technical Changes

**File: `src/components/microcycle-planning/WorkoutSessionSheet.tsx`**

Location: `handleAdHocMethodSelected` function (lines 1237-1371)

**Change 1: Use initialParameters from the dialog**

The `AdHocMethodSelectionDialog` already generates correct initial parameters via `generateInitialParameters()`. The `handleAdHocMethodSelected` function receives these as `initialParameters` but currently ignores them and re-generates from scratch. 

We should use `initialParameters` as the base and enhance with per-set expansion:

```typescript
// Instead of building from scratch, use the initialParameters from dialog
// and expand for per-set storage
const buildExerciseParams = (): Record<string, string | number> => {
  const params: Record<string, string | number> = { ...initialParameters };
  
  // Find set count from initialParameters
  const setParamEntry = methodEntries.find(e => e.isSetParameter);
  const setParamName = setParamEntry?.parameterName || 
                      methodEntries.find(e => /^sets?$/i.test(e.parameterName))?.parameterName ||
                      Object.keys(initialParameters).find(k => /^sets?$/i.test(k)) ||
                      'Sets';
  
  const setCount = Number(initialParameters[setParamName] || params[setParamName] || 3);
  
  // Ensure set parameter is present
  if (!params[setParamName]) {
    params[setParamName] = setCount;
  }
  
  // Add units and per-set keys
  methodEntries.forEach(entry => {
    if (entry.isFrequencyParameter) return;
    
    const paramName = entry.parameterName;
    
    // Add unit if quantitative
    if (entry.parameterType === 'quantitative' && entry.options.length > 0) {
      params[`${paramName}_unit`] = entry.options[0];
    }
    
    // Create per-set keys for non-set parameters
    if (!entry.isSetParameter && setCount > 0) {
      for (let i = 1; i <= setCount; i++) {
        if (params[`${paramName}_set${i}`] === undefined) {
          params[`${paramName}_set${i}`] = '';
        }
      }
    }
  });
  
  // FALLBACK: If still no displayable parameters (beyond set param), 
  // create basic structure from initialParameters
  if (methodEntries.length === 0 && Object.keys(initialParameters).length > 0) {
    Object.keys(initialParameters).forEach(paramName => {
      if (/^sets?$/i.test(paramName)) {
        params[paramName] = setCount;
      } else if (setCount > 0) {
        for (let i = 1; i <= setCount; i++) {
          if (params[`${paramName}_set${i}`] === undefined) {
            params[`${paramName}_set${i}`] = '';
          }
        }
      }
    });
  }
  
  return params;
};
```

**Change 2: More robust toolbox entry matching**

Add case-insensitive matching and trim whitespace:

```typescript
const methodEntries = toolboxData?.entries.filter(entry => {
  const categoryMatch = entry.category.toLowerCase().trim() === toolboxCategory.toLowerCase().trim();
  const subCategoryMatch = toolboxSubCategory === '' 
    ? (!entry.subCategory || entry.subCategory.trim() === '')
    : (entry.subCategory?.toLowerCase().trim() === toolboxSubCategory.toLowerCase().trim());
  
  return categoryMatch && subCategoryMatch;
}) || [];
```

**Change 3: Add debug logging**

Add console logging to trace issues during development:

```typescript
console.log('[handleAdHocMethodSelected] Matching:', {
  methodId,
  toolboxCategory,
  toolboxSubCategory,
  foundEntries: methodEntries.length,
  initialParametersKeys: Object.keys(initialParameters)
});
```

## Implementation Summary

| File | Change |
|------|--------|
| `src/components/microcycle-planning/WorkoutSessionSheet.tsx` | Fix `handleAdHocMethodSelected` to use `initialParameters` from dialog and add robust fallback handling |

## Expected Outcome

1. When selecting any method from the ad-hoc dialog (including those not in periodization), the parameter grid will appear with:
   - The set parameter (e.g., "Sets") with default value of 3
   - All configured parameters as empty inputs for user to fill
   - Per-set rows matching the set count

2. Users can add/remove sets and fill in parameter values for ad-hoc exercises

3. The visibility toggles configured in the ad-hoc dialog are respected
