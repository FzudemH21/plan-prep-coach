
## Enable Interactions on All Visible Calendar Days

### The Issue

Currently, the Athlete Calendar uses an `isCurrentMonth` flag to restrict the plus (+) button to only days that belong to the same month as the navigation reference date. In your 4-week view, this means February days appear grayed out without the ability to add sessions or assign programs, even though they're clearly visible in your calendar view.

### The Fix

Since the Athlete Calendar uses week-based views (1W, 2W, 4W), not month-based views, all visible days should be interactive. We'll remove the `isCurrentMonth` restriction from the interactive elements.

---

### Changes

#### File: `src/components/athletes/AthleteCalendarDayCell.tsx`

**Change 1:** Remove `isCurrentMonth` check from the add button dropdown (line 230)

Before:
```tsx
{day.isCurrentMonth && (
  <DropdownMenu>
    ...
  </DropdownMenu>
)}
```

After:
```tsx
<DropdownMenu>
  ...
</DropdownMenu>
```

**Change 2:** Remove `isCurrentMonth` check from the day-level menu (line 159)

Before:
```tsx
{day.isCurrentMonth && day.assignmentId && onDeleteAssignment && (
```

After:
```tsx
{day.assignmentId && onDeleteAssignment && (
```

---

### Visual Result

**Before (February days grayed out, no plus button):**
```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Jan 26  │ Jan 27  │ Jan 28  │ Jan 29  │ Jan 30  │ Jan 31  │ Feb 1   │
│   [+]   │   [+]   │   [+]   │   [+]   │   [+]   │   [+]   │ (gray)  │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Feb 2   │ Feb 3   │ Feb 4   │ Feb 5   │ Feb 6   │ Feb 7   │ Feb 8   │
│ (gray)  │ (gray)  │ (gray)  │ (gray)  │ (gray)  │ (gray)  │ (gray)  │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

**After (All visible days interactive):**
```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Jan 26  │ Jan 27  │ Jan 28  │ Jan 29  │ Jan 30  │ Jan 31  │ Feb 1   │
│   [+]   │   [+]   │   [+]   │   [+]   │   [+]   │   [+]   │   [+]   │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Feb 2   │ Feb 3   │ Feb 4   │ Feb 5   │ Feb 6   │ Feb 7   │ Feb 8   │
│   [+]   │   [+]   │   [+]   │   [+]   │   [+]   │   [+]   │   [+]   │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

### Note on Visual Styling

The `isCurrentMonth` flag is still used for styling purposes (lines 65, 79) - days from other months will still have a slightly muted background (`bg-muted/30`) and lighter text, which is a common calendar design pattern to indicate "outside" days while still making them fully functional. This styling distinction will remain.

---

### Summary

| File | Change |
|------|--------|
| `src/components/athletes/AthleteCalendarDayCell.tsx` | Remove `isCurrentMonth` conditions from interactive elements (plus button dropdown, day menu) |
