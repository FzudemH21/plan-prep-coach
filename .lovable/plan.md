

## Fix "No Programs Available" Issue and Dialog Overlay Styling

### Issue 1: Programs Not Showing

**Root Cause**: There's a data structure mismatch:
- When mesocycle data is saved during planning, it's stored as `{ mesocycles: [...] }` (an object with a `mesocycles` property)
- The AssignProgramDialog filter expects `mesocycleData` to be a direct array

**Location**: `src/components/athletes/AssignProgramDialog.tsx`

**Current code (line 243)**:
```tsx
const availablePrograms = programs.filter(p => p.mesocycleData && Array.isArray(p.mesocycleData) && p.mesocycleData.length > 0);
```

**Fixed code**:
```tsx
const availablePrograms = programs.filter(p => {
  if (!p.mesocycleData) return false;
  // Handle both formats: direct array or { mesocycles: [...] } object
  const mesocycles = Array.isArray(p.mesocycleData) 
    ? p.mesocycleData 
    : p.mesocycleData.mesocycles;
  return Array.isArray(mesocycles) && mesocycles.length > 0;
});
```

**Also update parsing (lines 83-87)**:
```tsx
const programMesocycles = useMemo((): AssignedMesocycle[] => {
  if (!selectedProgram?.mesocycleData) return [];
  
  // Handle both formats: direct array or { mesocycles: [...] } object
  const mesoData = Array.isArray(selectedProgram.mesocycleData) 
    ? selectedProgram.mesocycleData 
    : selectedProgram.mesocycleData.mesocycles;
    
  if (!Array.isArray(mesoData)) return [];
  // ... rest of the function
```

---

### Issue 2: Dialog Overlay Cut Off

**Root Cause**: Looking at the screenshot, the dialog background overlay appears to be cut off on the left and right sides. This is because the dialog is rendered inside a parent component that may have overflow constraints.

**Solution**: Ensure the `DialogOverlay` uses `inset-0` properly and has no margin/padding issues.

**Location**: `src/components/ui/dialog.tsx` (line 22)

The current overlay class is:
```tsx
"fixed inset-0 z-[100] bg-black/80 ..."
```

The issue might be that the preview is showing a scrollbar that makes the overlay not cover the full viewport. We should ensure `overflow-x: hidden` on the body when dialog is open, or add `overflow: hidden` to the html element. 

However, a simpler fix is to increase the overlay coverage with explicit width/height:

**Current code (line 22)**:
```tsx
className={cn(
  "fixed inset-0 z-[100] bg-black/80  data-[state=open]:animate-in ...",
  className
)}
```

**Fixed code**:
```tsx
className={cn(
  "fixed inset-0 z-[100] bg-black/80 w-screen h-screen data-[state=open]:animate-in ...",
  className
)}
```

This explicitly ensures the overlay covers the full viewport width and height.

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/athletes/AssignProgramDialog.tsx` | Fix mesocycleData parsing to handle `{ mesocycles: [...] }` object format |
| `src/components/ui/dialog.tsx` | Add `w-screen h-screen` to DialogOverlay for full viewport coverage |

