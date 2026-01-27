

## Remove Exercise Allocation Indicators from Exercise Library Panel

### Overview

Remove the colored dots and allocation count numbers next to exercises in the Exercise Library Panel to create a cleaner, slimmer interface.

---

### Changes

**File**: `src/components/microcycle-planning/ExerciseLibraryPanel.tsx`

#### Remove Colored Dot and Allocation Badge

The exercise items appear in two places in the code (for methods with and without categories). In both places, remove:

1. **The colored allocation dot** (lines 231-234 and 316-319):
```tsx
// REMOVE:
<div className={cn(
  "w-2 h-2 rounded-full flex-shrink-0",
  getAllocationDotColor(allocationCount)
)} />
```

2. **The allocation count Badge** (lines 236-241 and 321-326):
```tsx
// REMOVE:
<Badge 
  variant={getAllocationBadgeVariant(allocationCount)} 
  className="text-xs px-2 py-0.5 font-semibold"
>
  {allocationCount}
</Badge>
```

3. **Remove unused variables and functions**:
   - Remove `allocationCount` variable in each exercise map (lines 211 and 296)
   - Remove `getAllocationBadgeVariant` function (lines 71-76)
   - Remove `getAllocationDotColor` function (lines 78-83)
   - Remove `Badge` import if no longer needed (line 4)

---

### Visual Result

**Before:**
```
⋮ ● Squat                    [2]
⋮ ● RDL                      [0]
```

**After:**
```
⋮ Squat
⋮ RDL
```

---

### Summary

| Item | Action |
|------|--------|
| Colored allocation dot | Remove |
| Allocation count Badge | Remove |
| `getAllocationBadgeVariant` function | Remove |
| `getAllocationDotColor` function | Remove |
| `allocationCount` variable | Remove |
| `Badge` import | Remove (if unused) |

The exercises will now show only the drag handle (GripVertical) and the exercise name, making the list slimmer and cleaner.

