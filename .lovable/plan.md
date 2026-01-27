

## Plan: Move SMART Goal Scheduling to Step 2 Only

### Summary
Remove the ability to schedule SMART goal tests in Step 1. In Step 1, the calendar should only be used for setting the plan duration (start/end dates). SMART goal test scheduling will only be available in Step 2.

---

### Current Behavior (Step 1)
1. SMART goals are clickable and can be selected
2. When a goal is selected, clicking a calendar date schedules a test
3. A hint appears: "Click on a date in the calendar to schedule a test for this goal"

### Proposed Behavior (Step 1)
1. SMART goals are displayed but **not selectable** for scheduling
2. Clicking calendar dates **only** sets plan start/end dates
3. No scheduling hint displayed
4. Edit/delete buttons still functional

---

### Implementation

**File**: `src/pages/MacrocyclePage.tsx`

#### Change 1: Remove Goal Selection in Step 1 (Lines 1140-1149)

Remove the clickable selection behavior from SMART goal cards. Keep the display but remove:
- The `cursor-pointer` class
- The `onClick` handler that sets `selectedSmartGoal`
- The selection highlight styling

**Before:**
```tsx
<div
  key={goal.id}
  className={cn(
    "p-3 border rounded-lg flex items-start justify-between gap-3 cursor-pointer transition-colors",
    selectedSmartGoal === goal.id 
      ? "ring-2 ring-green-500 bg-green-500/5" 
      : "bg-muted/30 hover:bg-muted/50"
  )}
  onClick={() => setSelectedSmartGoal(selectedSmartGoal === goal.id ? null : goal.id)}
>
```

**After:**
```tsx
<div
  key={goal.id}
  className="p-3 border rounded-lg flex items-start justify-between gap-3 bg-muted/30"
>
```

#### Change 2: Remove Scheduling Hint in Step 1 (Lines 1198-1202)

Delete or hide the hint that says "Click on a date in the calendar to schedule a test for this goal".

**Remove:**
```tsx
{selectedSmartGoal && (
  <p className="text-xs text-muted-foreground text-center bg-muted/50 p-2 rounded">
    Click on a date in the calendar to schedule a test for this goal
  </p>
)}
```

#### Change 3: Remove Goal Scheduling Logic from Calendar (Lines 1226-1246)

Remove the `if (selectedSmartGoal)` branch from the calendar's `onSelect` handler, so clicking always sets plan duration.

**Before:**
```tsx
onSelect={(selectedDate) => {
  if (!selectedDate) return;
  
  // If a SMART goal is selected, toggle scheduling for that goal
  if (selectedSmartGoal) {
    // ... scheduling logic ...
  } else {
    // Original calendar selection behavior
    handleCalendarSelect(selectedDate);
  }
}}
```

**After:**
```tsx
onSelect={(selectedDate) => {
  if (!selectedDate) return;
  handleCalendarSelect(selectedDate);
}}
```

#### Change 4: Remove Goal Scheduled Modifier from Calendar (Lines 1255-1280)

Remove the `goalScheduled` modifier and its styling from Step 1's calendar since we no longer show scheduled tests there.

**Remove from modifiers:**
```tsx
goalScheduled: smartGoals
  .flatMap(g => g.testDates || [])
  .map(dateStr => parseISO(dateStr))
```

**Remove from modifiersStyles:**
```tsx
goalScheduled: {
  backgroundColor: 'hsl(38 92% 50%)',
  color: 'white',
  fontWeight: 'bold'
}
```

---

### Visual Result

**Step 1 (Plan Setup & Goals)**
- SMART goals displayed as static cards (no click-to-select)
- Calendar only used for selecting plan start/end dates
- No amber "scheduled test" markers in calendar

**Step 2 (Sub-Goals & Testing)**
- SMART goals (primary goals) are clickable and selectable
- Sub-goals are clickable and selectable
- Events are clickable and selectable
- Calendar shows all scheduled tests with appropriate markers
- Full scheduling functionality available

---

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/MacrocyclePage.tsx` | Remove SMART goal scheduling from Step 1 calendar |

---

### Testing Checklist

After implementation:
1. ✓ Step 1: SMART goals display correctly but cannot be selected
2. ✓ Step 1: Calendar only sets plan duration (start/end dates)
3. ✓ Step 1: No "schedule test" hint appears
4. ✓ Step 2: Primary goals can be clicked and selected (with visual highlight)
5. ✓ Step 2: Clicking calendar with primary goal selected schedules a test
6. ✓ Step 2: Sub-goals and events scheduling still works

