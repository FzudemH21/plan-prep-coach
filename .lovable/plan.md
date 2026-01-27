

## Fix: Timeline Data Not Persisting Between Wizard Steps

### Problem
When navigating between macrocycle planning and mesocycle planning (and going back and forth), the timeline dates are lost. This causes:
1. Wrong dates displayed in the Training Plan Overview
2. Incorrect number of mesocycles being calculated (defaults to 12 weeks instead of actual plan duration)
3. Data inconsistency when moving through the wizard in both directions

### Root Cause

**MacrocyclePage** saves dates in two structures:
1. New `planDuration` object (with `startDate`, `endDate`, `totalDays`, `totalWeeks`)
2. Legacy `smartGoal` object for backward compatibility

However, the legacy `smartGoal` construction has a bug:

```typescript
// MacrocyclePage.tsx:319-325
const legacySmartGoal = smartGoals.length > 0 ? {
  ...smartGoals[0],
  startDate: planDuration?.startDate,  // ← Only populated if smartGoals exists!
  endDate: planDuration?.endDate,
  totalDays: planDuration?.totalDays,
  totalWeeks: planDuration?.totalWeeks,
} : smartGoal;  // ← Falls back to OLD smartGoal state (may be empty!)
```

**MesocyclePage** only reads from the legacy structure:

```typescript
// MesocyclePage.tsx:286-287
const startDate = data.smartGoal?.startDate ? new Date(data.smartGoal.startDate) : new Date();
const endDate = data.smartGoal?.endDate ? new Date(data.smartGoal.endDate) : addWeeks(startDate, 12);
```

When `smartGoals.length === 0` but `planDuration` has dates, the legacy `smartGoal` won't have dates, causing MesocyclePage to fall back to `new Date()` and 12 weeks.

---

### Solution

**Update MesocyclePage** to prioritize `planDuration` (the new structure) over `smartGoal` (the legacy structure), similar to how MicrocyclePlanningPage already does it correctly:

```typescript
// MicrocyclePlanningPage.tsx:2983-2984 (correct pattern)
const startDate = macrocycleData?.planDuration?.startDate || macrocycleData?.smartGoal?.startDate;
const endDate = macrocycleData?.planDuration?.endDate || macrocycleData?.smartGoal?.endDate;
```

---

### Implementation Details

**File 1: `src/pages/MesocyclePage.tsx`**

#### Change 1: Update date loading logic (Lines 285-294)

**Before:**
```typescript
// Calculate total weeks from date range
const startDate = data.smartGoal?.startDate ? new Date(data.smartGoal.startDate) : new Date();
const endDate = data.smartGoal?.endDate ? new Date(data.smartGoal.endDate) : addWeeks(startDate, 12);
const weeks = data.smartGoal?.startDate && data.smartGoal?.endDate ? 
  Math.ceil((Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) / 7) : 12;
```

**After:**
```typescript
// Calculate total weeks from date range - prioritize planDuration over legacy smartGoal
const rawStartDate = data.planDuration?.startDate || data.smartGoal?.startDate;
const rawEndDate = data.planDuration?.endDate || data.smartGoal?.endDate;
const rawTotalWeeks = data.planDuration?.totalWeeks || data.smartGoal?.totalWeeks;

const startDate = rawStartDate ? new Date(rawStartDate) : new Date();
const endDate = rawEndDate ? new Date(rawEndDate) : addWeeks(startDate, 12);
const weeks = rawTotalWeeks || 
  (rawStartDate && rawEndDate 
    ? Math.ceil((Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) / 7) 
    : 12);
```

#### Change 2: Update TrainingPlanOverview render (Lines 659-667)

**Before:**
```typescript
const renderTrainingPlanOverview = () => {
  const primaryGoal = macrocycleData?.smartGoal?.description || ...;
  
  const totalDays = macrocycleData?.smartGoal?.startDate && macrocycleData?.smartGoal?.endDate
    ? Math.ceil((planEndDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24))
    : undefined;
```

**After:**
```typescript
const renderTrainingPlanOverview = () => {
  const primaryGoal = macrocycleData?.smartGoals?.[0]?.description || 
                      macrocycleData?.smartGoal?.description || ...;
  
  // Use planDuration.totalDays if available, otherwise calculate
  const totalDays = macrocycleData?.planDuration?.totalDays || 
    (planStartDate && planEndDate
      ? Math.ceil((planEndDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24))
      : undefined);
```

---

**File 2: `src/pages/MacrocyclePage.tsx`**

#### Change 3: Fix legacy smartGoal construction to always include dates (Lines 318-325)

**Before:**
```typescript
const legacySmartGoal = smartGoals.length > 0 ? {
  ...smartGoals[0],
  startDate: planDuration?.startDate,
  endDate: planDuration?.endDate,
  totalDays: planDuration?.totalDays,
  totalWeeks: planDuration?.totalWeeks,
} : smartGoal;
```

**After:**
```typescript
// Always include planDuration dates in legacy smartGoal for backward compatibility
const legacySmartGoal = {
  ...(smartGoals.length > 0 ? smartGoals[0] : smartGoal),
  startDate: planDuration?.startDate,
  endDate: planDuration?.endDate,
  totalDays: planDuration?.totalDays,
  totalWeeks: planDuration?.totalWeeks,
};
```

This ensures the legacy `smartGoal` ALWAYS has dates from `planDuration`, regardless of whether `smartGoals` array is populated.

---

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/MesocyclePage.tsx` | Prioritize `planDuration` over `smartGoal` when reading dates; update TrainingPlanOverview to use new structure |
| `src/pages/MacrocyclePage.tsx` | Fix legacy `smartGoal` construction to always include dates from `planDuration` |

---

### Testing Checklist

After implementation:
1. **Forward Navigation Test**:
   - Set a timeline in Macrocycle Planning (e.g., Feb 1 - May 1)
   - Navigate to Mesocycle Planning
   - Verify Training Plan Overview shows correct dates
   - Verify correct number of mesocycles are calculated

2. **Backward Navigation Test**:
   - From Mesocycle Planning, click "Back to Macrocycle"
   - Verify dates are still displayed correctly in Macrocycle Planning
   - Navigate forward to Mesocycle Planning again
   - Verify dates are still correct

3. **Full Wizard Round-Trip**:
   - Complete macrocycle → mesocycle → microcycle
   - Navigate back to macrocycle
   - Verify all timeline data is preserved throughout

