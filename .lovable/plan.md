

## Reposition Icons Next to Intensity Labels

### Overview

Move the copy and trash icons to be positioned directly next to the intensity badge, rather than pushed to the right edge of the header.

---

### Changes

**File**: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

#### Change 1: Mesocycle Header (lines 1977-1988)

Current structure:
```tsx
<div className="flex items-center px-4 py-2">
  <div className="flex-1 flex items-center justify-center gap-3">
    <h2>...</h2>
    <Badge>...</Badge>
  </div>
  
  <div className="flex items-center gap-1">  {/* Icons pushed right */}
```

New structure - move icons inside the centered container:
```tsx
<div className="flex items-center justify-center px-4 py-2">
  <div className="flex items-center gap-3">
    <h2>...</h2>
    <Badge>...</Badge>
    <div className="flex items-center gap-1">  {/* Icons next to badge */}
      {/* Copy and Trash buttons */}
    </div>
  </div>
</div>
```

#### Change 2: Microcycle Header (lines 2066-2078)

Current structure:
```tsx
<div className="absolute inset-0 flex items-center justify-between px-3">
  <div className="w-16" />  {/* Left spacer */}
  <div className="flex items-center justify-center gap-2">
    <span>{microcycle.name}</span>
    <Badge>...</Badge>
  </div>
  <div className="flex items-center gap-1">  {/* Icons pushed right */}
```

New structure - remove spacer and move icons inside centered container:
```tsx
<div className="absolute inset-0 flex items-center justify-center px-3">
  <div className="flex items-center gap-2">
    <span>{microcycle.name}</span>
    <Badge>...</Badge>
    <div className="flex items-center gap-1">  {/* Icons next to badge */}
      {/* Copy and Trash buttons */}
    </div>
  </div>
</div>
```

---

### Summary

| Location | Change |
|----------|--------|
| Lines 1977-1988 | Change to `justify-center`, remove `flex-1`, move icons div inside centered container |
| Lines 2066-2078 | Change to `justify-center`, remove left spacer, move icons div inside centered container |

### Visual Result

**Before:**
```
[                    Mesocycle Name  MODERATE                    [📋][🗑️]]
```

**After:**
```
[              Mesocycle Name  MODERATE  [📋][🗑️]              ]
```

Icons will now appear directly next to the intensity badge, centered with the rest of the header content.

