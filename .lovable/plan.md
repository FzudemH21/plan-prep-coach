

## Add Section Deletion Confirmation and Simplify UI

### Overview

Three changes to SessionColumnView.tsx:
1. Remove exercise deletion confirmation dialog (delete directly)
2. Remove section exercise count badge
3. Add section deletion confirmation dialog

---

### Changes

**File**: `src/components/microcycle-planning/SessionColumnView.tsx`

#### Change 1: Remove Exercise Deletion Confirmation

**Remove** these items:
- State: `deleteDialogOpen` and `exerciseToDelete` (lines 121-122)
- Function: `handleDeleteExerciseClick` (lines 173-176)
- Function: `confirmDeleteExercise` (lines 178-184)
- AlertDialog for exercise deletion (lines 820-833)

**Update** the delete dropdown item to call `onDeleteExercise` directly instead of `handleDeleteExerciseClick`

---

#### Change 2: Remove Section Exercise Count Badge

**Remove** the Badge component showing exercise count from section headers (lines 674-676)

---

#### Change 3: Add Section Deletion Confirmation Dialog

**Add** new state for section deletion:
```tsx
const [deleteSectionDialogOpen, setDeleteSectionDialogOpen] = useState(false);
const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
```

**Update** the section delete button (line 703) to open dialog:
```tsx
onClick={() => {
  setSectionToDelete(section.id);
  setDeleteSectionDialogOpen(true);
}}
```

**Add** confirmation handler:
```tsx
const confirmDeleteSection = () => {
  if (sectionToDelete) {
    onDeleteSection(sectionToDelete);
  }
  setSectionToDelete(null);
  setDeleteSectionDialogOpen(false);
};
```

**Add** AlertDialog for section deletion (after the session delete dialog):
```tsx
<AlertDialog open={deleteSectionDialogOpen} onOpenChange={setDeleteSectionDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Section</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete this section? All exercises in this section will also be removed.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDeleteSection}>
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### Summary

| Item | Action |
|------|--------|
| Exercise deletion confirmation | Remove (delete directly) |
| Section exercise count badge | Remove |
| Section deletion confirmation | Add new dialog |
| Session deletion confirmation | Keep (no change) |

---

### Visual Result

**Section Header Before:**
```
[▼] [↑↓] Section 1  [3]  [📋] [✏️] [🗑️]
```

**Section Header After:**
```
[▼] [↑↓] Section 1  [📋] [✏️] [🗑️]
```

- Clicking trash on exercise dropdown: Deletes immediately
- Clicking trash on section header: Shows confirmation dialog
- Clicking trash on session header: Shows confirmation dialog (existing)

