
## Fix Athlete Calendar: Intensity Display, Exercises Not Loading, and Date Shifting Issues

### Overview

There are four interconnected issues with the Athlete Calendar when programs are assigned:

1. **Intensity Display Wrong**: The day intensity square shows mesocycle intensity instead of actual per-day intensity; session intensity shows microcycle intensity instead of session-specific intensity
2. **Exercises Not Showing**: When opening sessions, exercises are empty because the original program's exercise data is not copied during assignment
3. **Dates Display**: The "Assigned Programs" section should show the actual assigned dates (this is already working correctly)
4. **Start Date Mismatch**: When assigning with a specific start date (e.g., Jan 29), the program should start on that exact date, not an earlier date

---

### Root Cause Analysis

**Issue 1 - Intensity:**
- In `AthleteCalendarView.tsx` (line 215), sessions are created with `meso.intensity` (the mesocycle's overall intensity) instead of looking up the actual per-day intensity from `dailyIntensityData`
- The editing hook's `buildTrainingDaysFromAssignment` (line 89) also defaults to `meso.intensity || micro.intensity || 'moderate'` instead of using the granular day-level intensity data from the original program

**Issue 2 - Exercises:**
- When `initializeFromAssignment` is called, it sets `exerciseDistribution` to an empty array (line 132)
- The program's `exerciseDistribution` stored in the TrainingProgram is never copied to the athlete assignment storage
- When the assignment is created, only mesocycle structure is copied - not the actual workout data (exercises, sections, supersets, parameters)

**Issue 3 - Date Shifting:**
- The `recalculateMesocycleDates` function correctly shifts dates based on the selected start date
- However, when the program is assigned, the original program's `exerciseDistribution` has day dates like `"2025-08-01"` that need to be shifted to match the new assignment dates

---

### Solution

#### Part 1: Copy Program Data During Assignment

When a program is assigned to an athlete, we need to:
1. Copy the program's `exerciseDistribution`, `sessionSections`, `supersets`, `parameterValues`, and `dailyIntensityData`
2. Shift all the `dayDate` fields in the copied data to match the new assignment start date
3. Store this copied data in `localStorage` with the assignment ID

**File: `src/components/athletes/AssignProgramDialog.tsx`**

After creating the assignment, copy the program's workout data with shifted dates:

```tsx
// In handleAssign, after calling onAssign(assignment):
// 1. Load source program's workout data from localStorage
// 2. Shift all dayDate fields based on the day offset between original and new start
// 3. Save to athlete-assignment-{newAssignmentId}
```

**File: `src/components/athletes/AthleteCalendarView.tsx`**

Modify `handleAssignProgram` to:
1. Create the assignment (get back the new assignment ID)
2. Load the original program's data from `trainingPrograms` localStorage
3. Shift the dates and save to `athlete-assignment-{assignmentId}`

#### Part 2: Fix Intensity Display in Calendar

**File: `src/components/athletes/AthleteCalendarView.tsx`**

In the `calendarDays` useMemo, when creating sessions:
- Look up the actual day intensity from the stored assignment data instead of using `meso.intensity`
- Use `dailyIntensityData` from the saved assignment storage

Change line ~215:
```tsx
// Current (wrong):
intensity: meso.intensity || 'moderate',

// Fixed - look up from stored data:
intensity: storedDayIntensity || meso.intensity || 'moderate',
```

**File: `src/hooks/useAthleteCalendarEditing.ts`**

Update `buildTrainingDaysFromAssignment` to use day-level intensity from the stored daily intensity data when available.

#### Part 3: Fix Start Date Synchronization

The date recalculation is already correct in `recalculateMesocycleDates`. The issue is that when exercises are copied, their `dayDate` values need to be shifted using the same offset logic.

**New utility function in `src/utils/dateShifting.ts`:**

```tsx
export function shiftExerciseDates(
  exercises: ExerciseDistribution[],
  originalStartDate: Date,
  newStartDate: Date
): ExerciseDistribution[] {
  const dayOffset = differenceInDays(newStartDate, originalStartDate);
  return exercises.map(ex => ({
    ...ex,
    dayDate: format(addDays(parseISO(ex.dayDate), dayOffset), 'yyyy-MM-dd'),
  }));
}

export function shiftDailyIntensityDates(
  dailyIntensity: DailyIntensity[],
  originalStartDate: Date,
  newStartDate: Date
): DailyIntensity[] {
  const dayOffset = differenceInDays(newStartDate, originalStartDate);
  return dailyIntensity.map(di => ({
    ...di,
    date: format(addDays(parseISO(di.date), dayOffset), 'yyyy-MM-dd'),
  }));
}
```

---

### Implementation Plan

| Step | File | Change |
|------|------|--------|
| 1 | `src/utils/dateShifting.ts` | Add `shiftExerciseDates`, `shiftDailyIntensityDates`, `shiftSessionSections`, and `shiftSupersets` utility functions |
| 2 | `src/components/athletes/AthleteCalendarView.tsx` | Update `handleAssignProgram` to copy and date-shift program data into assignment storage |
| 3 | `src/components/athletes/AthleteCalendarView.tsx` | Fix `calendarDays` to look up actual day intensity from stored data |
| 4 | `src/hooks/useAthleteCalendarEditing.ts` | Update `initializeFromAssignment` to prefer stored data over building from scratch |
| 5 | `src/components/athletes/AthleteCalendarDayCell.tsx` | No changes needed - it already receives intensity via props |

---

### Technical Details

**Date Shifting Logic:**

```text
Original Program Dates:    Aug 1 - Aug 28 (28 days)
Selected Start Date:       Jan 29, 2026
Day Offset:               +181 days

Original exercise on "2025-08-01" → Shifted to "2026-01-29"
Original exercise on "2025-08-02" → Shifted to "2026-01-30"
...and so on
```

**Data Flow After Fix:**

```text
1. User selects program + start date (Jan 29)
2. AssignProgramDialog calls recalculateMesocycleDates (shifts mesocycle dates)
3. handleAssignProgram creates assignment with new ID
4. Copy program's exerciseDistribution from TrainingProgram
5. Shift all dayDate fields using day offset
6. Save shifted data to localStorage key: athlete-assignment-{newId}
7. Calendar view loads this data and displays correct exercises + intensity
```

---

### Summary of Changes

| File | Changes |
|------|---------|
| `src/utils/dateShifting.ts` | Add functions to shift exercise dates, daily intensity dates, session sections, and supersets |
| `src/components/athletes/AthleteCalendarView.tsx` | 1. Update `handleAssignProgram` to copy program workout data with date shifting<br>2. Update `calendarDays` to use stored intensity data |
| `src/hooks/useAthleteCalendarEditing.ts` | Update initialization to properly load stored data and avoid overwriting with empty arrays |
