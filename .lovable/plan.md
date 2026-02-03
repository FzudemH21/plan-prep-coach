

# Fix: Parameter Grid Auto-Fill and Intensity Coupling Issues

## Summary

This plan addresses two distinct bugs in the Athlete Calendar:

1. **Parameter Grid Auto-Fill Bug**: When adding an exercise via the ad-hoc workflow, the parameter grid is immediately populated with values from the assigned program's method periodization table instead of remaining blank.

2. **Intensity Coupling Bug**: Day and session intensity are always coupled - changing one always changes the other. Per your preference, they should ONLY be linked when a day has exactly 1 session; for days with 2+ sessions, changing day intensity should NOT affect session intensities (and vice versa).

---

## Issue 1: Parameter Grid Auto-Fill Bug

### Root Cause

Even though exercises are correctly marked with `parameterSource: 'toolbox'` when added via the ad-hoc dialog, the check in `buildSectionsFromExercises()` uses `(ex as any).parameterSource` without considering that this property might not survive the state update cycle.

Looking at the code flow:

1. `handleAdHocMethodSelected()` creates exercises with `parameterSource: 'toolbox'` and adds them to `workoutSections`
2. It also calls `onDistributionChange()` which updates `exerciseDistribution` in the parent
3. This triggers the sync `useEffect` in `WorkoutSessionSheet` (lines 688-738)
4. The sync effect calls `buildSectionsFromExercises(exercises, parameterValues)`
5. **Problem**: The `exercises` array from the prop is the ExerciseDistribution array, but when it's passed to `buildSectionsFromExercises`, the check `(ex as any).parameterSource === 'toolbox'` may fail because:
   - The merge logic looks up existing exercises by ID
   - The existing exercise was just added to `workoutSections` but not yet committed to the external state
   - The merge lookup doesn't find it (different state timing)
   - Result: it rebuilds using periodization values

The specific timing issue:
- `handleAdHocMethodSelected` adds to local `workoutSections` state
- It also syncs to Step 1 via `onDistributionChange`
- But the sync effect runs again due to `exercises.length` change
- During rebuild, it doesn't find the exercise in `existingExerciseMap` (timing race)

### Solution

Ensure that `parameterSource: 'toolbox'` is correctly carried through all state paths and the merge logic in `buildSectionsFromExercises` preserves blank parameters for toolbox-sourced exercises.

**Changes Required:**

1. **Preserve `parameterSource` on the WorkoutExercise interface** (in `WorkoutSessionSheet.tsx`)
   - The local `WorkoutExercise` interface (line 42-51) should include `parameterSource`
   - This ensures the property survives the merge

2. **Fix the merge logic in sync useEffect** (lines 700-729)
   - When preserving existing exercise state, also preserve `parameterSource`
   - This prevents the race condition from wiping the marker

3. **Ensure `buildSectionsFromExercises` uses the ExerciseDistribution's `parameterSource`**
   - Currently it casts to `any` which is fragile
   - The function should explicitly check both the exercise distribution AND the existing workoutSection exercise

4. **Skip rebuild entirely for just-added exercises**
   - If an exercise was just added (via handleAdHocMethodSelected), don't rebuild its parameters

---

## Issue 2: Intensity Coupling Bug

### Current Behavior (incorrect)

In `WorkoutSessionSheet.tsx`:
- When changing **day intensity** (lines 2100-2110): It always updates session intensity if `isSingleSessionDay`
- When changing **session intensity** (lines 2175-2185): It always updates day intensity if `isSingleSessionDay`

In `useAthleteCalendarEditing.ts`:
- `handleSessionIntensityChange` (lines 1273-1279): Always calls `handleDayIntensityChange` when `day?.sessions === 1`
- `handleDayIntensityChange` (lines 1264-1271): Always updates `trainingDays` and `dailyIntensityData`, but does NOT update individual session intensities for multi-session days

### Expected Behavior (per user preference)

- **1 session day**: Day and session intensity stay linked (bidirectional sync) - this is CORRECT currently
- **2+ session day**: 
  - Changing **day intensity** should NOT change individual session intensities
  - Changing **session intensity** should NOT change day intensity

### Current Bug

The bug is in `useAthleteCalendarEditing.ts`:

`handleSessionIntensityChange` (lines 1273-1279):
```typescript
const handleSessionIntensityChange = useCallback((dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
  // For single session days, also update day intensity
  const day = trainingDays.find(d => d.date === dayDate);
  if (day?.sessions === 1) {  // <-- This is correct
    handleDayIntensityChange(dayDate, intensity);
  }
}, [trainingDays, handleDayIntensityChange]);
```

This looks correct! Let me check `MicrocyclePlanningPage.tsx` which has a different implementation (lines 1216-1254):

```typescript
const handleSessionIntensityChange = (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
  // ...
  // Count total sessions for this day from trainingDays (source of truth)
  const day = trainingDays.find(d => d.date === dayDate);
  const sessionCount = day?.sessions ?? 1;
  const isSingleSession = sessionCount === 1;
  
  // If single session day, bidirectionally sync with day intensity
  if (isSingleSession) {
    setTrainingDays(prev => 
      prev.map(day => {
        if (day.date === dayDate) {
          return { ...day, intensity };
        }
        return day;
      })
    );
    // ...
  }
  // ...
};
```

This also looks correct. The bug must be in `WorkoutSessionSheet.tsx` itself. Let me trace the exact flow.

**Bug Location**: `WorkoutSessionSheet.tsx`, lines 2103-2108 and 2183-2185

In the sheet's popover click handlers:
1. When day intensity changes (line 2102): `onIntensityChange(dayDate, level)`
2. Then (lines 2104-2108): If `isSingleSessionDay`, also updates local `sessionIntensity` AND calls `onSessionIntensityChange`

But the issue is: `isSingleSessionDay` is computed as `totalSessionsOnDay === 1` (line 798-800).

**The bug**: `totalSessionsOnDay` is passed as a prop from `AthleteCalendarView.tsx`. Let me check what it passes...

In `AthleteCalendarView.tsx` (lines 922-989), the `WorkoutSessionSheet` is rendered but I don't see `totalSessionsOnDay` being passed explicitly. Looking at the props, it would default to `1` (line 144 in WorkoutSessionSheet: `totalSessionsOnDay = 1`).

**Root Cause of Intensity Bug**: The Athlete Calendar is NOT passing `totalSessionsOnDay` to `WorkoutSessionSheet`, so it defaults to `1`, making `isSingleSessionDay` always `true`. This causes all intensity changes to be coupled regardless of actual session count.

### Solution

Pass `totalSessionsOnDay` correctly from `AthleteCalendarView.tsx` to `WorkoutSessionSheet`:

```typescript
// In AthleteCalendarView.tsx, when rendering WorkoutSessionSheet:
totalSessionsOnDay={editing.daySplitStates[selectedSessionInfo.dayDate] || 1}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarView.tsx` | Add `totalSessionsOnDay` prop to `WorkoutSessionSheet` |
| `src/components/microcycle-planning/WorkoutSessionSheet.tsx` | 1) Add `parameterSource` to local `WorkoutExercise` interface; 2) Fix merge logic to preserve `parameterSource`; 3) Skip rebuild for freshly-added exercises |

---

## Technical Details

### Change 1: Fix `totalSessionsOnDay` prop (AthleteCalendarView.tsx)

**Location**: Lines 922-989 (WorkoutSessionSheet rendering)

Add this prop:
```tsx
totalSessionsOnDay={editing.daySplitStates[selectedSessionInfo.dayDate] || 1}
```

### Change 2: Add `parameterSource` to WorkoutExercise interface (WorkoutSessionSheet.tsx)

**Location**: Lines 42-51

```tsx
interface WorkoutExercise extends Omit<WorkoutExercise, 'parameters'> {
  // ... existing fields ...
  parameterSource?: 'toolbox' | 'periodization';
}
```

### Change 3: Fix merge logic to preserve `parameterSource` (WorkoutSessionSheet.tsx)

**Location**: Lines 716-725 (inside sync useEffect merge)

When preserving existing exercise, also preserve `parameterSource`:
```tsx
if (existing) {
  return {
    ...newEx,
    parameters: existing.parameters,
    notes: existing.notes,
    eachSide: existing.eachSide,
    autoCalculateWeight: existing.autoCalculateWeight,
    autoCalculateTargetHR: existing.autoCalculateTargetHR,
    parameterSource: existing.parameterSource, // ADD THIS
  };
}
```

### Change 4: Ensure handleAdHocMethodSelected sets parameterSource on WorkoutExercise (WorkoutSessionSheet.tsx)

**Location**: Lines 1467-1478

Ensure the created exercise includes `parameterSource`:
```tsx
return {
  id: `${ex.exerciseId}-${Date.now()}-${index}`,
  // ... other fields ...
  parameters: buildExerciseParams(),
  parameterSource: 'toolbox', // ADD THIS
} as WorkoutExercise;
```

### Change 5: Track freshly added exercises to skip redundant rebuilds (WorkoutSessionSheet.tsx)

Add a ref to track exercise IDs that were just added in the current render cycle, so the sync effect can skip rebuilding their parameters:

```tsx
const freshlyAddedExerciseIdsRef = useRef<Set<string>>(new Set());

// In handleAdHocMethodSelected, after creating exercises:
newExercises.forEach(ex => freshlyAddedExerciseIdsRef.current.add(ex.id));

// In the sync effect merge logic, check:
if (existing || freshlyAddedExerciseIdsRef.current.has(newEx.id)) {
  // preserve existing / skip rebuild
}

// Clear the set after merge completes
freshlyAddedExerciseIdsRef.current.clear();
```

---

## Expected Outcome

1. **Parameter Grid**: Exercises added via the ad-hoc workflow will always start with a blank parameter grid (Sets = 3, other params empty), even if the same method exists in the assigned program's periodization table.

2. **Intensity Coupling**:
   - Days with 1 session: Day and session intensity remain linked (bidirectional sync)
   - Days with 2+ sessions: Day and session intensity are independent - changing one does NOT affect the other

