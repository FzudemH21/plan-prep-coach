
# Fix Week/Day Paste Not Working in Athlete Calendar

## Root Cause Analysis

I found two interconnected issues causing the paste functionality to fail:

### Issue 1: Calendar View Uses Stale Cache

The calendar view (`AthleteCalendarView.tsx`) reads session data from `assignmentDataCache`, which is only loaded once from localStorage when assignments first load. When paste operations update the `editing` state (which auto-saves to localStorage), the cache is NOT refreshed because:

1. The `useEffect` at line 100-134 only runs when `assignments` array changes
2. It explicitly skips already-cached assignments to prevent re-loading

**Result**: Paste succeeds, data saves to localStorage, but UI shows stale data.

### Issue 2: trainingDays Update Uses Map Instead of Merge

When pasting to days outside the original assignment range, the `setTrainingDays` update uses `.map()` which only updates existing entries. If the target date doesn't exist in `trainingDays`, nothing is added.

```typescript
// Current code (only updates existing days)
setTrainingDays(prev =>
  prev.map(day => {
    const update = newTrainingDayUpdates[day.date];
    return update ? { ...day, ...update } : day;
  })
);
```

---

## Solution

### Part 1: Make Calendar View Read from Live Editing State

When an assignment is selected (the one being edited), the calendar should read from `editing.exerciseDistribution` instead of `assignmentDataCache`. This provides immediate visual feedback for all operations.

**File: `src/components/athletes/AthleteCalendarView.tsx`**

Update the `calendarDays` useMemo to check if the assignment matches the currently editing one, and if so, use live data:

```typescript
// When building session data for each day:
const isEditingAssignment = assignment.id === selectedAssignmentId;

if (isEditingAssignment) {
  // Use live editing state for immediate updates
  const liveExercises = editing.exerciseDistribution.filter(
    ex => ex.dayDate === dateString
  );
  const liveSplitState = editing.daySplitStates[dateString] ?? 1;
  // ... build sessions from live data
} else {
  // Use cache for other assignments
  // ... existing cache-based logic
}
```

### Part 2: Fix TrainingDays Update to Add Missing Days

Update the paste handlers to properly add new days to `trainingDays` if they don't exist.

**File: `src/hooks/useAthleteCalendarEditing.ts`**

In `handlePasteWeek` (~line 683):
```typescript
setTrainingDays(prev => {
  const updated = [...prev];
  Object.entries(newTrainingDayUpdates).forEach(([date, update]) => {
    const existingIdx = updated.findIndex(d => d.date === date);
    if (existingIdx >= 0) {
      // Update existing
      updated[existingIdx] = { ...updated[existingIdx], ...update };
    } else {
      // Add new day entry
      updated.push({
        date,
        dayOfWeek: new Date(date).getDay(),
        dayName: format(new Date(date), 'EEEE'),
        isTrainingDay: true,
        intensity: 'moderate' as IntensityLevel,
        ...update,
      });
    }
  });
  // Sort by date
  return updated.sort((a, b) => a.date.localeCompare(b.date));
});
```

Similarly update `handlePasteDay` to ensure the target day exists in `trainingDays`.

### Part 3: Add Debug Logging

Add console logs to help trace paste operations:

```typescript
console.log('[handlePasteWeek] Pasting', {
  sourceWeek: copiedWeek.weekStartDate,
  targetWeek: targetWeekStartDate,
  exerciseCount: copiedWeek.exercises.length,
  pastedExercises: pastedExercises.length,
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarView.tsx` | Update `calendarDays` memo to use live `editing` state for the selected assignment |
| `src/hooks/useAthleteCalendarEditing.ts` | Fix `handlePasteWeek` and `handlePasteDay` to properly add missing days to `trainingDays`; add debug logging |

---

## Technical Details

### Why Cache vs Live State Matters

The current architecture uses:
- `assignmentDataCache`: Static snapshot loaded from localStorage, used for calendar display
- `editing.*` state: Live state managed by the hook, auto-saved to localStorage

For real-time updates, operations that modify the editing state need to be reflected in the calendar immediately. The simplest fix is to make the calendar view read from the live editing state when viewing the selected assignment.

### Session Count Calculation

Currently, the calendar reads `numSessions` from:
```typescript
const numSessions = cachedData?.daySplitStates?.[dateString] ?? trainingDay?.sessions ?? 1;
```

After the fix, for the editing assignment:
```typescript
const numSessions = editing.daySplitStates[dateString] ?? 1;
```

---

## Expected Outcome

After these changes:
1. Copying a week shows toast: "Week copied: X exercises"
2. Clicking "Paste Week" immediately shows the pasted sessions in the calendar
3. Pasting to a different week correctly shifts dates and adds sessions
4. Existing sessions on target days are preserved (new sessions added)
5. Pasting days works the same way with immediate visual feedback
6. All data persists correctly to localStorage
