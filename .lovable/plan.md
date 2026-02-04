

# Plan: Fix Tests/Events Not Appearing on Calendar + Baseline Value Auto-Fill

## Summary

Two interconnected issues need to be fixed to make the "triangle" work properly between:
1. **Training Calendar** (where tests/events are scheduled)
2. **Athlete Data** (where baseline values come from)
3. **Parameters Database** (where test methods are defined)

---

## Issue 1: Tests/Events Don't Appear on Calendar After Clicking "Add"

### Root Cause Analysis
After tracing through the code:

1. **TrainingDayCell.tsx** (line 627-663) renders `CombinedTestEventDialog`
2. When the Add button is clicked, `handleConfirm` calls `onSelect()` with the test data
3. `onSelect` maps to `onAddTestEvent` prop which calls `handleAddTestEvent` in MicrocyclePlanningPage.tsx
4. `handleAddTestEvent` (lines 2375-2467) correctly updates both `trainingDays` and `macrocycleData`

**The problem**: The `trainingDays` lookup by `day.trainingDay` in TrainingDayCell may not find the matching day because the `trainingDay` prop comes from `calendarDays` which is a calculated value from `TrainingCalendarView`.

Looking at TrainingDayCell (lines 627-663), the dialog receives:
- `scheduledTestNames={day.trainingDay?.testNames}` - from the TrainingDay object
- `scheduledEventNames={day.trainingDay?.eventNames}` - from the TrainingDay object

The issue is that when `setTrainingDays` updates state, the `calendarDays` memo in TrainingCalendarView needs to recalculate. But the dependency chain appears correct.

**Actual root cause**: The issue is a **state synchronization timing problem**. After `setTrainingDays` in `handleAddTestEvent`, the calendar should rerender with the updated trainingDays. Let me verify the flow is working correctly by checking if `handleAddTestEvent` is being called at all.

After more investigation - the `onAddTestEvent` prop IS being passed down correctly. The most likely cause is that the component isn't forcing a re-render, OR there's an issue with how the date matching works.

### Solution
Add debugging and ensure proper state update propagation:

**File: `src/pages/MicrocyclePlanningPage.tsx`**
- In `handleAddTestEvent`, ensure the update triggers a proper re-render
- Force localStorage sync to happen first, then state update

**File: `src/components/microcycle-planning/TrainingCalendarView.tsx`**
- Ensure `trainingDays` is properly used in the `calendarDays` memo dependency array (it already is)

---

## Issue 2: Baseline Value Not Auto-Filling from Athlete Data

### Root Cause
The athlete context props are NOT being passed to `CombinedTestEventDialog`:

**TrainingDayCell.tsx** (lines 627-663):
```typescript
<CombinedTestEventDialog
  open={combinedDialogOpen}
  onOpenChange={setCombinedDialogOpen}
  existingTests={availableTests || []}
  existingEvents={availableEvents || []}
  // ... other props
  allParameters={parametersData.parameters}
  toolboxEntries={toolboxData?.entries || []}
  onAddParameter={(param) => { /* ... */ }}
  // MISSING: selectedAthleteId
  // MISSING: athletePerformanceParameters
/>
```

The `selectedAthleteId` and `athletePerformanceParameters` are NOT being passed to:
1. `TrainingDayCell` from `TrainingCalendarView`
2. `TrainingCalendarView` from `MicrocyclePlanningPage`
3. Similarly missing from `MasterPlannerColumn` and `WorkoutSessionSheet`

### Solution
Pass the athlete context through the component hierarchy:

---

## Files to Modify

### File 1: `src/pages/MicrocyclePlanningPage.tsx`

**Changes:**
1. Import `useAthletes` hook to access `athletePerformanceParameters`
2. Get `selectedAthleteId` from `macrocycleData?.selectedAthleteId`
3. Filter `athletePerformanceParameters` for the selected athlete
4. Pass these to `TrainingCalendarView` as new props

**Code location:** Lines ~69-74 and ~3108-3151

**New props to pass to TrainingCalendarView:**
```typescript
selectedAthleteId={macrocycleData?.selectedAthleteId}
athletePerformanceParameters={athletePerformanceParametersForAthlete}
```

---

### File 2: `src/components/microcycle-planning/TrainingCalendarView.tsx`

**Changes:**
1. Add new props to interface:
   - `selectedAthleteId?: string`
   - `athletePerformanceParameters?: AthletePerformanceParameter[]`
2. Pass these props through to:
   - `TrainingDayCell` (in calendar grid rendering)
   - `WeekRow` (which renders TrainingDayCell)
   - `MasterPlannerGrid` / `MasterPlannerColumn`

**Code locations:** Interface at lines 43-97, component body at lines 117-160

---

### File 3: `src/components/microcycle-planning/TrainingDayCell.tsx`

**Changes:**
1. Add new props to interface:
   - `selectedAthleteId?: string`
   - `athletePerformanceParameters?: AthletePerformanceParameter[]`
2. Pass these to `CombinedTestEventDialog`:
```typescript
<CombinedTestEventDialog
  // ... existing props
  selectedAthleteId={selectedAthleteId}
  athletePerformanceParameters={athletePerformanceParameters}
/>
```

**Code location:** Lines 65-97 (interface), lines 627-663 (dialog)

---

### File 4: `src/components/microcycle-planning/WeekRow.tsx`

**Changes:**
1. Add new props to interface
2. Pass through to `TrainingDayCell`

---

### File 5: `src/components/microcycle-planning/MasterPlannerColumn.tsx`

**Changes:**
1. Add new props to interface
2. Pass to `CombinedTestEventDialog`

---

### File 6: `src/components/microcycle-planning/MasterPlannerGrid.tsx`

**Changes:**
1. Add new props to interface
2. Pass through to `MasterPlannerColumn`

---

### File 7: `src/components/microcycle-planning/WorkoutSessionSheet.tsx`

**Changes:**
1. Add new props to interface
2. Pass to `CombinedTestEventDialog`

---

## Data Flow Diagram

```text
MicrocyclePlanningPage
│
├── macrocycleData?.selectedAthleteId ─────┐
│                                          │
└── useAthletes().athletePerformanceParameters ──> filter by athleteId
                                           │
                                           ▼
                        TrainingCalendarView
                                │
                                ├── WeekRow
                                │      └── TrainingDayCell
                                │             └── CombinedTestEventDialog
                                │                    ├── selectedAthleteId ✓
                                │                    └── athletePerformanceParameters ✓
                                │
                                └── MasterPlannerGrid
                                       └── MasterPlannerColumn
                                              └── CombinedTestEventDialog
                                                     ├── selectedAthleteId ✓
                                                     └── athletePerformanceParameters ✓
```

---

## Expected Outcome After Fix

1. **Adding Tests/Events**: When you select a parameter and click "Add", the test/event icon appears on the calendar day with the name visible on hover

2. **Baseline Value Auto-Fill**: When you select a parameter that the athlete has recorded data for, the "Baseline Value" field auto-fills with their latest recorded value

---

## Testing Checklist

1. Go to Training Calendar (Step 2 of wizard)
2. Open 3-dot menu on any day → "Manage tests/events"
3. Select "Test" type
4. Select a parameter from dropdown (e.g., "100m Sprint Time")
5. Verify: If athlete has a value for this parameter, Baseline Value auto-fills
6. Enter a Goal Value
7. Click "Add"
8. Verify: Trophy icon appears on the day
9. Hover over Trophy icon
10. Verify: Test name appears in tooltip

