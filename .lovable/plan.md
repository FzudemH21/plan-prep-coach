

## Replace "Add Session" Button Text with Plus Icon Only

### Overview

Replace the "Add Session" button text in the Training Calendar view with a simple plus icon button to create a cleaner, more compact interface.

---

### Changes

**File**: `src/components/microcycle-planning/TrainingDayCell.tsx`

Three "Add Session" buttons need to be updated to show only a plus icon:

#### 1. Button for days with existing sessions (lines 497-511)
Currently shows after session cards when day has training.

```tsx
// BEFORE:
<Button
  onClick={(e) => {
    e.stopPropagation();
    onAddSession(day.dateString);
  }}
  variant="ghost"
  size="sm"
  className="w-full mt-1 h-7 text-xs"
>
  <Plus className="h-3 w-3 mr-1" />
  Add Session
</Button>

// AFTER:
<Button
  onClick={(e) => {
    e.stopPropagation();
    onAddSession(day.dateString);
  }}
  variant="ghost"
  size="icon"
  className="w-full mt-1 h-7"
  title="Add session"
>
  <Plus className="h-4 w-4" />
</Button>
```

#### 2. Button for rest days (lines 530-542)
Currently shows on hover for days marked as rest.

```tsx
// BEFORE:
<Button
  onClick={(e) => {
    e.stopPropagation();
    onAddSession(day.dateString);
  }}
  variant="ghost"
  size="sm"
  className="mt-2 h-7 text-xs"
>
  <Plus className="h-3 w-3 mr-1" />
  Add Session
</Button>

// AFTER:
<Button
  onClick={(e) => {
    e.stopPropagation();
    onAddSession(day.dateString);
  }}
  variant="ghost"
  size="icon"
  className="mt-2 h-7 w-7"
  title="Add session"
>
  <Plus className="h-4 w-4" />
</Button>
```

#### 3. Button for empty days (lines 564-576)
The main one visible in the screenshot - shows in empty day cells.

```tsx
// BEFORE:
<Button
  onClick={(e) => {
    e.stopPropagation();
    onAddSession(day.dateString);
  }}
  variant="outline"
  size="sm"
  className="h-7 text-xs"
>
  <Plus className="h-3 w-3 mr-1" />
  Add Session
</Button>

// AFTER:
<Button
  onClick={(e) => {
    e.stopPropagation();
    onAddSession(day.dateString);
  }}
  variant="outline"
  size="icon"
  className="h-7 w-7"
  title="Add session"
>
  <Plus className="h-4 w-4" />
</Button>
```

---

### Visual Result

**Before:**
```
┌─────────────────────┐
│ 26  🟨              │
│                     │
│   [+ Add Session]   │
│                     │
└─────────────────────┘
```

**After:**
```
┌─────────────────────┐
│ 26  🟨              │
│                     │
│        [+]          │
│                     │
└─────────────────────┘
```

---

### Summary

| Location | Change |
|----------|--------|
| Days with sessions | Replace "Add Session" text with plus icon |
| Rest days | Replace "Add Session" text with plus icon |
| Empty days | Replace "Add Session" text with plus icon |

All buttons will have a `title="Add session"` attribute for accessibility/tooltip on hover, so users can still understand the button's purpose.

