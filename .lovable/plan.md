

## Visual Improvements for Step 1 of Microcycle Planning

### Overview

Three improvements to make Step 1 of Microcycle Planning visually consistent and more user-friendly:

1. **Header Styling**: Change mesocycle and microcycle headers from solid color fill to transparent intensity-tinted backgrounds with colored intensity badges (matching Step 2 of Mesocycle Planning)
2. **Dynamic Height**: Make the content area adapt to actual content height instead of using a fixed viewport calculation
3. **Sticky Header Icons**: Keep mesocycle/microcycle header icons visible when scrolling horizontally

---

### Issue 1: Header Color Styling

**Current State (Step 1 Microcycle Planning)**:
- Mesocycle header uses `getIntensityColor(mesocycle.intensity)` - a solid color fill
- Microcycle headers use `getIntensityColor(microcycle.intensity)` - solid color fill

**Target State (matching Step 2 Mesocycle Planning)**:
- Headers use subtle transparent background: `getSubtleIntensityBg(intensity)` (~15% opacity tint)
- Intensity shown via a separate colored badge button

**Files to Modify**: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

**Changes**:

1. Add `getSubtleIntensityBg` helper function (same as in MesocyclePage.tsx)
2. Update mesocycle header (line ~1958):
   - Change from: `getIntensityColor(mesocycle.intensity)`
   - To: `getSubtleIntensityBg(mesocycle.intensity)` with `rounded-md border border-border`
3. Update microcycle headers (line ~2031-2035):
   - Change from: `getIntensityColor(microcycle.intensity)`  
   - To: `getSubtleIntensityBg(microcycle.intensity)` with `rounded-md border border-border`

---

### Issue 2: Dynamic Content Height

**Current State**:
- Container uses fixed height: `h-[calc(100vh-200px)]` (MicrocyclePlanningPage.tsx line 3036)
- Forces scrollbar to bottom of fixed container regardless of content

**Target State**:
- Content area should use minimum height but grow with content
- Horizontal scrollbar should appear at the natural bottom of the content

**File to Modify**: `src/pages/MicrocyclePlanningPage.tsx`

**Changes**:

1. Change the container from fixed height to flexible with maximum:
   - From: `h-[calc(100vh-200px)]`
   - To: `min-h-[400px] max-h-[calc(100vh-200px)] overflow-y-auto`

2. Update `EnhancedExerciseDistribution.tsx` inner container:
   - Change from: `h-full overflow-x-auto p-4`
   - To: `overflow-x-auto p-4` (remove fixed height constraint)

---

### Issue 3: Sticky Header Icons

**Current State**:
- Icons (copy, trash) in mesocycle/microcycle headers scroll away horizontally
- User must scroll all the way right to access them

**Target State**:
- Icons should remain visible on the right edge of the viewport during horizontal scroll
- Once the natural position is reached, icons stay in place

**Approach**:
This requires restructuring the header to have a sticky icon container. The icons would be placed in a separate element that uses `position: sticky` with `right: 0`.

**File to Modify**: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

**Changes**:

1. For mesocycle header (lines ~1958-2013):
   - Split the header into two parts: content (name, badge, dates) and icons
   - Make icons container sticky: `sticky right-4 z-10`
   
2. For microcycle headers (lines ~2016-2089):
   - Similarly, extract icons into a sticky container that stays on the right
   - Use `position: sticky; right: 0` styling

**Visual Structure**:
```text
+--------------------------------------------------+
| [Mesocycle Name] [INTENSITY BADGE]    [📋][🗑️]   | <- Icons stick to right
+--------------------------------------------------+
| [Micro 1] [BADGE] [📋][🗑️] | [Micro 2] [BADGE] [📋][🗑️] |
+--------------------------------------------------+
```

When scrolling horizontally:
```text
       scroll container viewport
      +------------------------+
      | ... | [Micro 3] [📋][🗑️]|  <- Icons stay visible
      +------------------------+
```

---

### Technical Implementation Details

#### New Helper Function for EnhancedExerciseDistribution.tsx

```typescript
// Add near top of component, after formatIntensityLabel
const getSubtleIntensityBg = (intensity: IntensityLevel): string => {
  const bgMappings: Record<IntensityLevel, string> = {
    "off": "bg-[hsl(var(--intensity-off)/0.15)]",
    "deload": "bg-[hsl(var(--intensity-deload)/0.15)]",
    "easy": "bg-[hsl(var(--intensity-easy)/0.15)]",
    "easy-moderate": "bg-[hsl(var(--intensity-easy-moderate)/0.15)]",
    "moderate": "bg-[hsl(var(--intensity-moderate)/0.15)]",
    "moderate-hard": "bg-[hsl(var(--intensity-moderate-hard)/0.15)]",
    "hard": "bg-[hsl(var(--intensity-hard)/0.15)]",
    "extremely-hard": "bg-[hsl(var(--intensity-extremely-hard)/0.20)]"
  };
  return bgMappings[intensity] || "bg-primary/10";
};
```

#### Updated Mesocycle Header Structure

```tsx
<div className={cn(
  "mb-4 border rounded-md pb-3 relative",
  getSubtleIntensityBg(mesocycle.intensity)
)}>
  <div className="flex items-center justify-between px-4">
    {/* Content: Name and badge */}
    <div className="flex-1 flex items-center justify-center gap-3">
      <h2 className="text-xl font-bold">{mesocycle.name}</h2>
      <Badge variant="secondary" className={cn("font-semibold", getIntensityColor(mesocycle.intensity))}>
        {formatIntensityLabel(mesocycle.intensity)}
      </Badge>
    </div>
    
    {/* Sticky Icons */}
    <div className="sticky right-4 flex items-center gap-1 z-10 bg-background/80 rounded p-1">
      {/* Copy button */}
      {/* Trash button */}
    </div>
  </div>
  {/* Date range */}
</div>
```

#### Updated Microcycle Header Structure

```tsx
<div className={cn(
  "relative shrink-0 text-center font-semibold py-3 rounded-md border border-border",
  getSubtleIntensityBg(microcycle.intensity)
)}>
  <div className="flex items-center justify-center gap-2">
    <span>{microcycle.name}</span>
    <Badge variant="secondary" className={cn("font-semibold", getIntensityColor(microcycle.intensity))}>
      {formatIntensityLabel(microcycle.intensity)}
    </Badge>
    {/* Icons in same row but with sticky positioning */}
    <div className="flex items-center gap-1">
      {/* Copy/Trash buttons */}
    </div>
  </div>
</div>
```

---

### Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `EnhancedExerciseDistribution.tsx` | Add `getSubtleIntensityBg` helper | Enable transparent intensity backgrounds |
| `EnhancedExerciseDistribution.tsx` | Update mesocycle header styling | Transparent bg + colored badge |
| `EnhancedExerciseDistribution.tsx` | Update microcycle header styling | Transparent bg + colored badge |
| `EnhancedExerciseDistribution.tsx` | Remove `h-full` from scroll container | Allow dynamic height |
| `EnhancedExerciseDistribution.tsx` | Restructure icon containers | Enable sticky positioning |
| `MicrocyclePlanningPage.tsx` | Change fixed height to flexible | Dynamic content height |

### Visual Result

- Headers will have subtle transparent backgrounds matching Step 2 of Mesocycle Planning
- Intensity shown via distinct colored badges inside the header
- Content area adjusts to actual content, scrollbar more accessible
- Icons remain visible during horizontal scrolling

