

# Plan: Fix Session Drag-and-Drop Issues

## Summary

This plan fixes three remaining issues with the athlete calendar drag-and-drop:

1. **Moved session loses its intensity** - Session takes the destination day's intensity instead of keeping its own
2. **Intermittent session opening after drop** - Click suppression not 100% reliable
3. **Drop zone too small** - Must hover very close to existing sessions to drop

---

## Root Cause Analysis

### Issue 1: Session Intensity Not Preserved on Move

In `handleMoveSession` (lines 422-564 of `useAthleteCalendarEditing.ts`), the function moves:
- Exercises to new day/session ✓
- Session sections ✓
- Supersets ✓
- Day split states ✓
- Training days / session names ✓

**BUT it does NOT move the `sessionIntensities` entry.** The source session's intensity key (`${sourceDayDate}-${sourceSessionIndex}`) is left in place while the destination key (`${destDayDate}-${newSessionIndex}`) is never set.

Then, the `useEffect` that initializes missing session intensities (lines 1457-1484) runs and sets the moved session's intensity to the destination day's intensity (because the key doesn't exist).

### Issue 2: Intermittent Click Suppression Failure

The `lastDragEndRef.current = Date.now()` is set at the very top of `handleSessionDragEnd` (line 510), which is correct. However, looking at the browser event order:

1. `onDragEnd` fires (sets ref)
2. `onClick` fires (checks ref)

The timing should work, but the issue may be:
- The click event is already queued before `onDragEnd` finishes
- In some cases, the browser processes events in a different order
- The 200ms window may be too short for slower interactions

**Fix**: Increase the suppression window to 300ms and ensure the ref is set even earlier (if possible via `onDragStart` as a backup).

### Issue 3: Drop Zone Too Small

For days WITH sessions, the `<Droppable>` wrapper (lines 351-476 of `AthleteCalendarDayCell.tsx`) only covers the `<div className="space-y-2">` containing the session list. This means:
- The area above the sessions (header with date/intensity) is NOT droppable
- The area below the sessions (if any padding) is NOT droppable
- Users must hover directly over the session cards

**Fix**: Move the `<Droppable>` higher up to wrap the entire training content area, or at minimum add padding/min-height to the droppable container.

---

## Implementation Plan

### File 1: `src/hooks/useAthleteCalendarEditing.ts`

**Change: Move session intensity with the session**

In `handleMoveSession`, after updating supersets (around line 489), add logic to:

1. Get the source session's intensity: `sessionIntensities[`${sourceDayDate}-${sourceSessionIndex}`]`
2. Set it on the destination: `sessionIntensities[`${destDayDate}-${newSessionIndex}`]`
3. Remove the source key
4. Shift remaining source day intensities down (for sessions after the moved one)

```typescript
// Move session intensity to destination
setSessionIntensities(prev => {
  const newIntensities = { ...prev };
  const sourceKey = `${sourceDayDate}-${sourceSessionIndex}`;
  const destKey = `${destDayDate}-${newSessionIndex}`;
  
  // Preserve the session's original intensity (or fall back to source day intensity)
  const movedIntensity = newIntensities[sourceKey] || 
    (trainingDays.find(d => d.date === sourceDayDate)?.intensity as IntensityLevel) || 
    'moderate';
  
  // Set on destination
  newIntensities[destKey] = movedIntensity;
  
  // Remove from source
  delete newIntensities[sourceKey];
  
  // Shift remaining source day session intensities down
  const sourceCount = daySplitStates[sourceDayDate] || 0;
  for (let i = sourceSessionIndex + 1; i < sourceCount; i++) {
    const oldKey = `${sourceDayDate}-${i}`;
    const newKey = `${sourceDayDate}-${i - 1}`;
    if (newIntensities[oldKey] !== undefined) {
      newIntensities[newKey] = newIntensities[oldKey];
      delete newIntensities[oldKey];
    }
  }
  
  return newIntensities;
});
```

**Add `sessionIntensities` to the dependency array** of `handleMoveSession`.

---

### File 2: `src/components/athletes/AthleteCalendarDayCell.tsx`

**Change 1: Expand droppable area for days with sessions**

Currently (lines 351-476), the `<Droppable>` wraps only the session list. We need to make the entire training content area droppable.

Move the `<Droppable>` to wrap the full content area (everything below the header), and add `min-height` and padding to ensure a reasonable drop target:

```tsx
{hasTraining ? (
  <Droppable droppableId={day.dateString} type="session">
    {(droppableProvided, droppableSnapshot) => (
      <div 
        ref={droppableProvided.innerRef}
        {...droppableProvided.droppableProps}
        className={cn(
          "space-y-2 min-h-[80px] flex-1", // Added min-height and flex-1
          droppableSnapshot.isDraggingOver && "bg-primary/5 rounded-md p-1 border-2 border-dashed border-primary/30"
        )}
      >
        {/* Session cards... */}
      </div>
    )}
  </Droppable>
) : (
  /* Empty day droppable - already good */
)}
```

**Change 2: Increase click suppression window**

In the session card `onClick` handler (lines 373-378), increase the suppression window from 200ms to 300ms:

```tsx
onClick={(e) => {
  e.stopPropagation();
  const dragEndTime = lastDragEndRef?.current ?? 0;
  if (Date.now() - dragEndTime < 300) return; // Increased from 200
  onSessionClick?.(day.dateString, session.sessionIndex, session.assignmentId || day.assignmentId || '');
}}
```

---

### File 3: `src/components/athletes/AthleteCalendarView.tsx`

**Change: Track drag start for backup suppression**

Add a `lastDragStartRef` that's set when dragging begins. This provides a backup check:

```tsx
const lastDragStartRef = useRef<number>(0);

// In the DragDropContext:
<DragDropContext 
  onDragStart={() => { lastDragStartRef.current = Date.now(); }}
  onDragEnd={handleSessionDragEnd}
>
```

Then pass both refs down if needed, though the main fix is the 300ms window.

---

## Summary of Changes

| File | Change |
|------|--------|
| `useAthleteCalendarEditing.ts` | Move `sessionIntensities` entry when session is moved; shift remaining source keys down |
| `AthleteCalendarDayCell.tsx` | Add `min-h-[80px]` and visual feedback to droppable; increase click suppression to 300ms |
| `AthleteCalendarView.tsx` | (Optional) Track drag start for backup suppression |

---

## Expected Outcome

1. **Session intensity preserved**: When dragging a session to another day, it keeps its original intensity instead of inheriting the destination day's intensity
2. **No accidental session opens**: The 300ms suppression window reliably prevents clicks after drops
3. **Easier dropping**: The full training content area is droppable, not just the session cards themselves; visual feedback (dashed border) shows when hovering over a valid drop zone

