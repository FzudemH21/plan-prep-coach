

## Plan: Simplify Clear All Button Placement

### Summary
Remove the recently added "Clear All" button from the calendar header and make the existing "Clear All" button below the calendar always visible (not conditional).

---

### Current State

**Two "Clear All" buttons exist in Step 2:**
1. **Header button** (Lines 1707-1726): Always visible, X icon, no confirmation
2. **Below-calendar button** (Lines 1972-1999): Only shows when items are scheduled, Trash2 icon, has confirmation dialog

### Target State

**One "Clear All" button in Step 2:**
- Located below the calendar
- Always visible
- Includes confirmation dialog (existing behavior)

---

### Implementation

**File**: `src/pages/MacrocyclePage.tsx`

#### Change 1: Remove Header Clear All Button (Lines 1707-1726)

Remove the header with the Clear All button and just keep a simple header title:

**Before (Lines 1707-1726):**
```tsx
<div className="flex items-center justify-between">
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

**After:**
```tsx
<h3 className="font-semibold text-sm">Calendar Scheduling</h3>
```

#### Change 2: Make Below-Calendar Clear Button Always Visible (Lines 1972-1999)

Remove the conditional wrapper that only shows the button when items are scheduled:

**Before (Lines 1972-1999):**
```tsx
{/* Clear button */}
{(subGoals.some(sg => sg.testDates && sg.testDates.length > 0) || 
  events.some(e => e.eventDates && e.eventDates.length > 0)) && (
  <div className="mt-4 flex justify-center">
    <AlertDialog>
      ...
    </AlertDialog>
  </div>
)}
```

**After:**
```tsx
{/* Clear button - always visible */}
<div className="mt-4 flex justify-center">
  <AlertDialog>
    ...
  </AlertDialog>
</div>
```

---

### Visual Result

| Before | After |
|--------|-------|
| Two Clear All buttons (header + below calendar) | One Clear All button (below calendar only) |
| Below-calendar button only visible when items scheduled | Below-calendar button always visible |
| Header button has no confirmation | Single button has confirmation dialog |

---

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/MacrocyclePage.tsx` | Remove header Clear All button, make below-calendar button always visible |

