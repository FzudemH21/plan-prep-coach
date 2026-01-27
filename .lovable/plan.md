

## Fix: Icon Style Updates and Cleanup in Mesocycle Planning Steps

### Issues to Address

1. **Remove Speaker Bubble Icon (Step 1 Mesocycle Planning - Mesocycle Setup)**
   - The `MessageSquare` icon appears in mesocycle headers but has no functionality
   - Located in `src/components/mesocycle/MicrocycleIntensityPlanning.tsx` line 206

2. **Update Microcycle Copy/Trash Icons to Ghost Style (Step 2 Mesocycle Planning - Daily Training Intensity)**
   - Currently using solid white background with dark border (`bg-white border-2 border-gray-800`)
   - Should use transparent ghost variant like in Step 1 microcycle planning
   - Located in `src/pages/MesocyclePage.tsx` lines 4896-4907 (copy) and 4911-4922 (trash)

3. **Update Mesocycle Copy Icon to Ghost Style and Reposition (Step 2 Mesocycle Planning - Daily Training Intensity)**
   - Currently using solid style and positioned separately from trash icon
   - Should use ghost variant and be positioned to the left of the trash icon
   - Located in `src/pages/MesocyclePage.tsx` lines 4793-4809

---

### Implementation Details

#### File 1: `src/components/mesocycle/MicrocycleIntensityPlanning.tsx`

**Change 1: Remove MessageSquare icon (line 206)**

Delete this line entirely:
```tsx
<MessageSquare className="h-3 w-3 text-muted-foreground" />
```

Also update the import to remove `MessageSquare` (line 8):
```tsx
// BEFORE
import { Copy, MessageSquare } from 'lucide-react';

// AFTER
import { Copy } from 'lucide-react';
```

---

#### File 2: `src/pages/MesocyclePage.tsx`

**Change 2: Update Mesocycle Header - Move Copy Icon Next to Trash and Use Ghost Style**

Current structure:
- Trash icon is inside the header row at line 4772-4783
- Copy icon is in a separate absolute positioned div at lines 4793-4809

New structure:
- Move copy icon to be immediately before the trash icon (inside the same flex container)
- Both use ghost variant with consistent styling

```tsx
// Add copy icon BEFORE trash icon, remove separate absolute-positioned copy button
{currentMesocycleIndexDailyPlanning > 0 && (
  <Button
    size="sm"
    variant="ghost"
    onClick={(e) => {
      e.stopPropagation();
      copyMesocycleDailyIntensity(currentMeso.id);
    }}
    className="h-6 w-6 p-0"
    title="Copy daily intensity pattern from previous mesocycle"
  >
    <Copy className="h-3 w-3" />
  </Button>
)}
<Button
  size="sm"
  variant="ghost"
  onClick={(e) => {
    e.stopPropagation();
    clearMesocycleDailyIntensity(currentMeso.id);
  }}
  className="h-6 w-6 p-0"
  title={`Clear all daily intensities for ${currentMeso.name}`}
>
  <Trash2 className="h-3 w-3" />
</Button>
```

---

**Change 3: Update Microcycle Copy Button to Ghost Style (lines 4896-4907)**
```tsx
// BEFORE
<Button
  size="sm"
  variant="secondary"
  className="h-5 w-5 p-0 bg-white hover:bg-white/95 shadow-md border-2 border-gray-800"
>
  <Copy className="h-3 w-3 text-gray-800" />
</Button>

// AFTER
<Button
  size="sm"
  variant="ghost"
  className="h-6 w-6 p-0"
>
  <Copy className="h-3 w-3" />
</Button>
```

---

**Change 4: Update Microcycle Trash Button to Ghost Style (lines 4911-4922)**
```tsx
// BEFORE
<Button
  size="sm"
  variant="secondary"
  className="h-5 w-5 p-0 bg-white hover:bg-white/95 shadow-md border-2 border-gray-800"
>
  <Trash2 className="h-3 w-3 text-gray-800" />
</Button>

// AFTER
<Button
  size="sm"
  variant="ghost"
  className="h-6 w-6 p-0"
>
  <Trash2 className="h-3 w-3" />
</Button>
```

---

### Summary of Changes

| File | Location | Change |
|------|----------|--------|
| `MicrocycleIntensityPlanning.tsx` | Line 8 | Remove `MessageSquare` from import |
| `MicrocycleIntensityPlanning.tsx` | Line 206 | Delete `MessageSquare` icon |
| `MesocyclePage.tsx` | Lines 4771-4783 | Add copy icon before trash, both use ghost variant |
| `MesocyclePage.tsx` | Lines 4793-4809 | Remove separate absolute-positioned copy button |
| `MesocyclePage.tsx` | Lines 4896-4907 | Change microcycle copy to ghost variant |
| `MesocyclePage.tsx` | Lines 4911-4922 | Change microcycle trash to ghost variant |

### Visual Result

**Step 1 Mesocycle Planning (Microcycle Intensity Configuration):**
- Mesocycle headers will no longer show the speaker bubble icon
- Copy icons remain as ghost style (already correct from previous update)

**Step 2 Mesocycle Planning (Daily Training Intensity):**
- Mesocycle headers: Copy icon appears to the left of trash icon, both using ghost style
- Microcycle headers: Both copy and trash icons use ghost style instead of solid white with dark border

All icons will now have consistent styling:
- Default: Transparent background with gray icon
- Hover: Subtle light background with slightly darker icon

