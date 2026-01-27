

## Fix: Sub-Goal Selection Should Clear Parent Goal Selection

### Problem
When clicking on a sub-goal (e.g., "1RM Front Squat"), the main goal ("100m Sprint Time") remains selected. When clicking on the calendar, the handler checks `selectedSmartGoal` first, so the main goal gets scheduled instead of the sub-goal.

### Root Cause
In the sub-goal click handler (lines 1469-1472):
```tsx
onClick={() => {
  setSelectedTest(selectedTest === subGoal.id ? null : subGoal.id);
  setSelectedEvent(null);
  // Missing: setSelectedSmartGoal(null) ← THIS IS THE BUG
}}
```

The calendar handler (lines 1804-1819) checks in this order:
1. `if (selectedSmartGoal)` → schedules the main goal
2. `else if (selectedTest)` → schedules the sub-goal

Since `selectedSmartGoal` is not cleared when clicking a sub-goal, the main goal remains "selected" and takes priority.

### Solution
Add `setSelectedSmartGoal(null)` to the sub-goal click handler so that selecting a sub-goal clears the parent goal selection.

---

## Implementation

### File: `src/pages/MacrocyclePage.tsx`

#### Change: Add `setSelectedSmartGoal(null)` to sub-goal click (Lines 1469-1472)

**Current code:**
```tsx
onClick={() => {
  setSelectedTest(selectedTest === subGoal.id ? null : subGoal.id);
  setSelectedEvent(null);
}}
```

**Fixed code:**
```tsx
onClick={() => {
  setSelectedTest(selectedTest === subGoal.id ? null : subGoal.id);
  setSelectedSmartGoal(null);  // Clear main goal selection
  setSelectedEvent(null);
}}
```

---

## Summary

| Location | Change |
|----------|--------|
| Line 1469-1472 | Add `setSelectedSmartGoal(null)` to sub-goal click handler |

This ensures mutual exclusivity: when you select a sub-goal, the main goal is deselected, and vice versa. The calendar handler will then correctly schedule whichever item is selected.

---

## Testing Checklist

After implementation:
1. Click on a primary goal (100m Sprint Time) → it should highlight
2. Click on its sub-goal (1RM Front Squat) → sub-goal highlights, main goal de-highlights
3. Click on calendar → the sub-goal test is scheduled (not the main goal)
4. Click on main goal again → main goal highlights, sub-goal de-highlights
5. Click on calendar → main goal test is scheduled

