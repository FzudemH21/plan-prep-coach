
## Fix: Update Copy Button to Match Microcycle Planning Transparent Style

### Current Issue
The copy button in Mesocycle Step 1 was updated with a solid white background and dark border style, but the user wants it to match the microcycle planning step's **transparent ghost style**:
- Default: Transparent background with gray icon
- Hover: Subtle light background with slightly darker icon

### Reference Implementation
From `EnhancedExerciseDistribution.tsx` (lines 2048-2072), the microcycle copy button uses:
```tsx
<Button
  size="sm"
  variant="ghost"
  className="h-6 w-6 p-0"
>
  <Copy className="h-3 w-3" />
</Button>
```

This `ghost` variant provides:
- Transparent background by default
- Subtle hover effect (`hover:bg-accent hover:text-accent-foreground`)
- Icon inherits text color from parent/variant state

### Changes to Implement

**File: `src/components/mesocycle/MicrocycleIntensityPlanning.tsx`**

Update lines 218-229 to change the copy button from solid style to ghost style:

| Property | Before | After |
|----------|--------|-------|
| `variant` | `"secondary"` | `"ghost"` |
| Button `className` | `"absolute top-1 right-1 h-5 w-5 p-0 bg-white hover:bg-white/95 shadow-md border-2 border-gray-800"` | `"absolute top-1 right-1 h-6 w-6 p-0"` |
| Icon `className` | `"h-3 w-3 text-gray-800"` | `"h-3 w-3"` |

### Technical Details

The `ghost` variant from the Button component provides:
- Default: `bg-transparent` + `text-muted-foreground` (gray)
- Hover: `bg-accent` (subtle light background) + `text-accent-foreground` (darker text)

This matches exactly what the user showed in their screenshots:
1. Screenshot 1 (default): Gray transparent icon
2. Screenshot 2 (hover): White/light background with visible icon

### Summary
- Single file change: `src/components/mesocycle/MicrocycleIntensityPlanning.tsx`
- Update button variant from `secondary` to `ghost`
- Remove explicit background/border/shadow styles
- Remove explicit icon color to let it inherit from variant
- Keep size at `h-6 w-6` to match microcycle planning
