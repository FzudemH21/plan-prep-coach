

# Fix Day/Session Paste Not Working in Athlete Calendar

## Root Cause Identified

The paste functionality appears to work (toast shows "Session pasted" with exercise count), but the pasted content **doesn't display** on the calendar. This happens because:

### Issue: Date Range Filtering Excludes Pasted Content

The `calendarDays` memo in `AthleteCalendarView.tsx` (lines 203-206) only displays sessions for dates **within** an assignment's date range:

```typescript
const dayAssignments = assignments.filter(assignment => {
  return isWithinInterval(date, { start: assignmentStart, end: assignmentEnd });
});
```

When you paste to a date **outside** the assigned program's range (e.g., a week before or after the program), `dayAssignments` is empty, so:
1. The code never enters the loop to check for live editing state
2. No sessions are displayed, even though exercises were added to `exerciseDistribution`

### The Fix Strategy

For the currently selected assignment, we need to **also** display sessions from the live editing state **regardless of whether the date falls within the assignment's original range**. This allows the calendar to show pasted content on any visible date.

---

## Solution

### Part 1: Display Live Editing Content for Any Date

Modify `AthleteCalendarView.tsx` to check the live editing state **before** the assignment date range filter, so pasted exercises appear on dates outside the original range.

**Current Flow:**
1. Filter assignments by date range → if none match, show nothing
2. For matching assignments, check if it's the editing assignment and use live state

**New Flow:**
1. **First**: Check if the selected assignment is being edited AND has exercises for this date
2. If yes, show live editing data (ignoring date range)
3. If no, proceed with the existing assignment range filter logic

### Part 2: Extend Assignment Range When Pasting Outside

When pasting exercises to dates outside the assignment's current range, automatically extend the assignment's date range to include the pasted dates. This ensures:
1. The pasted content persists correctly
2. The visual display matches the data

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarView.tsx` | Update `calendarDays` memo to check live editing state for any date, not just dates within assignment range |
| `src/hooks/useAthleteCalendarEditing.ts` | In paste handlers, update the assignment's date range if pasting outside current bounds |

---

## Technical Implementation

### `AthleteCalendarView.tsx` - calendarDays Memo Update

```typescript
return days.map(date => {
  const dateString = format(date, 'yyyy-MM-dd');
  
  // NEW: Check live editing state FIRST for the selected assignment
  // This allows pasted content to display even outside the original assignment range
  let usedLiveEditingState = false;
  const sessions: AthleteCalendarSession[] = [];
  let testNames: string[] = [];
  let eventNames: string[] = [];
  let assignmentId: string | undefined;
  let programName: string | undefined;

  // Check if selected assignment has exercises for this date (from live state)
  if (selectedAssignmentId) {
    const liveExercises = editing.exerciseDistribution.filter(
      (ex: any) => ex.dayDate === dateString
    );
    const liveSplitState = editing.daySplitStates[dateString] ?? 0;
    
    if (liveExercises.length > 0 || liveSplitState > 0) {
      // Use live editing state for this date
      usedLiveEditingState = true;
      const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);
      assignmentId = selectedAssignmentId;
      programName = selectedAssignment?.programName;
      
      // ... build sessions from live data (same logic as before)
    }
  }
  
  // If not using live state, fall back to assignment range filtering
  if (!usedLiveEditingState) {
    const dayAssignments = assignments.filter(assignment => {
      // ... existing range filter logic
    });
    // ... existing logic for other assignments
  }
  
  return { date, dateString, sessions, ... };
});
```

### `useAthleteCalendarEditing.ts` - Extend Assignment Range

In `handlePasteDay` and `handlePasteWeek`, after pasting exercises, check if any target dates fall outside the current assignment range and log a warning (the actual assignment update would require changes to the athlete data store).

For now, the visual fix above will ensure pasted content displays immediately. A future enhancement could automatically extend the assignment's date range.

---

## Expected Outcome

After this fix:
1. **Copy Day/Session** - Works as before, shows toast with exercise count
2. **Paste Day/Session** - Pasted content immediately appears on the target date, even if the date is outside the original program range
3. **Data Persistence** - Exercises are saved to the assignment's localStorage correctly
4. **UI Feedback** - The pasted session cards show with correct exercise counts and intensity indicators

---

## Testing Verification

1. Assign a program to an athlete (e.g., Feb 1-14)
2. Navigate to a session with exercises and click "Copy session"
3. Navigate to a date **outside** the program range (e.g., Feb 20)
4. Click the "Paste Session" button
5. **Expected**: The session card appears immediately with the pasted exercises
6. Click the session to open WorkoutSessionSheet and verify exercises are present

