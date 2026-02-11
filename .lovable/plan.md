

# Fix Athlete Calendar Master Planner Synchronization

## Problem Summary
Two issues with the Master Planner in the Athlete Calendar:

1. **Data mismatch**: The Master Planner shows "ghost" sessions on days where the Calendar View shows nothing (e.g., Feb 9 has Session 1 in Master Planner but is empty in Calendar View). This is because the Master Planner builds its data from `trainingDays` (template structure) and falls back to showing 1 session whenever intensity is not "off", even when no actual exercises or split state exist.

2. **Clicking sessions does not open the WorkoutSessionSheet**: While the `onSessionClick` prop was added in the last fix, the ghost sessions issue means the user is clicking on non-existent session data, and the sheet may not find matching content.

## Root Cause

In `useAthleteCalendarEditing.ts`, the `allAssignmentDays` memo (line 1611):

```typescript
const daySessions = daySplitStates[dateStr] || (trainingDay.intensity === 'off' ? 0 : 1);
```

When `daySplitStates[dateStr]` is `undefined` (no actual session data for that date), it falls back to `1` for any non-off intensity day. This creates phantom sessions in the Master Planner that don't exist in the Calendar View's live data check.

The Calendar View uses a stricter check: it only shows sessions when `liveSplitState > 0` OR `liveExercises.length > 0`.

## Fix

### File: `src/hooks/useAthleteCalendarEditing.ts`

**Lines 1608-1634** -- Update `allAssignmentDays` to match the Calendar View's logic:

- Only show sessions when `daySplitStates` explicitly has a value for that date OR when exercises exist for that date
- When `daySplitStates[dateStr]` is `undefined`, treat it as 0 sessions (not 1)
- This aligns the Master Planner's data source with the Calendar View's rendering logic

```typescript
const allAssignmentDays = useMemo((): CalendarDay[] => {
  if (!selectedAssignment) return [];
  
  return trainingDays.map(trainingDay => {
    const dateStr = trainingDay.date;
    const dayExercises = exerciseDistribution.filter(e => e.dayDate === dateStr);
    const hasExplicitSplitState = dateStr in daySplitStates;
    const daySessions = hasExplicitSplitState 
      ? daySplitStates[dateStr] 
      : (dayExercises.length > 0 ? 1 : 0);
    
    // ... rest unchanged, sessions built from daySessions
  });
}, [selectedAssignment, trainingDays, exerciseDistribution, daySplitStates]);
```

This single change ensures the Master Planner only shows sessions where actual data exists, achieving perfect synchronization with the Calendar View. All editing callbacks are already shared between both views through the same `editing` hook, so any changes made in either view will automatically reflect in the other.

## Files to Edit

1. `src/hooks/useAthleteCalendarEditing.ts` -- Fix `allAssignmentDays` memo session count logic

