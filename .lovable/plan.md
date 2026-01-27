
## Fix: Increase Column Width and Update Copy Button Style

### Issues to Address
1. **Copy button overlapping mesocycle name**: The 140px width is still too tight for single-microcycle mesocycles with a copy button
2. **Copy button style mismatch**: The current copy button uses a lighter style, but the user wants it to match Step 2's darker border style

### Solution

#### 1. Increase microcycle width from 140px → 160px
This provides more breathing room for the header content and prevents the copy button from overlapping.

| Microcycles | Before (140px) | After (160px) |
|-------------|----------------|---------------|
| 1 | 140px | 160px |
| 4 | 560px | 640px |

#### 2. Match copy button style to Step 2
The reference screenshot shows the copy button with:
- Darker border (`border-2 border-gray-800`)
- Stronger shadow (`shadow-md`)
- Darker icon (`text-gray-800`)
- Slightly smaller (`h-5 w-5`)

### Files to Modify

**`src/components/mesocycle/MicrocycleIntensityPlanning.tsx`**:
1. Line 156: Change `140` → `160` for width calculation
2. Lines 218-229: Update copy button styling to match Step 2:
   ```
   Before: "h-6 w-6 p-0 bg-white hover:bg-white/90 shadow-sm border border-border"
   After:  "h-5 w-5 p-0 bg-white hover:bg-white/95 shadow-md border-2 border-gray-800"
   
   Icon before: "h-3 w-3 text-foreground"
   Icon after:  "h-3 w-3 text-gray-800"
   ```

**`src/components/mesocycle/MicrocycleIntensityColumn.tsx`**:
1. Line 136: Change `w-[140px]` → `w-[160px]` for column width
2. Line 237: Change `w-[140px]` → `w-[160px]` for intensity label width

### Summary of Changes

| File | Location | Change |
|------|----------|--------|
| `MicrocycleIntensityPlanning.tsx` | Line 156 | `140` → `160` (width calculation) |
| `MicrocycleIntensityPlanning.tsx` | Line 225 | Update button class to match Step 2 styling |
| `MicrocycleIntensityPlanning.tsx` | Line 228 | Update icon class to `text-gray-800` |
| `MicrocycleIntensityColumn.tsx` | Line 136 | `w-[140px]` → `w-[160px]` |
| `MicrocycleIntensityColumn.tsx` | Line 237 | `w-[140px]` → `w-[160px]` |

### Visual Result
- Single-microcycle mesocycles will have 160px width (20px more space)
- Copy button will have a more pronounced, darker border matching Step 2's style
- No more overlap between the mesocycle name and the copy button
