

# Plan: Clickable Intensity Badge and Session Drag-and-Drop for Athlete Calendar

## Summary

This plan adds two features to the Athlete Calendar:

1. **Clickable Intensity Badge in Calendar Overview** - The intensity square next to each day number becomes clickable, opening a popover to change the day's intensity directly from the calendar grid (without opening a session).

2. **Drag-and-Drop Sessions** - Add drag handles (grip icon) to session cards in the calendar, allowing sessions to be dragged between days, similar to the Training Calendar.

---

## Feature 1: Clickable Intensity Badge

### Current State

In `AthleteCalendarDayCell.tsx` (lines 145-154), the intensity indicator is a static `<div>`:

```tsx
{hasTraining && day.sessions[0]?.intensity && getIntensityColor && (
  <div
    className={cn(
      "w-5 h-5 rounded-sm border shrink-0",
      getIntensityColor(day.sessions[0].intensity)
    )}
    title={`Intensity: ${day.sessions[0].intensity.replace('-', ' ')}`}
  />
)}
```

### Target State

The intensity indicator becomes a clickable button wrapped in a `Popover` that displays all intensity level options. When an intensity is selected:
- The day intensity is updated via `editing.handleDayIntensityChange()`
- All single-session days have their session intensity updated automatically (bidirectional sync)
- Multi-session days only update the day intensity (session intensities remain independent)

### Implementation

**File: `src/components/athletes/AthleteCalendarDayCell.tsx`**

1. **Add new props for intensity editing**:
   - `intensityLevels?: IntensityLevel[]`
   - `onIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void`

2. **Replace the static intensity indicator** with a `Popover` component containing clickable intensity options (same UI pattern as TrainingDayCell lines 176-219).

3. **Wire up the callback** to call `onIntensityChange(day.dateString, selectedLevel)`.

**File: `src/components/athletes/AthleteCalendarWeekRow.tsx`**

Pass the new props through to `AthleteCalendarDayCell`.

**File: `src/components/athletes/AthleteCalendarView.tsx`**

Pass `intensityLevels` and `editing.handleDayIntensityChange` to the WeekRow/DayCell components.

---

## Feature 2: Drag-and-Drop Sessions

### Current State

In `AthleteCalendarDayCell.tsx`, session cards (lines 305-384) are static divs without drag-and-drop support.

### Target State

Sessions can be dragged from one day to another. The implementation mirrors TrainingCalendarView:
- Wrap the calendar with `<DragDropContext>`
- Each day cell becomes a `<Droppable>` zone
- Each session card becomes a `<Draggable>` with a grip handle icon

### Implementation

**File: `src/components/athletes/AthleteCalendarDayCell.tsx`**

1. **Add drag-and-drop imports**:
   ```tsx
   import { Droppable, Draggable, DraggableProvided, DroppableProvided } from '@hello-pangea/dnd';
   import { GripVertical } from 'lucide-react';
   ```

2. **Add props for session IDs** (needed for Draggable IDs):
   - Sessions already have `id` property, so this is available.

3. **Wrap session list in `<Droppable>`** with `droppableId={day.dateString}`.

4. **Wrap each session card in `<Draggable>`** with:
   - `draggableId={session.id}`
   - `index={idx}`
   - Drag handle using `provided.dragHandleProps` on a `<GripVertical>` icon

5. **Add click suppression after drag** (to prevent accidental session open):
   - Use a `lastDragEndTime` ref
   - Ignore clicks within 200ms of drag ending (same pattern as TrainingDayCell)

**File: `src/components/athletes/AthleteCalendarWeekRow.tsx`**

No changes needed - the DayCell handles its own droppable zones.

**File: `src/components/athletes/AthleteCalendarView.tsx`**

1. **Import DragDropContext**:
   ```tsx
   import { DragDropContext, DropResult } from '@hello-pangea/dnd';
   ```

2. **Wrap the calendar grid in `<DragDropContext>`** with an `onDragEnd` handler.

3. **Implement `handleSessionDragEnd(result: DropResult)`**:
   - Extract source day, session index, and destination day from the result
   - Move the session exercises from source to destination
   - Update `daySplitStates` for both days
   - Update `trainingDays.sessionNames` for both days

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarDayCell.tsx` | Add clickable intensity popover; add drag-and-drop with Droppable/Draggable |
| `src/components/athletes/AthleteCalendarWeekRow.tsx` | Pass through new props for intensity and drag |
| `src/components/athletes/AthleteCalendarView.tsx` | Wrap in DragDropContext; implement handleSessionDragEnd; pass intensity props |

---

## Technical Details

### Change 1: Clickable Intensity Popover (AthleteCalendarDayCell.tsx)

**New Props (add to interface ~line 54-76)**:
```tsx
intensityLevels?: IntensityLevel[];
onIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
```

**Add state for popover**:
```tsx
const [intensityPopoverOpen, setIntensityPopoverOpen] = useState(false);
```

**Get current intensity** (extract from first session):
```tsx
const currentIntensity = day.sessions[0]?.intensity || 'moderate';
```

**Replace static div with Popover** (lines 145-154):
```tsx
{getIntensityColor && intensityLevels && onIntensityChange && (
  <Popover open={intensityPopoverOpen} onOpenChange={setIntensityPopoverOpen}>
    <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
      <button 
        className={cn(
          "w-5 h-5 rounded-sm border transition-all hover:scale-110 cursor-pointer shrink-0",
          getIntensityColor(currentIntensity)
        )}
        title={`Intensity: ${currentIntensity.replace('-', ' ')}`}
      />
    </PopoverTrigger>
    <PopoverContent className="w-48 p-2 z-[100]" align="end">
      <div className="space-y-1">
        <p className="text-xs font-medium mb-2 text-muted-foreground">Select Intensity</p>
        {intensityLevels.map((level) => (
          <button
            key={level}
            onClick={(e) => {
              e.stopPropagation();
              onIntensityChange(day.dateString, level);
              setIntensityPopoverOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left",
              level === currentIntensity && "bg-accent"
            )}
          >
            <div className={cn("w-3 h-3 rounded-sm border shrink-0", getIntensityColor(level))} />
            <span className="text-xs capitalize">{level.replace('-', ' ')}</span>
          </button>
        ))}
      </div>
    </PopoverContent>
  </Popover>
)}
```

### Change 2: Drag-and-Drop Sessions (AthleteCalendarDayCell.tsx)

**New imports**:
```tsx
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
```

**Add ref for click suppression**:
```tsx
const lastDragEndTime = useRef<number>(0);
```

**Wrap session list (lines 303-401)**:
```tsx
<Droppable droppableId={day.dateString} type="session">
  {(provided, snapshot) => (
    <div
      ref={provided.innerRef}
      {...provided.droppableProps}
      className={cn("space-y-2", snapshot.isDraggingOver && "bg-primary/5 rounded-md p-1")}
    >
      {day.sessions.map((session, idx) => (
        <Draggable
          key={session.id}
          draggableId={session.id}
          index={idx}
        >
          {(provided, snapshot) => {
            if (!snapshot.isDragging && snapshot.draggingOver === null) {
              lastDragEndTime.current = Date.now();
            }
            return (
              <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                style={provided.draggableProps.style}
                onClick={(e) => {
                  e.stopPropagation();
                  if (Date.now() - lastDragEndTime.current < 200) return;
                  onSessionClick?.(day.dateString, session.sessionIndex, session.assignmentId || day.assignmentId || '');
                }}
                className={cn(
                  "p-2 rounded-md bg-primary/10 border border-primary/20 transition-all cursor-pointer hover:bg-primary/15",
                  snapshot.isDragging && "shadow-lg ring-2 ring-primary opacity-90"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {/* Drag Handle */}
                    <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                      <GripVertical className="h-3 w-3 text-muted-foreground hover:text-primary" />
                    </div>
                    <Dumbbell className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-primary truncate max-w-[100px]" title={session.sessionName}>
                      {session.sessionName}
                    </span>
                    {/* ... rest of session content ... */}
                  </div>
                </div>
              </div>
            );
          }}
        </Draggable>
      ))}
      {provided.placeholder}
    </div>
  )}
</Droppable>
```

### Change 3: DragDropContext in AthleteCalendarView.tsx

**New import**:
```tsx
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
```

**Add handler**:
```tsx
const handleSessionDragEnd = useCallback((result: DropResult) => {
  if (!result.destination) return;
  
  const sourceDayDate = result.source.droppableId;
  const destDayDate = result.destination.droppableId;
  const sourceIndex = result.source.index;
  const destIndex = result.destination.index;
  
  // Same day reorder
  if (sourceDayDate === destDayDate && sourceIndex === destIndex) return;
  
  // Get source exercises for this session
  const sourceExercises = editing.exerciseDistribution.filter(
    ex => ex.dayDate === sourceDayDate && ex.sessionIndex === sourceIndex
  );
  
  if (sourceExercises.length === 0) return;
  
  // Update exercise distribution
  const newDistribution = editing.exerciseDistribution.map(ex => {
    if (ex.dayDate === sourceDayDate && ex.sessionIndex === sourceIndex) {
      return { ...ex, dayDate: destDayDate, sessionIndex: destIndex };
    }
    return ex;
  });
  editing.setExerciseDistribution(newDistribution);
  
  // Update daySplitStates
  const newDaySplitStates = { ...editing.daySplitStates };
  
  // Decrement source day (or remove if 0)
  if (newDaySplitStates[sourceDayDate]) {
    newDaySplitStates[sourceDayDate] = Math.max(0, newDaySplitStates[sourceDayDate] - 1);
    if (newDaySplitStates[sourceDayDate] === 0) {
      delete newDaySplitStates[sourceDayDate];
    }
  }
  
  // Increment destination day
  newDaySplitStates[destDayDate] = (newDaySplitStates[destDayDate] || 0) + 1;
  
  editing.setDaySplitStates(newDaySplitStates);
  
  toast({ title: "Session moved", description: `Moved to ${destDayDate}` });
}, [editing, toast]);
```

**Wrap calendar in DragDropContext** (around the weeks map):
```tsx
<DragDropContext onDragEnd={handleSessionDragEnd}>
  {weeks.map((week, weekIndex) => (
    <AthleteCalendarWeekRow ... />
  ))}
</DragDropContext>
```

**Pass props to WeekRow/DayCell**:
```tsx
<AthleteCalendarWeekRow
  ...
  intensityLevels={intensityLevels}
  onIntensityChange={editing.handleDayIntensityChange}
/>
```

---

## Expected Outcome

1. **Clickable Intensity Badge**:
   - In calendar overview, clicking the colored intensity square opens a popover
   - Selecting an intensity updates the day intensity immediately
   - The change is reflected in all views (calendar, session sheet, Master Planner)

2. **Drag-and-Drop Sessions**:
   - Each session card shows a grip handle icon on the left
   - Sessions can be dragged to different days
   - Exercise data and session names move with the session
   - Same click-suppression behavior as Training Calendar (prevents accidental opens during drag)

