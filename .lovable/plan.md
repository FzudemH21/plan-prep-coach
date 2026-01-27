

## Plan: Revert Exercise Name Click to Open Detail Dialog Instead of Change Exercise

### Summary
Revert the exercise name click behavior to open the **Exercise Detail Dialog** (which allows viewing and editing exercise metadata) instead of the Change Exercise popup. Keep the "Change Exercise" option in the three-dot dropdown menu.

---

### Problem with Current Implementation
- Clicking exercise name opens "Change Exercise" popup
- This removes quick access to exercise details (video, description, characteristics)
- Viewing details is more common than changing exercises

### Improved UX Pattern
- **Click on exercise name** → Opens Exercise Detail Dialog (view mode with edit option)
- **Three-dot menu "Change Exercise"** → Opens change exercise popup (deliberate action)

---

### Changes Required

#### 1. WorkoutExerciseCard.tsx
**Remove:** The `Popover` wrapper around exercise name that triggers `ExerciseChangePopup`

**Change from:**
```tsx
{onChangeExercise ? (
  <Popover open={isChangePopoverOpen} onOpenChange={setIsChangePopoverOpen}>
    <PopoverTrigger asChild>
      <h4 className="font-medium text-primary hover:underline cursor-pointer">
        {exercise.exerciseName}
      </h4>
    </PopoverTrigger>
    <PopoverContent ...>
      <ExerciseChangePopup ... />
    </PopoverContent>
  </Popover>
) : (
  <h4 onClick={() => onOpenDetail?.()}>
    {exercise.exerciseName}
  </h4>
)}
```

**Change to:**
```tsx
<h4 
  className={`font-medium ${onOpenDetail ? 'text-primary hover:underline cursor-pointer' : ''}`}
  onClick={() => onOpenDetail?.()}
>
  {exercise.exerciseName}
</h4>
```

This restores clicking the exercise name to open the detail dialog. The "Change Exercise" option remains in the three-dot menu.

---

#### 2. MasterPlannerColumn.tsx (Sectioned Exercises)
**Remove:** The `Popover` wrapper around exercise name at lines 1264-1285

**Change from:**
```tsx
<Popover>
  <PopoverTrigger asChild>
    <button className="font-semibold truncate flex-1 text-left hover:underline cursor-pointer">
      {exercise.exerciseName}
    </button>
  </PopoverTrigger>
  <PopoverContent ...>
    <ExerciseChangePopup ... />
  </PopoverContent>
</Popover>
```

**Change to:**
```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    onOpenExerciseDetail?.({...exercise});
  }}
  className="font-semibold truncate flex-1 text-left hover:underline cursor-pointer"
>
  {exercise.exerciseName}
</button>
```

The "Change Exercise" option remains in the three-dot dropdown menu (lines 1327-1340).

---

#### 3. MasterPlannerColumn.tsx (Unsectioned Exercises)
**Same change** for unsectioned exercises at line ~1473

---

### Files to Modify

| File | Changes |
|------|---------|
| `WorkoutExerciseCard.tsx` | Remove Popover around exercise name, restore `onOpenDetail` click handler |
| `MasterPlannerColumn.tsx` | Remove Popover around exercise names (both sectioned and unsectioned), use `onOpenExerciseDetail` callback |

---

### What Stays the Same
- ✅ Three-dot menu "Change Exercise" option (opens full library popup)
- ✅ Exercise Detail Dialog functionality (view mode with edit button)
- ✅ All synchronization logic for exercise changes
- ✅ All parameter preservation when changing exercises

---

### Visual Result

**Before:**
- Click exercise name → Change Exercise popup (loses access to details)

**After:**
- Click exercise name → Exercise Detail Dialog (view video, description, edit capabilities)
- Three-dot menu → "Change Exercise" option (for deliberate exercise swaps)

This restores the intuitive pattern where clicking an exercise shows its details, while replacing it is a deliberate action through the menu.

