

## Fix: Mesocycle Header Overcrowding in Step 1

### Problem
When a mesocycle has only 1 microcycle (7 days), its header width is only 120px, but the content (name + intensity badge + icons + dates) requires more space. This causes:
1. Text and badges to overlap with adjacent mesocycles
2. Intensity badge extending outside the container box
3. Visual clutter making it hard to read

### Solution
Increase the **minimum width per microcycle** to ensure mesocycle headers have enough room for their content. The key insight is that a single-microcycle mesocycle still needs enough horizontal space for:
- Mesocycle name (e.g., "Mesocycle 3")
- Intensity badge (e.g., "DELOAD" or "EXTREMELY HARD")
- Copy button (if not the first mesocycle)
- Date range text

### Implementation

**Files to modify:**
1. `src/components/mesocycle/MicrocycleIntensityPlanning.tsx`
2. `src/components/mesocycle/MicrocycleIntensityColumn.tsx`

### Changes

#### 1. Increase microcycle column width from 120px → 140px

This gives each microcycle column 20px more breathing room, which translates to:
- 1 microcycle mesocycle: 140px (was 120px) 
- 4 microcycle mesocycle: 560px (was 480px)

**MicrocycleIntensityPlanning.tsx (line 156):**
```typescript
// Before
const width = meso.microcycles.length * 120; // 120px per microcycle

// After  
const width = meso.microcycles.length * 140; // 140px per microcycle
```

**MicrocycleIntensityColumn.tsx (line 136 and 237):**
```typescript
// Before
<div className={cn("flex flex-col w-[120px] shrink-0 ...")}>

// After
<div className={cn("flex flex-col w-[140px] shrink-0 ...")}>
```

```typescript
// Before (line 237)
<div className="text-xs mt-2 text-center ... w-[120px] ...">

// After
<div className="text-xs mt-2 text-center ... w-[140px] ...">
```

#### 2. Make mesocycle header content more flexible

Add `overflow-hidden` and `min-w-0` to prevent content from overflowing, and use `flex-wrap` or truncation for very long intensity names:

**MicrocycleIntensityPlanning.tsx (line 164):**
```typescript
// Before
<div className="flex items-center justify-center gap-2">

// After
<div className="flex items-center justify-center gap-1.5 flex-wrap min-w-0 px-2">
```

Also ensure the mesocycle header container has `overflow-hidden`:
```typescript
// Line 160
<div 
  key={meso.id}
  className={cn("relative text-center border font-semibold border-border py-3 shrink-0 rounded-md overflow-hidden", ...)}
```

### Summary of Changes

| File | Location | Change |
|------|----------|--------|
| `MicrocycleIntensityPlanning.tsx` | Line 156 | `120` → `140` for width calculation |
| `MicrocycleIntensityPlanning.tsx` | Line 160 | Add `overflow-hidden` to mesocycle header |
| `MicrocycleIntensityPlanning.tsx` | Line 164 | Add `flex-wrap min-w-0 px-2`, reduce `gap-2` → `gap-1.5` |
| `MicrocycleIntensityColumn.tsx` | Line 136 | `w-[120px]` → `w-[140px]` |
| `MicrocycleIntensityColumn.tsx` | Line 237 | `w-[120px]` → `w-[140px]` |

### Why 140px?
- 120px was too tight for mesocycle names + badges
- 140px provides comfortable padding for:
  - "Mesocycle 3" (≈75px)
  - "DELOAD" badge (≈50px)
  - Gap and icon (≈15px)
- Still keeps the overall view compact

### Testing
After implementation:
1. Create a plan with 3+ mesocycles where one has only 1 microcycle
2. Verify all mesocycle headers are fully visible without overlap
3. Verify intensity badges stay within their container
4. Verify the scrollable area still works correctly

