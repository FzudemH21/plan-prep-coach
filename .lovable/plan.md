

# Fix: Intensity Decoupling for Multi-Session Days + Drag-and-Drop Session Movement

## Summary

This plan fixes two issues in the Athlete Calendar:

1. **Day Intensity Updating Session Intensities**: When changing the day intensity via the calendar overview, all sessions on that day have their displayed intensity changed. For multi-session days, the day intensity should be independent of per-session intensities.

2. **Drag-and-Drop Not Moving Sessions**: Dropping a session onto another day opens the session detail sheet instead of moving it. The session remains on its original day.

---

## Root Cause Analysis

### Issue 1: Intensity Coupling

**Current Behavior**:
- `handleDayIntensityChange` correctly updates only `trainingDays` and `dailyIntensityData`
- However, when building the calendar view (`calendarDays` in AthleteCalendarView.tsx), ALL sessions on a day are assigned the same `dayIntensity` (lines 268, 337)
- There is no per-session intensity storage in the calendar overview

**Why This Appears Broken**:
- The visual update is immediate because all sessions share the day's intensity in the view
- There's no separate `sessionIntensities` data structure for multi-session days

**Solution**:
For multi-session days, we need to store and display per-session intensities. Currently there's a partial implementation using `parameterValues[sessionIntensityKey]` for cached assignments (lines 380-384), but:
1. The live editing path doesn't check this
2. The key format isn't consistent

### Issue 2: Drag-and-Drop Not Working

**Current Behavior**:
- `handleSessionDragEnd` receives `result.source.index` (the visual position in the list: 0, 1, 2...)
- It passes this directly to `handleMoveSession(sourceDayDate, sourceIndex, destDayDate)`
- But `handleMoveSession` expects the actual `sessionIndex` from the exercise data

**The Bug**:
The `draggableId` contains the actual session index embedded in it:
```
draggableId = `${assignment.id}-${dateString}-${sessionIdx}`
```
For example: `"abc123-2026-02-10-0"` (session index is `0`)

But `handleSessionDragEnd` uses `result.source.index` instead of parsing the actual session index from the `draggableId`.

**Additional Issue**:
The click-suppression logic in `AthleteCalendarDayCell` updates `lastDragEndTime.current` every render when `!isDragging && draggingOver === null`. This causes false positives where clicks get suppressed even without dragging.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarView.tsx` | Fix `handleSessionDragEnd` to parse session index from `draggableId`; Add per-session intensity lookup for live editing |
| `src/hooks/useAthleteCalendarEditing.ts` | Add `sessionIntensities` state for per-session intensity storage; Update `handleDayIntensityChange` to NOT cascade to multi-session days |

---

## Technical Details

### Fix 1: Parse Session Index from DraggableId

**File**: `src/components/athletes/AthleteCalendarView.tsx`
**Location**: `handleSessionDragEnd` (lines 478-492)

The `draggableId` format is: `${assignmentId}-${dateString}-${sessionIndex}`

Extract the session index by parsing the draggableId:

```typescript
const handleSessionDragEnd = useCallback((result: DropResult) => {
  if (!result.destination) return;
  
  const sourceDayDate = result.source.droppableId;
  const destDayDate = result.destination.droppableId;
  
  // Parse session index from draggableId
  // Format: "assignmentId-YYYY-MM-DD-sessionIndex"
  const draggableId = result.draggableId;
  const parts = draggableId.split('-');
  // Last part is the session index
  const sourceSessionIndex = parseInt(parts[parts.length - 1], 10);
  
  // Same day, same position - no change needed
  if (sourceDayDate === destDayDate) return;
  
  // Validate parsed index
  if (isNaN(sourceSessionIndex)) {
    console.error('[handleSessionDragEnd] Could not parse session index from draggableId:', draggableId);
    return;
  }
  
  // Use the hook's handler for moving sessions
  editing.handleMoveSession(sourceDayDate, sourceSessionIndex, destDayDate);
  
  toast({
    title: "Session moved",
    description: `Moved to ${format(new Date(destDayDate), 'MMM d')}`,
  });
}, [editing, toast]);
```

### Fix 2: Per-Session Intensity for Multi-Session Days

**File**: `src/hooks/useAthleteCalendarEditing.ts`

1. Add a new state for per-session intensities:
```typescript
const [sessionIntensities, setSessionIntensities] = useState<Record<string, IntensityLevel>>({});
// Key format: "dayDate-sessionIndex" -> IntensityLevel
```

2. Update `handleDayIntensityChange` to NOT update session intensities for multi-session days:
```typescript
const handleDayIntensityChange = useCallback((dayDate: string, intensity: IntensityLevel) => {
  // Always update day-level intensity
  setTrainingDays(prev =>
    prev.map(day => day.date === dayDate ? { ...day, intensity } : day)
  );
  setDailyIntensityData(prev =>
    prev.map(di => di.date === dayDate ? { ...di, intensity } : di)
  );
  
  // For single-session days, also sync the session intensity
  const sessionCount = daySplitStates[dayDate] ?? 1;
  if (sessionCount === 1) {
    setSessionIntensities(prev => ({
      ...prev,
      [`${dayDate}-0`]: intensity
    }));
  }
  // For multi-session days, session intensities remain independent
}, [daySplitStates]);
```

3. Update `handleSessionIntensityChange` to store per-session intensity:
```typescript
const handleSessionIntensityChange = useCallback((dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
  const sessionCount = daySplitStates[dayDate] ?? 1;
  
  // Store per-session intensity
  setSessionIntensities(prev => ({
    ...prev,
    [`${dayDate}-${sessionIndex}`]: intensity
  }));
  
  // For single session days, also sync to day intensity
  if (sessionCount === 1) {
    setTrainingDays(prev =>
      prev.map(day => day.date === dayDate ? { ...day, intensity } : day)
    );
    setDailyIntensityData(prev =>
      prev.map(di => di.date === dayDate ? { ...di, intensity } : di)
    );
  }
}, [daySplitStates]);
```

4. Export `sessionIntensities` from the hook's return value.

5. Include `sessionIntensities` in the auto-save payload.

**File**: `src/components/athletes/AthleteCalendarView.tsx`

Update the session building logic to use per-session intensities when available:

```typescript
// Inside the calendarDays useMemo, when building sessions:
let sessionIntensity = dayIntensity;
const perSessionKey = `${dateString}-${sessionIdx}`;
if (editing.sessionIntensities?.[perSessionKey]) {
  sessionIntensity = editing.sessionIntensities[perSessionKey];
}

sessions.push({
  // ...
  intensity: sessionIntensity,
});
```

### Fix 3: Click Suppression Logic

**File**: `src/components/athletes/AthleteCalendarDayCell.tsx`

The current click suppression logic sets `lastDragEndTime.current = Date.now()` on every render when `!isDragging && draggingOver === null`. This causes clicks to be suppressed even when no drag occurred.

Fix: Only set the timestamp when transitioning FROM dragging TO not dragging:

```typescript
// Inside the Draggable render function
{(draggableProvided, draggableSnapshot) => {
  // Track state transition for click suppression
  const wasDraggingRef = useRef(false);
  
  useEffect(() => {
    if (draggableSnapshot.isDragging) {
      wasDraggingRef.current = true;
    } else if (wasDraggingRef.current) {
      // Just stopped dragging
      lastDragEndTime.current = Date.now();
      wasDraggingRef.current = false;
    }
  }, [draggableSnapshot.isDragging]);
  
  // ... rest of render
}}
```

Alternative simpler fix - check if the snapshot indicates a completed drag:
```typescript
// Only suppress if we were actually dragging recently
// The isDragging->false transition is what matters
```

---

## Summary of Changes

1. **Parse draggableId correctly** in `handleSessionDragEnd` to get the actual session index
2. **Add per-session intensity storage** (`sessionIntensities` state) for multi-session days
3. **Decouple day/session intensity** for multi-session days in both handlers
4. **Fix click suppression** to only trigger after actual drag operations

---

## Expected Outcome

1. **Drag-and-Drop**: Sessions can be dragged to different days; the session moves with all its exercises and data
2. **Intensity Independence**: On multi-session days, changing the day intensity only affects the day indicator; individual session intensities remain unchanged
3. **No Accidental Opens**: Click suppression only activates after actual drag operations, preventing false positive session opens

