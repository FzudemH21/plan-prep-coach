

## Bug Fix: Test Scheduling in Macrocycle Planning Step 2

### Problem Summary
The user cannot schedule tests in Step 2 of macrocycle planning. The session replay confirms clicking on goals and sub-goals, then clicking the calendar, does not add tests to the calendar.

### Root Cause Analysis

I identified **three bugs** in `src/pages/MacrocyclePage.tsx`:

---

### Bug 1: Primary Goals Cannot Be Selected for Scheduling

**Location**: Lines 1405-1417

**Issue**: Clicking on a primary (SMART) goal in Step 2 only toggles the expand/collapse state. It does NOT set `selectedSmartGoal`, so there's no way to select a primary goal for test scheduling in Step 2.

**Current Code**:
```jsx
<div 
  className="p-3 bg-muted/30 cursor-pointer hover:bg-muted/50"
  onClick={() => {
    // ONLY toggles expand - doesn't set selectedSmartGoal
    setExpandedPrimaryGoals(prev => { ... });
  }}
>
```

**Fix**: Add a separate clickable area or modify the click handler to also set `selectedSmartGoal` and clear other selections.

---

### Bug 2: Calendar Handler Ignores Primary Goals

**Location**: Lines 1782-1811

**Issue**: The Step 2 calendar's click handler only checks for `selectedTest` (sub-goals) and `selectedEvent` (events). It completely ignores `selectedSmartGoal` (primary goals).

**Current Code**:
```jsx
const handleClick = (e: any) => {
  if (selectedTest) {
    // Handle sub-goal scheduling...
  } else if (selectedEvent) {
    scheduleEvent(selectedEvent, date);
  } else {
    toast({ title: 'Select an item', ... });
  }
  // Missing: no check for selectedSmartGoal!
};
```

**Fix**: Add handling for `selectedSmartGoal` similar to how Step 1's calendar handles it (lines 1227-1242).

---

### Bug 3: Derived Sub-Goals Cannot Be Scheduled

**Location**: Lines 1787-1805

**Issue**: When scheduling a sub-goal test, the code searches in the `subGoals` array:
```jsx
const subGoalIndex = updated.findIndex(sg => sg.id === selectedTest);
```

But **derived sub-goals** (auto-generated from parameter relationships) exist only in `derivedSubGoals` (a useMemo), not in `subGoals`. So when `subGoalIndex` is -1, nothing happens.

**Fix**: Search in both `subGoals` and `derivedSubGoals`, or convert derived sub-goals to regular sub-goals when scheduling a test for them.

---

## Implementation Plan

### File to Modify
`src/pages/MacrocyclePage.tsx`

### Step 1: Fix Primary Goal Selection (Bug 1)

Add a way to select primary goals for scheduling. Either:
- **Option A**: Add a "Schedule Test" button on the primary goal card
- **Option B**: Add selection state to the primary goal header (with visual highlight)

I recommend **Option B** for consistency with sub-goal selection:

```jsx
// In the primary goal header (around line 1405)
<div 
  className={cn(
    "p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors",
    selectedSmartGoal === goal.id && "ring-2 ring-inset ring-primary bg-primary/5"
  )}
  onClick={(e) => {
    // If clicking the expand arrow area, just toggle
    // Otherwise, select the goal for scheduling
    setSelectedSmartGoal(selectedSmartGoal === goal.id ? null : goal.id);
    setSelectedTest(null);
    setSelectedEvent(null);
    // Keep expand behavior too
    setExpandedPrimaryGoals(prev => {
      const next = new Set(prev);
      if (next.has(goal.id)) next.delete(goal.id);
      else next.add(goal.id);
      return next;
    });
  }}
>
```

### Step 2: Fix Calendar Handler (Bug 2)

Add `selectedSmartGoal` handling to the Step 2 calendar click handler:

```jsx
const handleClick = (e: any) => {
  dayProps?.onClick?.(e);
  e.preventDefault();
  e.stopPropagation();
  
  // NEW: Handle primary (SMART) goal scheduling
  if (selectedSmartGoal) {
    const dateStr = format(date, 'yyyy-MM-dd');
    setSmartGoals(prev => prev.map(goal => {
      if (goal.id === selectedSmartGoal) {
        const currentDates = goal.testDates || [];
        const isAlreadyScheduled = currentDates.includes(dateStr);
        if (isAlreadyScheduled) {
          toast({ title: 'Test Unscheduled', description: `Removed test from ${format(date, 'PPP')}` });
          return { ...goal, testDates: currentDates.filter(d => d !== dateStr) };
        } else {
          toast({ title: 'Test Scheduled', description: `Scheduled test for ${format(date, 'PPP')}` });
          return { ...goal, testDates: [...currentDates, dateStr] };
        }
      }
      return goal;
    }));
  } else if (selectedTest) {
    // Existing sub-goal handling...
  } else if (selectedEvent) {
    scheduleEvent(selectedEvent, date);
  } else {
    toast({ title: 'Select an item', description: 'Choose a goal, sub-goal, or event from the list, then click a date.' });
  }
};
```

### Step 3: Fix Derived Sub-Goal Scheduling (Bug 3)

Modify the sub-goal scheduling logic to also check `derivedSubGoals`. When a derived sub-goal is scheduled, "promote" it to a regular sub-goal:

```jsx
if (selectedTest) {
  // First check user-created subGoals
  let subGoalIndex = subGoals.findIndex(sg => sg.id === selectedTest);
  
  if (subGoalIndex !== -1) {
    // Existing logic for user-created sub-goals...
  } else {
    // Check if it's a derived sub-goal
    const derivedSubGoal = derivedSubGoals.find(sg => sg.id === selectedTest);
    if (derivedSubGoal) {
      // "Promote" to regular sub-goal with the scheduled date
      const promotedSubGoal: SubGoal = {
        ...derivedSubGoal,
        testDates: [dateStr],
        isDerived: false, // No longer derived once user schedules it
      };
      setSubGoals(prev => [...prev, promotedSubGoal]);
      toast({ 
        title: 'Test Scheduled', 
        description: `Scheduled "${derivedSubGoal.description}" for ${format(date, 'PPP')}` 
      });
    }
  }
}
```

---

## Visual Changes

After the fix:
- **Primary goals**: Clickable with visual highlight when selected (ring border + light background)
- **Sub-goals**: Same as current (ring highlight when selected)
- **Calendar**: Responds to all three selection types (primary goals, sub-goals, events)
- **Derived sub-goals**: Can be scheduled, which "promotes" them to regular sub-goals

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/MacrocyclePage.tsx` | Fix 3 bugs in Step 2 test scheduling |

---

## Testing Checklist

After implementation, verify:
1. Clicking a primary goal in Step 2 highlights it
2. With primary goal selected, clicking calendar date adds test (amber square appears)
3. Clicking a sub-goal highlights it
4. With sub-goal selected, clicking calendar date adds test (black circle appears)
5. Derived sub-goals (blue "Linked" badge) can be scheduled
6. Events can still be scheduled normally
7. Visual feedback shows correctly in calendar

