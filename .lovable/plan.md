

# Fix Two Regressions: Tests Dialog + Assignment Step 4

## Issue 1: CombinedTestEventDialog showing "Select Existing / Create New" for tests

The mode toggle and RadioGroup list are still showing for tests because the condition on line 363 is `{hasItems && (` -- it applies to both tests AND events. For tests, we should always show the parameter dropdown (unified flow), and only show the toggle for events.

### Changes in `src/components/microcycle-planning/CombinedTestEventDialog.tsx`:

1. **Line 363**: Change `{hasItems && (` to `{hasItems && type === 'event' && (` so the "Select Existing / Create New" toggle and RadioGroup only appear for events.

2. **Line 431**: Change `{(mode === 'create' || !hasItems) && (` to `{(type === 'test' || mode === 'create' || !hasItems) && (` so the parameter dropdown section always shows for tests.

3. **Line 617-620**: Update the disabled logic for the Add button so that for tests, it only checks `!newName.trim()` (since we always use the dropdown, never the radio selection).

---

## Issue 2: AssignProgramDialog missing "Step 4: Review Tests & Events"

The dialog currently goes from Step 3 (mesocycle selection) straight to Preview. A "Step 4: Review Tests & Events" section needs to be added that:

- Extracts `subGoals` (tests) and `events` from the selected program's `macrocycleData`
- Shifts scheduled dates based on the difference between the original program start date and the new assignment start date
- Auto-fills baseline values from the target athlete's performance data
- Allows editing of baseline, goal, comments, and scheduled dates
- Stores the reviewed/edited test data in the assignment

### Changes in `src/components/athletes/AssignProgramDialog.tsx`:

1. **Add imports**: Import athlete hooks/types for performance parameters, date utilities.

2. **Add props**: `athletePerformanceParameters` (from `useAthletes`) to access the athlete's historical values for baseline auto-fill.

3. **Extract tests/events from program**: Parse `selectedProgram.macrocycleData.subGoals` and `selectedProgram.macrocycleData.events`, shift their scheduled dates by the day offset between original and new start dates.

4. **Add Step 4 UI section** (between Step 3 and Preview): List each test/event with editable Baseline, Goal, Comments fields. Baseline is auto-filled from the athlete's latest performance data when a `parameterLinkedId` match is found.

5. **Include reviewed data in assignment**: Add `reviewedSubGoals` and `reviewedEvents` to the assignment object passed to `onAssign`.

### Changes in `src/components/athletes/AthleteCalendarView.tsx`:

1. Pass `athletePerformanceParameters` to `AssignProgramDialog` so it can auto-fill baselines.

### Changes in `src/types/athlete.ts`:

1. Add `reviewedSubGoals` and `reviewedEvents` fields to `AthleteCalendarAssignment` type (optional, for backward compatibility).

