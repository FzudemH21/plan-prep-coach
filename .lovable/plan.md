

## Fix: Sub-Goal Selection Logic and Add Clear Calendar Feature

### Summary
Two changes needed:
1. **Fix sub-goal selection bug**: Separate the expand/collapse behavior from the selection behavior on primary goals, so clicking a sub-goal correctly selects it (not the parent goal)
2. **Add "Clear Calendar" buttons**: Allow users to clear scheduled dates in both Step 1 and Step 2

---

## Problem 1: Sub-Goal Selection Bug

### Root Cause
In Step 2, clicking anywhere on the primary goal header (lines 1365-1386) does two things simultaneously:
1. Selects/deselects the primary goal for scheduling (`setSelectedSmartGoal`)
2. Expands/collapses the dropdown

When a user clicks to expand and see sub-goals, it also selects the primary goal. Then when they click a sub-goal, the `selectedSmartGoal` state is still set, so the calendar handler schedules the primary goal instead.

### Solution
Separate the expand arrow from the selection area:
- **Clicking the arrow icon**: Only toggle expand/collapse (no selection change)
- **Clicking the goal content area**: Select/deselect the primary goal for scheduling

This matches the sub-goal pattern where there's a separate expand button.

---

## Problem 2: Clear Calendar Feature

### Step 1 Clear Calendar
- Add a "Clear Dates" button next to the calendar
- When clicked: Clear `planDuration` (sets to undefined/null)
- Result: Both start and end dates are removed

### Step 2 Clear Calendar  
- Add a "Clear All Scheduled" button above the calendar
- When clicked: Clear all `testDates` from all `smartGoals`, `subGoals`, and all `eventDates` from `events`
- Result: All scheduled items are removed from the calendar

---

## Implementation Details

### File: `src/pages/MacrocyclePage.tsx`

#### Change 1: Separate Expand from Selection (Lines 1365-1408)

**Current Structure:**
```tsx
<div 
  className="p-3 bg-muted/30 cursor-pointer..."
  onClick={() => {
    setSelectedSmartGoal(...);  // Selection
    setExpandedPrimaryGoals(...); // Expand
  }}
>
  {/* Goal content */}
  <ChevronDown className="h-4 w-4" />  {/* Arrow - not interactive */}
</div>
```

**New Structure:**
```tsx
<div className="p-3 bg-muted/30 flex items-start gap-2">
  {/* Expand Arrow - separate button */}
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6 shrink-0 mt-0.5"
    onClick={(e) => {
      e.stopPropagation();
      setExpandedPrimaryGoals(prev => {
        const next = new Set(prev);
        if (next.has(goal.id)) next.delete(goal.id);
        else next.add(goal.id);
        return next;
      });
    }}
  >
    <ChevronDown className={cn("h-4 w-4 transition-transform", isGoalExpanded && "rotate-180")} />
  </Button>
  
  {/* Goal Content - clickable for selection */}
  <div 
    className={cn(
      "flex-1 cursor-pointer transition-colors rounded p-1 -m-1",
      selectedSmartGoal === goal.id 
        ? "ring-2 ring-inset ring-primary bg-primary/5" 
        : "hover:bg-muted/50"
    )}
    onClick={() => {
      setSelectedSmartGoal(selectedSmartGoal === goal.id ? null : goal.id);
      setSelectedTest(null);
      setSelectedEvent(null);
    }}
  >
    {/* Goal title, values, badges */}
  </div>
</div>
```

#### Change 2: Add Clear Button for Step 1 Calendar (Around line 1244)

Add a "Clear Dates" button after the calendar:

```tsx
{planDuration && (
  <div className="flex justify-center mt-2">
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive"
      onClick={() => {
        setPlanDuration(undefined);
        toast({ title: 'Calendar Cleared', description: 'Start and end dates have been removed.' });
      }}
    >
      <X className="h-4 w-4 mr-1" />
      Clear Dates
    </Button>
  </div>
)}
```

#### Change 3: Add Clear Button for Step 2 Calendar (Around line 1677)

Add a "Clear All Scheduled" button in the calendar header area:

```tsx
<div className="flex items-center justify-between mb-2">
  <h3 className="font-semibold text-sm">Calendar Scheduling</h3>
  <Button
    variant="ghost"
    size="sm"
    className="text-muted-foreground hover:text-destructive h-7 text-xs"
    onClick={() => {
      // Clear all scheduled tests from SMART goals
      setSmartGoals(prev => prev.map(g => ({ ...g, testDates: [] })));
      // Clear all scheduled tests from sub-goals
      setSubGoals(prev => prev.map(sg => ({ ...sg, testDates: [] })));
      // Clear all scheduled events
      setEvents(prev => prev.map(e => ({ ...e, eventDates: [] })));
      toast({ title: 'Calendar Cleared', description: 'All scheduled items have been removed.' });
    }}
  >
    <X className="h-3 w-3 mr-1" />
    Clear All
  </Button>
</div>
```

---

## Visual Changes Summary

### Step 2 Primary Goals
- **Before**: Entire header area clickable, selects AND expands
- **After**: Arrow button on left for expand only, goal content area for selection only

### Step 1 Calendar
- **Before**: No way to clear dates (must re-select)
- **After**: "Clear Dates" button appears when dates are set

### Step 2 Calendar  
- **Before**: No way to clear all scheduled items at once
- **After**: "Clear All" button in header clears all schedules

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/MacrocyclePage.tsx` | 1. Separate expand/select in primary goal header, 2. Add clear button for Step 1, 3. Add clear button for Step 2 |

---

## Testing Checklist

After implementation:
1. Click the expand arrow on a primary goal - it should only expand, not select
2. Click the goal content area - it should select (with visual highlight), arrow stays independent
3. With primary goal expanded, click a sub-goal - the sub-goal should be selected (not the primary)
4. Click calendar date - the correct selected item (primary or sub-goal) is scheduled
5. In Step 1, click "Clear Dates" - both start and end dates are removed
6. In Step 2, click "Clear All" - all scheduled tests and events are removed from calendar

