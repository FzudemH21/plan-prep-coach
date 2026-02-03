

# UI Updates: Paste Button Styling & Week Menu Position

## Summary

Two visual changes to the Athlete Calendar:
1. Style the "Paste Session" button to match the Training Calendar (black button with white text, appears on hover)
2. Move the week 3-dot menu to the LEFT of the "Week of February 9th" label

---

## Change 1: Paste Session Button Styling

### Current State (AthleteCalendarDayCell.tsx)
The paste session buttons use `variant="outline"` which gives them a transparent background with a border.

### Target State (matching TrainingDayCell.tsx)
The Training Calendar uses `variant="default"` which gives them a solid black/primary background with white text, making them more prominent and visible.

### Implementation

**File: `src/components/athletes/AthleteCalendarDayCell.tsx`**

Update all paste session/day buttons to use:
- `variant="default"` instead of `variant="outline"`
- Use `Copy` icon (like Training Calendar) instead of `ClipboardPaste` for consistency
- Keep the hover visibility behavior using `group-hover/day:opacity-100`

Locations to update:
1. **Line 388-400**: Paste Session button below existing sessions
2. **Line 429-442**: Paste Day button for empty days  
3. **Line 444-457**: Paste Session button for empty days (when no copied day)

---

## Change 2: Week Menu Position

### Current State (AthleteCalendarWeekRow.tsx)
```
Week of Feb 9                    [Paste Week] [⋮]
```
The week label is on the left (`flex-1`), menu is on the right.

### Target State
```
[⋮]  Week of Feb 9               [Paste Week]
```
Move the 3-dot menu to the left of the week label.

### Implementation

**File: `src/components/athletes/AthleteCalendarWeekRow.tsx`**

Reorder the flex items in the week header:
1. 3-dot dropdown menu (first, on the left)
2. Week label ("Week of MMM d")
3. Paste Week button (on the right, when applicable)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarDayCell.tsx` | Change paste buttons from `variant="outline"` to `variant="default"`, update icon to `Copy` |
| `src/components/athletes/AthleteCalendarWeekRow.tsx` | Move week 3-dot menu to the left of the week label |

---

## Visual Comparison

### Paste Session Button

**Before (outline variant):**
```
┌─────────────────────────────┐
│  📋 Paste Session (1)       │  (transparent with border)
└─────────────────────────────┘
```

**After (default variant - matching Training Calendar):**
```
┌─────────────────────────────┐
│  📋 Paste Session (1)       │  (solid black with white text)
└─────────────────────────────┘
```

### Week Header

**Before:**
```
Week of Feb 9                              [⋮]
```

**After:**
```
[⋮]  Week of Feb 9                    
```
(with Paste Week button appearing on the right when a week is copied)

