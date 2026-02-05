
# Plan: Fix Master Planner Test/Event Functionality and Synchronization

## Summary

The Master Planner view in both the **Athlete Calendar** and the **Training Programming Wizard** needs to have test/event functionality working identically to the Calendar View. This includes:
- Baseline value auto-fill from athlete performance parameters
- Adding tests/events and displaying icons
- Perfect synchronization between Master Planner and Calendar View

---

## Root Cause Analysis

### Issue 1: Athlete Calendar Master Planner Missing Props

The `MasterPlannerGrid` component in `AthleteCalendarView.tsx` (lines 910-951) is **missing critical props**:

**Missing props:**
- `onAddTestEvent` - handler for adding tests/events
- `onDeleteTestEvent` - handler for deleting tests/events  
- `onUpdateTestComment` - handler for updating test comments
- `onUpdateEventComment` - handler for updating event comments
- `availableTests` - list of available tests from program
- `availableEvents` - list of available events from program
- `selectedAthleteId` - athlete ID for baseline auto-fill
- `athletePerformanceParameters` - athlete's performance data for auto-fill

Compare with the Calendar View (lines 1007-1010) where athlete props ARE passed to `AthleteCalendarWeekRow`.

### Issue 2: Programming Wizard Already Has Props

The Programming Wizard's `TrainingCalendarView` already correctly passes all props including `selectedAthleteId` and `athletePerformanceParameters` to both `MasterPlannerGrid` (lines 1066-1067) and `WeekRow` (lines 1128-1129).

The `MasterPlannerColumn` already passes these to `CombinedTestEventDialog` (lines 2002-2003).

**So why isn't baseline fill working?**

The `selectedAthleteId` comes from `macrocycleData?.selectedAthleteId` - this requires an athlete to be selected during program creation. If no athlete was selected, this will be `undefined` and baseline auto-fill won't work.

---

## Implementation Plan

### File 1: `src/components/athletes/AthleteCalendarView.tsx`

**Location:** Lines 910-951 (MasterPlannerGrid component)

**Add the missing props to MasterPlannerGrid:**

```typescript
<MasterPlannerGrid
  // ... existing props ...
  onCopyDay={editing.handleCopyDay}
  onClearDay={editing.handleClearDay}
  onPasteDay={editing.handlePasteDay}
  copiedDay={editing.copiedDay}
  onAddSession={editing.handleAddSession}
  allExerciseDistribution={editing.exerciseDistribution}
  onExerciseChange={editing.handleExerciseChange}
  // ADD THESE MISSING PROPS:
  onAddTestEvent={editing.handleAddTestEvent}
  onDeleteTestEvent={editing.handleDeleteTestEvent}
  availableTests={[]}  // No program-level tests in athlete context
  availableEvents={[]} // No program-level events in athlete context
  selectedAthleteId={athlete.id}
  athletePerformanceParameters={athleteData.athletePerformanceParameters.filter(
    p => p.athleteId === athlete.id
  )}
/>
```

---

## Technical Details

### Why No `availableTests`/`availableEvents`?

In the Athlete Calendar context:
- Tests and events are created ad-hoc per assignment, not from a program template
- The `CombinedTestEventDialog` handles creating new tests/events via the parameter dropdown
- Passing empty arrays is correct - the dialog will show the "Create" mode

### Why the Fix Will Work

1. **Athlete Calendar Master Planner:**
   - Adding `selectedAthleteId={athlete.id}` enables baseline auto-fill
   - Adding `athletePerformanceParameters` provides the athlete's historical data
   - Adding `onAddTestEvent={editing.handleAddTestEvent}` connects the dialog to the state update
   - The `handleAddTestEvent` in `useAthleteCalendarEditing.ts` already correctly creates new `TrainingDay` entries

2. **Programming Wizard:**
   - Already has all props correctly wired
   - If baseline fill isn't working, it means no athlete was selected for the program
   - This is expected behavior - baseline fill only works when an athlete is associated

### Synchronization Guarantee

Both views share the same data sources:
- **Programming Wizard:** Both Master Planner and Calendar View use the same `trainingDays` state from `MicrocyclePlanningPage.tsx`
- **Athlete Calendar:** Both Master Planner and Calendar View use the same `trainingDays` state from `useAthleteCalendarEditing` hook

When you add a test/event in either view, the state update triggers a re-render of both views, keeping them synchronized.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarView.tsx` | Add missing test/event and athlete props to `MasterPlannerGrid` |

---

## Testing Checklist

### Athlete Calendar Master Planner:
1. Navigate to Athlete Database → Select an athlete → Athlete Calendar
2. Switch to Master Planner view (toggle button)
3. Click 3-dot menu on any day header → "Manage tests/events"
4. Verify: Parameter dropdown is populated
5. Select a parameter the athlete has data for
6. Verify: Baseline Value auto-fills from athlete's recorded data
7. Enter a Goal Value and click "Add"
8. Verify: Toast shows "Test added"
9. Verify: Trophy icon appears on the day
10. Switch to Calendar View → Verify icon is also visible there

### Programming Wizard Master Planner:
1. Navigate to Microcycle Planning → Step 2 → Master Planner view
2. Click 3-dot menu on any day header → "Manage tests/events"
3. Select a parameter and add a test
4. Verify: Trophy icon appears on the day
5. Switch to Calendar View → Verify icon is also visible there
6. (Note: Baseline fill only works if athlete was selected during program creation)

### Synchronization Test:
1. In Calendar View, add a test to Day X
2. Switch to Master Planner → Verify test icon appears on Day X
3. In Master Planner, add an event to Day Y
4. Switch to Calendar View → Verify event icon appears on Day Y
