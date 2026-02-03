
## Status: ✅ IMPLEMENTED

## What was the problem

When adding exercises via the ad-hoc workflow in Athlete Calendar, the parameter grid was still pulling values from the assigned program's method periodization table. This happened because `buildSectionsFromExercises()` always looked up periodization values, overwriting the blank parameters created by `handleAdHocMethodSelected()`.

---

## Solution implemented

### 1) Added `parameterSource` marker to `ExerciseDistribution` type
- File: `src/types/microcycle-planning.ts`
- Added `parameterSource?: 'toolbox' | 'periodization'` to track where exercise parameters should come from

### 2) Updated `handleAdHocMethodSelected()` to mark exercises as toolbox-sourced
- File: `src/components/microcycle-planning/WorkoutSessionSheet.tsx`
- New distribution entries now include `parameterSource: 'toolbox'`

### 3) Updated `buildSectionsFromExercises()` to check parameterSource
- If `parameterSource === 'toolbox'`, skip periodization lookup entirely
- Generate blank parameters from toolbox with default 3 sets
- Exercises without this marker continue to use periodization values

### 4) Updated sync effect to merge instead of overwrite
- When exercises are added, existing exercise parameters are preserved
- This prevents the rebuild from clobbering just-created blank params
- Also fixes: editing first exercise won't be wiped when adding a second

---

## Verification checklist

1) Athlete Calendar → "Add Session" → open session sheet  
2) Add exercise → pick a method that IS in the assigned program periodization table (e.g. LBRT Strength)  
3) Confirm in the grid:
   - Sets shows (default 3)
   - all parameter cells are blank
   - no prefilled "80% / 5 reps / etc" values appear
4) Add a second exercise after editing the first:
   - confirm the first exercise's edited values did not get wiped
5) Try a method NOT in the periodization table:
   - confirm it behaves identically (blank grid)

---

## Files changed

- `src/types/microcycle-planning.ts` - Added `parameterSource` field
- `src/components/microcycle-planning/WorkoutSessionSheet.tsx` - Updated distribution sync, buildSectionsFromExercises, and sync effect
