
## Plan: Fix Search Input Clipping and Add Change Exercise to Master Planner

### Summary
Two main changes:
1. Fix the focus ring clipping at the top of the search input in `ExerciseChangePopup`
2. Add "Change Exercise" functionality to the Master Planner - both via clicking exercise name (popup) and via three-dot menu

---

### Part 1: Fix Focus Ring Clipping (Top)

The focus ring is now being clipped at the top. The fix is to add vertical padding (`py-1`) to the inner wrapper so the focus ring has room to render above and below the input.

**File**: `src/components/microcycle-planning/ExerciseChangePopup.tsx`

Current (line 135-146):
```tsx
<div className="px-2 py-2 border-b">
  <div className="relative px-1">
    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input .../>
  </div>
</div>
```

After:
```tsx
<div className="px-2 py-2 border-b">
  <div className="relative px-1 py-1">
    <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
    <Input .../>
  </div>
</div>
```

The `py-1` adds vertical padding, and the search icon moves from `top-2.5` to `top-3.5` to stay centered.

---

### Part 2: Add Change Exercise to Master Planner

#### 2a. Add New Prop to MasterPlannerColumn

Add a callback prop for changing exercises:

```typescript
interface MasterPlannerColumnProps {
  // ... existing props
  onExerciseChange?: (
    dayDate: string, 
    sessionIndex: number, 
    sectionId: string, 
    exerciseId: string, 
    newExercise: { exerciseId: string; exerciseName: string; libraryId: string }
  ) => void;
}
```

#### 2b. Wrap Exercise Name in Popover (Sectioned Exercises)

**Location**: Lines 1246-1254

Transform the exercise name `<button>` into a `Popover` with `ExerciseChangePopup`:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <button
      className="font-semibold truncate flex-1 text-left hover:underline cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    >
      {exercise.exerciseName}
    </button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0 z-[300]" align="start">
    <ExerciseChangePopup
      onSelect={(newEx) => onExerciseChange?.(
        day.dateString, 
        session.sessionIndex, 
        section.id, 
        exercise.exerciseId, 
        newEx
      )}
      currentExerciseId={exercise.exerciseId}
    />
  </PopoverContent>
</Popover>
```

#### 2c. Wrap Exercise Name in Popover (Unsectioned Exercises)

**Location**: Line 1473

Same pattern for unsectioned exercises:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <button className="font-semibold truncate flex-1 text-left hover:underline cursor-pointer">
      {exercise.exerciseName}
    </button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0 z-[300]" align="start">
    <ExerciseChangePopup
      onSelect={(newEx) => onExerciseChange?.(
        day.dateString, 
        session.sessionIndex, 
        '', 
        exercise.exerciseId, 
        newEx
      )}
      currentExerciseId={exercise.exerciseId}
    />
  </PopoverContent>
</Popover>
```

#### 2d. Add "Change Exercise" to Three-Dot Menu (Sectioned)

**Location**: Lines 1295-1315

Add before "Duplicate":

```tsx
<DropdownMenuContent align="end" className="z-[300] bg-background border">
  <DropdownMenuItem
    onClick={(e) => {
      e.stopPropagation();
      // Open full library popup for change
      setChangeExerciseTarget({ dayDate, sessionIndex, sectionId, exerciseId });
    }}
  >
    <RefreshCw className="h-3.5 w-3.5 mr-2" />
    Change Exercise
  </DropdownMenuItem>
  <DropdownMenuItem ... >Duplicate</DropdownMenuItem>
  <DropdownMenuItem ... >Delete</DropdownMenuItem>
</DropdownMenuContent>
```

#### 2e. Add "Change Exercise" to Three-Dot Menu (Unsectioned)

**Location**: Lines 1481-1501

Same pattern for unsectioned exercises.

#### 2f. Add State and Dialog for Full Library Popup

Add state to track which exercise is being changed via menu:

```typescript
const [changeExerciseTarget, setChangeExerciseTarget] = useState<{
  dayDate: string;
  sessionIndex: number;
  sectionId: string;
  exerciseId: string;
} | null>(null);
```

Render `ExerciseLibraryPopup` at the component level:

```tsx
{changeExerciseTarget && (
  <ExerciseLibraryPopup
    isOpen={!!changeExerciseTarget}
    onClose={() => setChangeExerciseTarget(null)}
    onSelectExercises={(exercises) => {
      if (exercises.length > 0) {
        onExerciseChange?.(
          changeExerciseTarget.dayDate,
          changeExerciseTarget.sessionIndex,
          changeExerciseTarget.sectionId,
          changeExerciseTarget.exerciseId,
          exercises[0]
        );
        setChangeExerciseTarget(null);
      }
    }}
    singleSelect={true}
    selectedExerciseIds={[]}
    onExerciseCreated={() => {}}
  />
)}
```

---

### Part 3: Wire Up Handler in TrainingCalendarView

The `onExerciseChange` handler needs to be implemented in `TrainingCalendarView.tsx` (which renders MasterPlannerColumn) and sync changes to:
- `exerciseDistribution` state
- `sessionSections` if needed

Handler logic:
```typescript
const handleExerciseChange = (
  dayDate: string,
  sessionIndex: number,
  sectionId: string,
  exerciseId: string,
  newExercise: { exerciseId: string; exerciseName: string; libraryId: string }
) => {
  // Update exerciseDistribution
  const updatedDistribution = exerciseDistribution.map(ex =>
    ex.exerciseId === exerciseId && ex.dayDate === dayDate && ex.sessionIndex === sessionIndex
      ? { ...ex, exerciseId: newExercise.exerciseId, exerciseName: newExercise.exerciseName }
      : ex
  );
  onDistributionChange?.(updatedDistribution);
  
  toast({ title: "Exercise Changed", description: `Changed to ${newExercise.exerciseName}` });
};
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `ExerciseChangePopup.tsx` | Add `py-1` vertical padding, adjust icon position |
| `MasterPlannerColumn.tsx` | Add `onExerciseChange` prop, wrap names in Popover, add menu items, add state for full popup |
| `TrainingCalendarView.tsx` | Implement `handleExerciseChange`, pass to MasterPlannerColumn |

---

### Visual Result

**Click on exercise name in Master Planner**:
- Opens compact popup with library tabs and search (same as Workout Session Sheet)

**Three-dot menu in Master Planner**:
- Shows "Change Exercise" option (opens full library popup)
- Existing "Duplicate" and "Delete" remain

**Search input focus**:
- Full focus ring visible on all sides (no clipping)

---

### Synchronization

Changes sync bidirectionally:
- Master Planner changes update exerciseDistribution
- exerciseDistribution syncs to Step 1 (Exercise Distribution view)
- exerciseDistribution syncs to Step 2 Calendar View (Workout Session Sheet)
