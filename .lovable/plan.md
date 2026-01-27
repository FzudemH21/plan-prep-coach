

## Revert Sticky Icon Changes

### Overview

Simple revert to remove the sticky positioning from header icons in Step 1 of Microcycle Planning. The transparent intensity backgrounds and badges will be preserved.

---

### Changes

**File**: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

#### Change 1: Mesocycle Header Icons (line 1988-1989)

```tsx
// BEFORE (current - with sticky styling)
{/* Sticky Icons */}
<div className="sticky right-4 flex items-center gap-1 z-10 bg-background/80 rounded p-1">

// AFTER (reverted - simple flex)
<div className="flex items-center gap-1">
```

#### Change 2: Microcycle Header Icons (line 2079-2080)

```tsx
// BEFORE (current - with sticky styling)
{/* Sticky Icons */}
<div className="sticky right-2 flex items-center gap-1 z-10 bg-background/80 rounded p-1">

// AFTER (reverted - simple flex)
<div className="flex items-center gap-1">
```

---

### Summary

| Location | Change |
|----------|--------|
| Line 1988-1989 | Remove comment and change to `<div className="flex items-center gap-1">` |
| Line 2079-2080 | Remove comment and change to `<div className="flex items-center gap-1">` |

### What Stays the Same

- Transparent intensity-tinted backgrounds (`getSubtleIntensityBg`)
- Colored intensity badges
- `rounded-md border border-border` styling on headers
- Dynamic height behavior

