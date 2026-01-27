
## Plan: Fix Search Input Focus Ring Clipping

### Problem
When clicking into the "Search exercises..." text field in the Change Exercise dialog (opened from three-dot menu), the focus ring/border is cut off at the edges. This happens because the parent container clips the input's focus ring which extends 2px beyond the input boundaries.

### Root Cause
The focus ring (`focus-visible:ring-2`) on the Input component creates a visual ring that extends beyond the element's box. When the parent container doesn't have sufficient padding or overflow visible, this ring gets clipped.

### Solution
Add horizontal padding (`px-1`) to the container wrapping the search input to provide space for the focus ring to display without clipping.

---

### Files to Modify

| File | Change |
|------|--------|
| `ExerciseLibraryPopup.tsx` | Add `px-1` padding to search input wrapper |
| `ExerciseChangePopup.tsx` | Add `px-1` padding to search input wrapper |

---

### Changes

#### 1. ExerciseLibraryPopup.tsx (Line 363)

**Current:**
```tsx
<div className="relative">
  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search exercises..."
    ...
  />
</div>
```

**After:**
```tsx
<div className="relative px-1">
  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search exercises..."
    className="pl-8 w-64"
    ...
  />
</div>
```

The `px-1` adds 4px horizontal padding to prevent clipping, and the search icon position is adjusted from `left-2` to `left-3` to maintain visual alignment.

#### 2. ExerciseChangePopup.tsx (Lines 135-146)

**Current:**
```tsx
<div className="px-3 py-2 border-b">
  <div className="relative">
    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Search exercises..."
      className="pl-8 h-9 text-sm"
      autoFocus
    />
  </div>
</div>
```

**After:**
```tsx
<div className="px-2 py-2 border-b">
  <div className="relative px-1">
    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Search exercises..."
      className="pl-8 h-9 text-sm"
      autoFocus
    />
  </div>
</div>
```

The outer padding is reduced from `px-3` to `px-2`, while the inner wrapper gets `px-1` to ensure focus rings are visible.

---

### Visual Result

**Before:** Focus ring clipped at edges when input is focused
**After:** Full focus ring visible with proper spacing around the input

This follows the same pattern already established in `ExerciseDetailDialog` for preventing focus ring clipping.
