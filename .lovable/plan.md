

# Fix: Program Assignment Not Displaying After Creation

## Root Cause

The last edit introduced `hasExplicitEditingState` (line 257) which sets `usedLiveEditingState = true` whenever the editing hook has ANY state for a date (even empty/cleared). This correctly prevents cleared days from falling back to stale cache. However, it has a critical side effect:

Line 320-321:
```typescript
if (!usedLiveEditingState) {
  // Find assignments that overlap with this date
  const dayAssignments = assignments.filter(...)
```

When `usedLiveEditingState = true`, the ENTIRE cached path is skipped -- including rendering of OTHER assignments that overlap the same date. So when a new program is assigned, its data is saved to cache but never rendered because the selected (old) assignment's editing state blocks the cached path.

Additionally, `handleAssignProgram` never calls `setSelectedAssignmentId(newAssignment.id)`, so the new assignment is never auto-selected (the auto-select effect only fires when no assignment is selected).

## Fix (single file)

### File: `src/components/athletes/AthleteCalendarView.tsx`

**Change 1**: Modify the cached path (line 320) to always run for NON-selected assignments, even when `usedLiveEditingState` is true. Replace the simple `if (!usedLiveEditingState)` guard with logic that:
- Skips the selected assignment (already handled by live editing path above)
- Still processes all other assignments from cache

```typescript
// Always check cached assignments for NON-selected assignments
// The live editing path above only handles the selectedAssignmentId
{
  const dayAssignments = assignments.filter(assignment => {
    // Skip the selected assignment - already handled by live editing state above
    if (assignment.id === selectedAssignmentId && usedLiveEditingState) return false;
    const assignmentStart = new Date(assignment.startDate);
    const assignmentEnd = new Date(assignment.endDate);
    return isWithinInterval(date, { start: assignmentStart, end: assignmentEnd });
  });
  // ... rest of cached rendering unchanged
}
```

**Change 2**: In `handleAssignProgram` (after line 774), auto-select the newly created assignment so its editing state loads immediately:

```typescript
setSelectedAssignmentId(newAssignment.id);
```

## Expected Outcome
- Newly assigned programs immediately appear on the calendar
- Multiple overlapping assignments all render correctly
- Cleared days still respect the live editing state (no stale cache regression)
