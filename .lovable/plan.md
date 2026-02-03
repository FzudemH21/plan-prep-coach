

# Fix: Parameter Grid Auto-Fill and Intensity Coupling Issues

## Summary

This plan addresses two bugs in the Athlete Calendar:

1. **Parameter Grid Auto-Fill Bug**: When adding an exercise via the ad-hoc/toolbox workflow, the parameter grid is immediately populated with values from the assigned program's method periodization table. Ad-hoc exercises should start blank.

2. **Intensity Coupling Bug**: Day and session intensities are always coupled (changing one changes the other). Per your preference:
   - **1-session days**: Remain linked (bidirectional sync)
   - **Multi-session days (2+)**: Independent - changing day intensity does NOT affect individual session intensities (and vice versa)

---

## Issue 1: Parameter Grid Auto-Fill Bug

### Root Cause Analysis

The current implementation has these pieces in place:
- `handleAdHocMethodSelected()` correctly sets `parameterSource: 'toolbox'` on exercises
- `buildSectionsFromExercises()` has a check for `parameterSource === 'toolbox'` at line 241
- Exercises are tracked in `freshlyAddedExerciseIdsRef` to skip redundant rebuilds

**However**, the bug occurs because:

1. When `handleAdHocMethodSelected()` adds exercises, it also syncs to `exerciseDistribution` via `onDistributionChange()`
2. This triggers the sync `useEffect` (lines 690-753) which calls `buildSectionsFromExercises(exercises, parameterValues)`
3. **The problem**: The `exercises` prop passed to this function is the `ExerciseDistribution[]` array from the parent - which correctly includes `parameterSource: 'toolbox'`
4. **BUT**: The check at line 241 uses `(ex as any).parameterSource` - this cast works
5. **The actual issue**: In the fallback path (lines 487-651), when exercises are NOT in `sessionSectionsProp`, the fallback branch does NOT have the same `parameterSource: 'toolbox'` check - it always builds parameters from `parameterValues` (the periodization table)

When running in Athlete Calendar:
- `sessionSectionsProp` might be empty initially for ad-hoc sessions
- The code falls through to the fallback grouping logic (line 487: "Fallback: Group exercises by categoryName")
- This fallback path (lines 489-651) does NOT check `parameterSource` at all
- It always fetches `storedParams` from `parameterValues` and populates the grid

### Solution

Add the same `parameterSource: 'toolbox'` check to the fallback branch in `buildSectionsFromExercises()`.

**Location**: `src/components/microcycle-planning/WorkoutSessionSheet.tsx`, inside the fallback `exercisesList.forEach()` loop (around line 489)

Before the periodization lookup, check if this exercise is toolbox-sourced and generate blank parameters:

```typescript
exercisesList.forEach((ex, index) => {
  // ===== TOOLBOX-SOURCED EXERCISES: Generate blank parameters =====
  if ((ex as any).parameterSource === 'toolbox') {
    // Build blank parameters similar to lines 244-308
    // ... (blank parameter generation code)
    return; // Skip periodization lookup
  }
  
  // ... existing periodization lookup logic
});
```

---

## Issue 2: Intensity Coupling Bug

### Root Cause Analysis

The intensity coupling logic in `WorkoutSessionSheet.tsx` (lines 2136-2141 and 2215-2217) uses `isSingleSessionDay` to decide whether to sync:

```typescript
const isSingleSessionDay = useMemo(() => {
  return totalSessionsOnDay === 1;
}, [totalSessionsOnDay]);
```

The prop `totalSessionsOnDay` is correctly passed from `AthleteCalendarView.tsx` (line 931):

```typescript
totalSessionsOnDay={editing.daySplitStates[selectedSessionInfo.dayDate] || 1}
```

**The actual problem is in `useAthleteCalendarEditing.ts`**, lines 1273-1279:

```typescript
const handleSessionIntensityChange = useCallback((dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
  // For single session days, also update day intensity
  const day = trainingDays.find(d => d.date === dayDate);
  if (day?.sessions === 1) {
    handleDayIntensityChange(dayDate, intensity);
  }
}, [trainingDays, handleDayIntensityChange]);
```

This checks `day?.sessions === 1`, but `trainingDays[].sessions` may not be updated consistently with `daySplitStates`. The `daySplitStates` object is the source of truth for session count, but the handler checks `trainingDays[].sessions`.

Additionally, `handleSessionIntensityChange` does NOT actually store per-session intensity - it only syncs to day intensity for single-session days. For multi-session days, the session intensity is never persisted.

### Solution

1. **Fix `handleSessionIntensityChange` to use `daySplitStates` instead of `trainingDays[].sessions`**
2. **Store per-session intensity in the assignment snapshot** (not just day intensity)
3. **Ensure the sheet reads per-session intensity correctly on open**

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/microcycle-planning/WorkoutSessionSheet.tsx` | Add `parameterSource: 'toolbox'` check in the fallback branch of `buildSectionsFromExercises()` |
| `src/hooks/useAthleteCalendarEditing.ts` | Fix `handleSessionIntensityChange` to use `daySplitStates` and persist per-session intensity |

---

## Technical Details

### Change 1: Fix fallback branch in `buildSectionsFromExercises()` (WorkoutSessionSheet.tsx)

**Location**: Lines 489-651 (inside the `exercisesList.forEach()` loop in the fallback branch)

Add at the beginning of the forEach callback (right after line 489):

```typescript
exercisesList.forEach((ex, index) => {
  // ===== TOOLBOX-SOURCED EXERCISES: Generate blank parameters =====
  // If this exercise was added via ad-hoc dialog (parameterSource === 'toolbox'),
  // skip periodization lookup entirely and build blank parameters from toolbox
  if ((ex as any).parameterSource === 'toolbox') {
    const sectionName = ex.categoryName || 'Main Work';
    if (!sectionsMap.has(sectionName)) {
      sectionsMap.set(sectionName, []);
    }

    // Get method parameters from toolbox
    const methodParts = ex.methodId.split(' - ');
    const toolboxCategory = methodParts[0];
    const toolboxSubCategory = methodParts.length > 1 ? methodParts.slice(1).join(' - ') : '';
    
    const methodEntries = toolboxData?.entries.filter(entry => {
      const categoryMatch = entry.category.toLowerCase().trim() === toolboxCategory.toLowerCase().trim();
      const subCategoryMatch = toolboxSubCategory === '' 
        ? (!entry.subCategory || entry.subCategory.trim() === '')
        : (entry.subCategory?.toLowerCase().trim() === toolboxSubCategory.toLowerCase().trim());
      return categoryMatch && subCategoryMatch;
    }) || [];
    
    // Find set parameter
    const setParamEntry = methodEntries.find(e => e.isSetParameter);
    const setParamName = setParamEntry?.parameterName || 
                        methodEntries.find(e => /^sets?$/i.test(e.parameterName))?.parameterName ||
                        'Sets';
    const setCount = 3; // Default blank
    
    // Build BLANK parameters
    const blankParameters: Record<string, string | number> = {};
    blankParameters[setParamName] = setCount;
    
    methodEntries.forEach(entry => {
      if (entry.isFrequencyParameter) return;
      const paramName = entry.parameterName;
      
      // Add unit if quantitative
      if (entry.parameterType === 'quantitative' && entry.options.length > 0) {
        blankParameters[`${paramName}_unit`] = entry.options[0];
      }
      
      // Create per-set keys (all blank)
      if (!entry.isSetParameter && setCount > 0) {
        for (let i = 1; i <= setCount; i++) {
          blankParameters[`${paramName}_set${i}`] = '';
        }
      }
    });
    
    // Detect auto-calc units
    let has1RMUnit = false;
    let hasMaxHRUnit = false;
    for (const entry of methodEntries) {
      if (entry.parameterType === 'quantitative' && entry.options) {
        if (entry.options.includes('%1RM')) has1RMUnit = true;
        if (entry.options.includes('%maxHR') || entry.options.includes('%HRmax')) hasMaxHRUnit = true;
      }
    }
    
    sectionsMap.get(sectionName)!.push({
      id: (ex as any).id || `${ex.exerciseId}-${index}`,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      methodId: ex.methodId,
      categoryName: ex.categoryName || '',
      order: (ex as any).order ?? index,
      supersetId: (ex as any).supersetId,
      parameters: blankParameters,
      notes: ex.notes,
      autoCalculateWeight: has1RMUnit ? true : undefined,
      autoCalculateTargetHR: hasMaxHRUnit ? true : undefined,
      parameterSource: 'toolbox' as const,
    });
    
    return; // Skip periodization lookup
  }
  
  // ... existing periodization lookup logic (unchanged)
});
```

### Change 2: Fix `handleSessionIntensityChange` to use `daySplitStates` (useAthleteCalendarEditing.ts)

**Location**: Lines 1273-1279

Replace:

```typescript
const handleSessionIntensityChange = useCallback((dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
  // For single session days, also update day intensity
  const day = trainingDays.find(d => d.date === dayDate);
  if (day?.sessions === 1) {
    handleDayIntensityChange(dayDate, intensity);
  }
}, [trainingDays, handleDayIntensityChange]);
```

With:

```typescript
const handleSessionIntensityChange = useCallback((dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
  // Check session count from daySplitStates (source of truth), not trainingDays.sessions
  const sessionCount = daySplitStates[dayDate] ?? 1;
  
  // For single session days, sync session intensity to day intensity
  if (sessionCount === 1) {
    handleDayIntensityChange(dayDate, intensity);
  }
  
  // For multi-session days, session intensity is independent (handled by the sheet's local state)
  // The sheet persists session intensity on save; no action needed here for multi-session days
}, [daySplitStates, handleDayIntensityChange]);
```

---

## Expected Outcome

1. **Parameter Grid (Ad-Hoc Exercises)**:
   - Exercises added via the ad-hoc/toolbox flow will always start with a blank parameter grid (Sets = 3, other params empty)
   - Exercises from assigned programs keep their copied values
   - This works regardless of whether the method exists in the assigned program's periodization table

2. **Intensity Coupling**:
   - **1-session days**: Day and session intensity remain linked (bidirectional sync)
   - **2+ session days**: Day and session intensity are independent - changing one does NOT affect the other
   - New sessions default to the day's current intensity (per your preference)

