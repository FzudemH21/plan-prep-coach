

# UI Cosmetic Fixes: Always-Visible Menus + Remove Assigned Programs Section

## Summary

Two changes based on user feedback:
1. Make the three-dot menus always visible (for weeks, days, and sessions) instead of only appearing on hover
2. Remove the "Assigned Programs" card section at the bottom of the Athlete Calendar

---

## Change 1: Always-Visible Three-Dot Menus

Currently all menus use `opacity-0 group-hover/...:opacity-100` to only show on hover. We need to remove these opacity classes to make menus always visible.

### File: `src/components/athletes/AthleteCalendarWeekRow.tsx`

**Week menu (line 93):**
```
Current:  <div className="opacity-0 group-hover/week:opacity-100 transition-opacity">
Fixed:    <div>
```

**Paste week button (line 127):**
```
Current:  <div className="opacity-0 group-hover/week:opacity-100 transition-opacity">
Fixed:    <div>
```

### File: `src/components/athletes/AthleteCalendarDayCell.tsx`

**Day menu button (line 220):**
```
Current:  <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors opacity-0 group-hover/day:opacity-100">
Fixed:    <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors">
```

**Session menu button (line 350):**
```
Current:  <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors opacity-0 group-hover/session:opacity-100">
Fixed:    <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors">
```

Note: The paste buttons (lines 395, 437, 452) will remain hover-only as they are action buttons, not navigation menus.

---

## Change 2: Remove "Assigned Programs" Section

### File: `src/components/athletes/AthleteCalendarView.tsx`

Remove the entire "Assignments List" Card (lines 888-947):
```tsx
{/* Assignments List */}
{assignments.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Assigned Programs</CardTitle>
    </CardHeader>
    <CardContent>
      ... all the assignment list content ...
    </CardContent>
  </Card>
)}
```

This aligns with the user's vision that "training is continuous" for athletes and the assignments list is not needed.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarWeekRow.tsx` | Remove hover-only opacity from week menu wrapper divs |
| `src/components/athletes/AthleteCalendarDayCell.tsx` | Remove hover-only opacity from day and session menu buttons |
| `src/components/athletes/AthleteCalendarView.tsx` | Remove the "Assigned Programs" Card section (lines 888-947) |

---

## Expected Outcome

1. Three-dot menus for weeks, days, and sessions will always be visible without needing to hover
2. The "Assigned Programs" card at the bottom of the calendar will no longer appear
3. Paste buttons will still appear only on hover (as they are contextual action buttons)

