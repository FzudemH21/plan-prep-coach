

# Fix Three Athlete Calendar Regressions

## Issue 1: Adding a test to a day deletes the session

**Root cause**: In the `calendarDays` memo in `AthleteCalendarView.tsx` (lines 243-307), when a test is added via `handleAddTestEvent`, a `liveTrainingDay` entry is created with `testNames` but `sessions: 0`. The memo sees `hasTestsOrEvents = true`, sets `hasLiveData = true`, and enters the live editing path. It then sets `usedLiveEditingState = true`, which **blocks** the fallback cached path from rendering sessions that belong to other assignments for that day. Since the live path has no session data (`liveSplitState` is undefined or 0 for this date in the selected assignment), no sessions are rendered.

**Fix in `src/components/athletes/AthleteCalendarView.tsx`** (lines ~257-258):
- Only set `usedLiveEditingState = true` when the live path has actual session or exercise data (not just tests/events).
- Always collect tests/events from live state regardless.
- This allows the cached path to still render sessions from other assignments when the live path only contributed test/event markers.

## Issue 2: "Remove Assignment" button still in day menu

**Root cause**: Lines 340-355 in `AthleteCalendarDayCell.tsx` still render the "Remove assignment" menu item. Per the design decision (continuous workout stream model), this should be removed.

**Fix in `src/components/athletes/AthleteCalendarDayCell.tsx`**: Remove the "Remove assignment" DropdownMenuItem block (lines 340-355).

## Issue 3: Copy Week / Clear Week menu not always visible

**Root cause**: In `AthleteCalendarWeekRow.tsx`, lines 117 and 123 conditionally show "Copy week" and "Clear week" only when `hasExercisesInWeek` is true. Per the design decision, these should always be enabled (weeks may contain only test markers or events).

**Fix in `src/components/athletes/AthleteCalendarWeekRow.tsx`**:
- Line 117: Remove `hasExercisesInWeek &&` condition from "Copy week"
- Line 123: Remove `hasExercisesInWeek &&` condition from "Clear week"

## Files to edit

1. `src/components/athletes/AthleteCalendarView.tsx` -- calendarDays memo fix
2. `src/components/athletes/AthleteCalendarDayCell.tsx` -- remove "Remove assignment" menu item
3. `src/components/athletes/AthleteCalendarWeekRow.tsx` -- always show Copy/Clear week options

