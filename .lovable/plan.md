

# Restore Baseline & Goal Fields for Scheduled Tests

## What happened
The overlay styling fix overwrote the scheduled tests section in `CombinedTestEventDialog.tsx`, reverting it back to only showing a Comments field. The Baseline and Goal inputs need to be re-added.

## Changes

### File: `src/components/microcycle-planning/CombinedTestEventDialog.tsx`

**1. Add `onUpdateTestValues` prop to the interface (around line 59)**

Add after `onUpdateComment`:
```
onUpdateTestValues?: (testId: string, updates: { preTestValue?: number; goalValue?: number; comments?: string }) => void;
```

Destructure it in the component function (around line 84).

**2. Expand the scheduled test CollapsibleContent (lines 258-276)**

Replace the current Comments-only section with:
- **Unit display**: Resolve unit from `allParameters` via `testData.parameterLinkedId`, show in brackets after the test name (line 240).
- **Baseline Value input**: Pre-filled from athlete performance data (lookup `athletePerformanceParameters` by `parameterLinkedId`) or from `testData.preTestValue`. Calls `onUpdateTestValues` on change.
- **Goal Value input**: Pre-filled from `testData.goalValue`. Calls `onUpdateTestValues` on change.
- **Comments textarea**: Updated to use `onUpdateTestValues` instead of `onUpdateComment` for tests.

**3. No additional prop threading needed**

The `onUpdateTestValues` callback was already added and threaded through all parent components (`MicrocyclePlanningPage`, `TrainingCalendarView`, `TrainingDayCell`, `MasterPlannerColumn`, `WorkoutSessionSheet`) in the earlier round. We just need to add the prop to the interface and use it in the scheduled tests UI -- the parent wiring should already be passing it.

If the parent wiring was also lost, we will re-thread `onUpdateTestValues` through the same component chain as before.
