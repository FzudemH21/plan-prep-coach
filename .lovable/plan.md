

## Remove Visual Distinction for Adjacent Month Days

### Overview

Currently, days from adjacent months (like February days visible in a January 4-week view) have a grayed-out appearance with muted background and text colors. This change will make all visible days look identical regardless of which month they belong to.

---

### Changes

#### File: `src/components/athletes/AthleteCalendarDayCell.tsx`

**Change 1: Remove background color distinction (line 65)**

Before:
```tsx
day.isCurrentMonth ? "bg-card" : "bg-muted/30",
```

After:
```tsx
"bg-card",
```

**Change 2: Remove text color distinction (line 79)**

Before:
```tsx
!isTodayDate && !day.isCurrentMonth && "text-muted-foreground",
```

After:
```tsx
// Remove this line entirely
```

---

### Visual Result

All days in the calendar grid will now have the same white/card background and the same text styling, creating a uniform appearance across the entire visible calendar regardless of month boundaries.

---

### Summary

| File | Change |
|------|--------|
| `src/components/athletes/AthleteCalendarDayCell.tsx` | Remove `isCurrentMonth` styling conditions for background color and text color |

