
# Plan: Implement Test/Event Functionality in Athlete Calendar

## Summary

Port the working test/event functionality from the Programming Wizard to the Athlete Calendar, including:
1. Fix the bug where adding tests/events doesn't work when the day entry doesn't exist
2. Enable baseline value auto-fill from the athlete's performance parameters
3. Pass athlete context through the component hierarchy

---

## Issue Analysis

### Issue 1: Tests/Events Not Appearing
The `handleAddTestEvent` function in `useAthleteCalendarEditing.ts` has the **same bug** we just fixed in the Programming Wizard:

```typescript
// Current code (line 1225-1242)
setTrainingDays(prev =>
  prev.map(day => {
    if (day.date !== dayDate) return day;  // Only updates EXISTING days
    // ...
  })
);
```

If the day doesn't exist in `trainingDays`, the `.map()` returns the same array unchanged.

### Issue 2: Missing Athlete Context for Baseline Auto-Fill
The `CombinedTestEventDialog` in `AthleteCalendarDayCell.tsx` (lines 567-585) is **not receiving** the athlete context props:

```typescript
<CombinedTestEventDialog
  open={testEventDialogOpen}
  // ... existing props
  // MISSING: selectedAthleteId
  // MISSING: athletePerformanceParameters
/>
```

Since we're in the Athlete Calendar, we already have the athlete - we just need to pass it down!

---

## Files to Modify

### File 1: `src/hooks/useAthleteCalendarEditing.ts`

**Location:** Lines 1217-1244

**Change:** Update `handleAddTestEvent` to create a new day entry when one doesn't exist (same pattern as the fix in `MicrocyclePlanningPage.tsx`)

**Updated logic:**
```typescript
const handleAddTestEvent = useCallback((
  dayDate: string,
  type: 'test' | 'event',
  id: string,
  name: string,
  isNew: boolean,
  comments?: string
) => {
  setTrainingDays(prev => {
    const existingDayIndex = prev.findIndex(td => td.date === dayDate);
    
    if (existingDayIndex >= 0) {
      // Day exists - update it
      return prev.map(day => {
        if (day.date !== dayDate) return day;
        if (type === 'test') {
          const testNames = [...(day.testNames || [])];
          if (!testNames.includes(name)) testNames.push(name);
          return { ...day, testNames, isTestDay: true };
        } else {
          const eventNames = [...(day.eventNames || [])];
          if (!eventNames.includes(name)) eventNames.push(name);
          return { ...day, eventNames, isEventDay: true };
        }
      });
    } else {
      // Day doesn't exist - create new TrainingDay
      const parsedDate = new Date(dayDate);
      const dayOfWeek = parsedDate.getDay();
      const dayName = parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      const newDay: TrainingDay = {
        date: dayDate,
        dayOfWeek,
        dayName,
        mesocycleId: selectedAssignment?.assignedMesocycles[0]?.id || '',
        microcycleId: '',
        isTestDay: type === 'test',
        isEventDay: type === 'event',
        isTrainingDay: true,
        testNames: type === 'test' ? [name] : undefined,
        eventNames: type === 'event' ? [name] : undefined,
        intensity: 'moderate',
        sessions: 0,
        sessionNames: [],
      };
      
      return [...prev, newDay];
    }
  });
  toast({ title: `${type === 'test' ? 'Test' : 'Event'} added`, description: name });
}, [toast, selectedAssignment]);
```

---

### File 2: `src/components/athletes/AthleteCalendarView.tsx`

**Changes:**
1. Get athlete performance parameters using `useAthletes` hook
2. Pass `athleteId` and `athletePerformanceParameters` to `AthleteCalendarWeekRow`

**Location:** Around lines 972-1006 (where AthleteCalendarWeekRow is rendered)

**New props to add:**
```typescript
<AthleteCalendarWeekRow
  // ... existing props
  athleteId={athlete.id}
  athletePerformanceParameters={athleteData.athletePerformanceParameters.filter(
    p => p.athleteId === athlete.id
  )}
/>
```

---

### File 3: `src/components/athletes/AthleteCalendarWeekRow.tsx`

**Changes:**
1. Add new props to interface:
   - `athleteId?: string`
   - `athletePerformanceParameters?: AthletePerformanceParameter[]`
2. Pass these through to `AthleteCalendarDayCell`

**Location:** Lines 31-64 (interface), lines 154-177 (rendering)

---

### File 4: `src/components/athletes/AthleteCalendarDayCell.tsx`

**Changes:**
1. Add new props to interface:
   - `athleteId?: string`
   - `athletePerformanceParameters?: AthletePerformanceParameter[]`
2. Pass these to `CombinedTestEventDialog`:
   ```typescript
   <CombinedTestEventDialog
     // ... existing props
     selectedAthleteId={athleteId}
     athletePerformanceParameters={athletePerformanceParameters}
   />
   ```

**Location:** Lines 60-87 (interface), lines 567-585 (dialog)

---

## Data Flow Diagram

```text
AthleteCalendarView
│
├── athlete.id (from props) ────────────────────┐
│                                               │
└── athleteData.athletePerformanceParameters ───┼──> filter by athlete.id
                                                │
                                                ▼
                          AthleteCalendarWeekRow
                                    │
                                    └── AthleteCalendarDayCell
                                           │
                                           └── CombinedTestEventDialog
                                                  ├── selectedAthleteId ✓
                                                  └── athletePerformanceParameters ✓
```

---

## Technical Notes

- The Athlete Calendar already has access to `athlete.id` through props
- The `useAthletes()` hook provides `athletePerformanceParameters` which we filter for the current athlete
- The `CombinedTestEventDialog` already has the baseline auto-fill logic (we just fixed/verified this for the Programming Wizard)
- The `isCreateContext` fix we just made to the dialog will work here too

---

## Expected Outcome

1. **Adding Tests/Events**: When you select a parameter and click "Add" in the Athlete Calendar, the test/event icon appears on the calendar day

2. **Baseline Value Auto-Fill**: When you select a parameter that the athlete has recorded data for, the "Baseline Value" field auto-fills with their latest recorded value

3. **Icon Visibility**: Trophy icon for tests, Calendar icon for events appear on the day cells

4. **Tooltip on Hover**: Hovering over icons shows the test/event names

---

## Testing Checklist

1. Navigate to Athlete Database
2. Select an athlete
3. Go to "Athlete Calendar" tab
4. Click 3-dot menu on any day -> "Manage tests/events"
5. Select a parameter (test) the athlete has baseline data for
6. Verify: Baseline Value auto-fills from athlete's performance parameters
7. Enter a Goal Value
8. Click "Add"
9. Verify: Toast shows "Test added"
10. Verify: Trophy icon appears on the day
11. Hover over Trophy icon
12. Verify: Test name appears in tooltip
