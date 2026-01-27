

## Session and Section Management Improvements for Step 1 of Microcycle Planning

### Overview

This plan addresses five improvements to the session and section management UI in Step 1 of Microcycle Planning:

1. Remove the redundant "Drag exercises here" empty state
2. Delete exercises when their parent section is deleted
3. Add confirmation dialog for session deletion
4. Replace section drag handle with arrow buttons for reordering
5. Make sections collapsible

---

### Changes Summary

| Component | Change |
|-----------|--------|
| `SessionColumnView.tsx` | Main component receiving all UI updates |
| `EnhancedExerciseDistribution.tsx` | Add section reorder handler, pass new props |

---

### Change 1: Remove Redundant "Drag exercises here" Drop Zone

**Problem**: When a session has no exercises, a large "Drag exercises here" drop zone is shown. However, since dragging an exercise automatically creates a section, and there's already a "Drop to create new section" zone, this is redundant.

**Solution**: Remove the empty state drop zone (lines 574-593). The "Drop to create new section" zone (lines 737-757) already handles this case elegantly.

**File**: `src/components/microcycle-planning/SessionColumnView.tsx`

```tsx
// REMOVE this entire block (lines 574-593):
{/* Empty state when no exercises at all */}
{exercises.length === 0 && (
  <Droppable droppableId={`session-${day.date}::${sessionIndex}`} type="EXERCISE">
    ...
  </Droppable>
)}
```

---

### Change 2: Delete Exercises When Section is Deleted

**Problem**: Currently, when a section is deleted, exercises in that section have their `sectionId` cleared but remain in the session. This is confusing.

**Solution**: Modify `handleDeleteSection` to also remove all exercises that belong to the deleted section, plus clean up any supersets involving those exercises.

**File**: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

```tsx
// BEFORE (lines 1310-1322):
const handleDeleteSection = (sectionId: string) => {
  // Remove section
  const updated = sessionSections.filter(s => s.id !== sectionId);
  onSectionsChange(updated);

  // Clear sectionId from exercises
  const updatedExercises = exerciseDistribution.map(ex =>
    ex.sectionId === sectionId ? { ...ex, sectionId: undefined } : ex
  );
  onDistributionChange(updatedExercises);

  toast({ title: 'Section deleted', description: 'Section removed' });
};

// AFTER:
const handleDeleteSection = (sectionId: string) => {
  // Find section to get dayDate and sessionIndex for superset cleanup
  const section = sessionSections.find(s => s.id === sectionId);
  
  // Get all exercises in this section
  const exercisesInSection = exerciseDistribution.filter(ex => ex.sectionId === sectionId);
  const exerciseIdsToDelete = exercisesInSection.map(ex => ex.id);
  
  // Remove the section
  const updatedSections = sessionSections.filter(s => s.id !== sectionId);
  onSectionsChange(updatedSections);

  // Remove all exercises in the section (not just clear sectionId)
  const updatedExercises = exerciseDistribution.filter(ex => ex.sectionId !== sectionId);
  onDistributionChange(updatedExercises);
  
  // Clean up supersets for deleted exercises
  if (section) {
    let updatedSupersets = { ...supersets };
    for (const exerciseId of exerciseIdsToDelete) {
      updatedSupersets = cleanupSupersetsOnExerciseDelete(updatedSupersets, exerciseId);
    }
    onSupersetsChange(updatedSupersets);
  }

  const exerciseCount = exercisesInSection.length;
  toast({ 
    title: 'Section deleted', 
    description: exerciseCount > 0 
      ? `Section and ${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} removed` 
      : 'Section removed' 
  });
};
```

---

### Change 3: Add Confirmation Dialog for Session Deletion

**Problem**: Sessions can be deleted with a single click, which is too easy to do accidentally.

**Solution**: Add an AlertDialog for session deletion, similar to the existing exercise deletion dialog.

**File**: `src/components/microcycle-planning/SessionColumnView.tsx`

Add new state for session delete confirmation:
```tsx
const [deleteSessionDialogOpen, setDeleteSessionDialogOpen] = useState(false);
```

Update the delete button to open dialog instead of directly deleting:
```tsx
// BEFORE (lines 456-465):
{onRemoveSession && (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 w-6 p-0 text-destructive hover:bg-accent"
    onClick={() => onRemoveSession(day.date, sessionIndex)}
  >
    <Trash2 className="h-3.5 w-3.5" />
  </Button>
)}

// AFTER:
{onRemoveSession && (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 w-6 p-0 text-destructive hover:bg-accent"
    onClick={() => setDeleteSessionDialogOpen(true)}
  >
    <Trash2 className="h-3.5 w-3.5" />
  </Button>
)}
```

Add a new AlertDialog at the end of the component (after the existing exercise delete dialog):
```tsx
<AlertDialog open={deleteSessionDialogOpen} onOpenChange={setDeleteSessionDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Session</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete "{sessionName}"? This will remove all exercises and sections in this session.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction 
        onClick={() => {
          onRemoveSession?.(day.date, sessionIndex);
          setDeleteSessionDialogOpen(false);
        }}
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### Change 4: Replace Section Drag Handle with Arrow Buttons

**Problem**: The GripVertical drag handle for sections doesn't work and is confusing.

**Solution**: Replace the drag handle with up/down arrow buttons, following the Master Planner pattern.

**File**: `src/components/microcycle-planning/SessionColumnView.tsx`

Add new prop for section reordering:
```tsx
// In props interface:
onReorderSection?: (sectionId: string, direction: 'up' | 'down') => void;
```

Replace GripVertical with arrow buttons in the section header (around line 640-646):
```tsx
// BEFORE:
<div className="flex items-center gap-2">
  <GripVertical className="h-4 w-4 text-muted-foreground" />
  <span className="text-sm font-semibold">{section.name}</span>
  ...
</div>

// AFTER:
<div className="flex items-center gap-2">
  {/* Arrow buttons for reordering - only show when multiple sections */}
  {exercisesBySection.sortedSections.length > 1 && (
    <div className="flex items-center gap-0.5">
      {index > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => onReorderSection?.(section.id, 'up')}
          title="Move section up"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
      )}
      {index < exercisesBySection.sortedSections.length - 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => onReorderSection?.(section.id, 'down')}
          title="Move section down"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
      )}
    </div>
  )}
  <span className="text-sm font-semibold">{section.name}</span>
  ...
</div>
```

**File**: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

Add section reorder handler (similar to TrainingCalendarView):
```tsx
const handleSectionReorder = (sectionId: string, direction: 'up' | 'down') => {
  const section = sessionSections.find(s => s.id === sectionId);
  if (!section) return;
  
  const { dayDate, sessionIndex } = section;
  
  // Get sections for this specific session, sorted by order
  const sessionSpecificSections = sessionSections
    .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)
    .sort((a, b) => a.order - b.order);
  
  // Find current section index
  const currentIndex = sessionSpecificSections.findIndex(s => s.id === sectionId);
  if (currentIndex < 0) return;
  
  // Calculate new index
  const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (newIndex < 0 || newIndex >= sessionSpecificSections.length) return;
  
  // Swap sections
  const reordered = [...sessionSpecificSections];
  [reordered[currentIndex], reordered[newIndex]] = [reordered[newIndex], reordered[currentIndex]];
  
  // Reassign order values
  const reorderedWithOrder = reordered.map((s, idx) => ({ ...s, order: idx }));
  
  // Update sessionSections state (keep other sessions' sections unchanged)
  const otherSections = sessionSections.filter(
    s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
  );
  onSectionsChange([...otherSections, ...reorderedWithOrder]);
  
  toast({ title: "Section reordered" });
};
```

Pass the handler to SessionColumnView:
```tsx
<SessionColumnView
  ...
  onReorderSection={handleSectionReorder}
/>
```

---

### Change 5: Make Sections Collapsible

**Problem**: Sections cannot be collapsed, making it hard to get an overview when there are many exercises.

**Solution**: Add collapse/expand functionality with an arrow icon in the section header.

**File**: `src/components/microcycle-planning/SessionColumnView.tsx`

Add state for collapsed sections:
```tsx
const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

const toggleSectionCollapse = (sectionId: string) => {
  setCollapsedSections(prev => ({
    ...prev,
    [sectionId]: !prev[sectionId]
  }));
};
```

Add collapse button and conditional content rendering:
```tsx
// In section header, add ChevronRight/ChevronDown toggle:
<div className="flex items-center gap-2">
  <Button
    variant="ghost"
    size="sm"
    className="h-5 w-5 p-0"
    onClick={() => toggleSectionCollapse(section.id)}
  >
    {collapsedSections[section.id] 
      ? <ChevronRight className="h-4 w-4" /> 
      : <ChevronDown className="h-4 w-4" />
    }
  </Button>
  {/* Arrow buttons */}
  ...
  <span className="text-sm font-semibold">{section.name}</span>
  ...
</div>

// Wrap section content (notes + exercises) in conditional:
{!collapsedSections[section.id] && (
  <div className="p-3 space-y-2">
    {/* Section Comments */}
    ...
    {/* Section exercises droppable area */}
    ...
  </div>
)}
```

Import the ChevronRight and ChevronDown icons at the top of the file.

---

### Visual Result

**Before:**
```
┌──────────────────────────────────────┐
│ Session 1                    ✏️ 📋 🗑️ │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │      Drag exercises here         │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ + Drop to create new section     │ │
│ └──────────────────────────────────┘ │
│ [+ Add Section]                      │
└──────────────────────────────────────┘
```

**After:**
```
┌──────────────────────────────────────┐
│ Session 1                    ✏️ 📋 🗑️ │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ + Drop to create new section     │ │
│ └──────────────────────────────────┘ │
│ [+ Add Section]                      │
└──────────────────────────────────────┘

With sections:
┌──────────────────────────────────────┐
│ ▼ ↑↓ Section 1 (3)         📋 ✏️ 🗑️ │
│ ├─ Section Notes...                  │
│ ├─ Exercise 1                        │
│ ├─ Exercise 2                        │
│ └─ Exercise 3                        │
├──────────────────────────────────────┤
│ ▶ ↑↓ Section 2 (2)         📋 ✏️ 🗑️ │  ← Collapsed
└──────────────────────────────────────┘
```

---

### Technical Details

**Files Modified:**
1. `src/components/microcycle-planning/SessionColumnView.tsx`
   - Remove "Drag exercises here" empty state drop zone
   - Add session delete confirmation dialog state and AlertDialog
   - Add collapsed sections state and toggle function
   - Replace GripVertical with ChevronRight/ChevronDown + ArrowUp/ArrowDown buttons
   - Add new prop `onReorderSection`
   - Import `ChevronRight`, `ChevronDown` icons

2. `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`
   - Modify `handleDeleteSection` to delete exercises (not just clear sectionId) and clean up supersets
   - Add `handleSectionReorder` function
   - Pass `onReorderSection` prop to SessionColumnView

---

### Edge Cases Handled

1. **Single section**: Arrow buttons hidden when only one section exists
2. **First/last section**: Only show relevant arrow (down for first, up for last)
3. **Empty section deletion**: Shows simplified toast message
4. **Superset cleanup**: When section with supersetted exercises is deleted, supersets are properly cleaned up
5. **Session with exercises**: Confirmation dialog shows warning about exercise removal

