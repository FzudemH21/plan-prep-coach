
# Synchronize Athlete Calendar Master Planner with Calendar View

## Problem
The Master Planner view in the Athlete Calendar is missing the ability to open sessions (clicking a session does nothing because `onSessionClick` is not passed to `MasterPlannerGrid`). All other editing callbacks (parameter changes, section reorder, exercise add/delete, etc.) are already wired up and synchronized through the shared `editing` hook.

## Root Cause
In `AthleteCalendarView.tsx` (lines 917-966), the `MasterPlannerGrid` component does not receive an `onSessionClick` prop. The `MasterPlannerColumn` calls `onSessionClick?.(dayDate, sessionIndex, exercises)` when a session is clicked, but since the prop is undefined, nothing happens.

## Fix

### File: `src/components/athletes/AthleteCalendarView.tsx`

**Add `onSessionClick` prop to MasterPlannerGrid** (around line 917):

Pass a handler that opens the `WorkoutSessionSheet`, similar to how session clicks work in the calendar view. The handler will:
1. Set the `selectedAssignmentId` to the current assignment
2. Set `selectedSessionInfo` with the correct `dayDate`, `sessionIndex`, and `assignmentId`
3. Open the `sessionSheetOpen` state

The callback signature from `MasterPlannerGrid` is `(dayDate: string, sessionIndex: number, exercises: ExerciseDistribution[])`. We need to adapt this to open the sheet:

```typescript
onSessionClick={(dayDate, sessionIndex) => {
  if (selectedAssignmentId) {
    setSelectedSessionInfo({
      dayDate,
      sessionIndex,
      assignmentId: selectedAssignmentId,
    });
    setSessionSheetOpen(true);
  }
}}
```

This single addition connects the Master Planner to the same `WorkoutSessionSheet` that the Calendar View uses, and since both views share the same `editing` hook state, all changes made in one view are immediately reflected in the other.

## Why This Is Sufficient
- All other callbacks (parameter changes, exercise add/delete/duplicate, section management, superset toggling, intensity changes, copy/paste, test/event management) are **already wired** to the same `editing` hook
- The `WorkoutSessionSheet` already reads from and writes to the `editing` hook state
- Changes made in the sheet automatically reflect in both the Master Planner and Calendar views because they share the same state source
