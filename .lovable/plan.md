

# Plan: Fix Tests/Events Not Appearing on Calendar

## Summary

The test/event icons are not appearing because the `handleAddTestEvent` function uses `.map()` which only updates existing entries. If the training day doesn't exist in the `trainingDays` array, no update occurs.

---

## Root Cause

In `handleAddTestEvent` (MicrocyclePlanningPage.tsx lines 2391-2414):

```typescript
setTrainingDays(prev => {
  const updated = prev.map(td => {
    if (td.date === dayDate) {
      // update logic
    }
    return td;
  });
  // ...
});
```

The `.map()` function iterates through existing entries. If no entry with matching `date === dayDate` exists, no changes are made and the returned array is identical to the input.

---

## Solution

Modify `handleAddTestEvent` to:
1. Check if the day already exists in `trainingDays`
2. If it exists, update it (current behavior)
3. If it doesn't exist, create a new TrainingDay entry with proper data

---

## Implementation

### File: `src/pages/MicrocyclePlanningPage.tsx`

**Location:** Lines 2390-2414

**Current code:**
```typescript
setTrainingDays(prev => {
  const updated = prev.map(td => {
    if (td.date === dayDate) {
      // update logic
    }
    return td;
  });
  localStorage.setItem('trainingDays', JSON.stringify(updated));
  return updated;
});
```

**Updated code:**
```typescript
setTrainingDays(prev => {
  const existingDayIndex = prev.findIndex(td => td.date === dayDate);
  
  let updated: TrainingDay[];
  
  if (existingDayIndex >= 0) {
    // Day exists - update it
    updated = prev.map(td => {
      if (td.date === dayDate) {
        if (type === 'test') {
          const existingTests = td.testNames || [];
          return {
            ...td,
            isTestDay: true,
            testNames: [...existingTests, testEventName]
          };
        } else {
          const existingEvents = td.eventNames || [];
          return {
            ...td,
            isEventDay: true,
            eventNames: [...existingEvents, testEventName]
          };
        }
      }
      return td;
    });
  } else {
    // Day doesn't exist - create new TrainingDay
    const dateObj = parseISO(dayDate);
    const dayOfWeek = dateObj.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Find which microcycle this date belongs to
    let targetMicrocycleId = '';
    if (currentMesocycle) {
      for (const micro of currentMesocycle.microcycles) {
        // Find microcycle by checking if date falls within its range
        // For simplicity, use the current mesocycle ID as fallback
        targetMicrocycleId = micro.id;
        break;
      }
    }
    
    const newDay: TrainingDay = {
      date: dayDate,
      dayOfWeek,
      dayName: dayNames[dayOfWeek],
      mesocycleId: currentMesocycle?.id || '',
      microcycleId: targetMicrocycleId,
      isTestDay: type === 'test',
      isEventDay: type === 'event',
      isTrainingDay: true,
      testNames: type === 'test' ? [testEventName] : undefined,
      eventNames: type === 'event' ? [testEventName] : undefined,
      intensity: 'moderate',
      sessions: 1,
      sessionNames: ['Session 1']
    };
    
    updated = [...prev, newDay];
  }
  
  localStorage.setItem('trainingDays', JSON.stringify(updated));
  return updated;
});
```

---

## Technical Details

The fix ensures that:

1. **Existing days are updated**: When a matching day is found, the existing update logic applies
2. **Missing days are created**: When no matching day exists, a new TrainingDay is created with:
   - Proper date and dayOfWeek calculated from the ISO date string
   - mesocycleId from the current mesocycle context
   - microcycleId from the first microcycle (can be refined if needed)
   - Default values for intensity, sessions, and sessionNames
   - The test/event name properly set in testNames or eventNames array

---

## Testing Checklist

1. Navigate to Training Calendar (Step 2)
2. Open 3-dot menu on any day → "Manage tests/events"
3. Select "Test" type
4. Select a parameter from dropdown
5. Enter a Goal Value
6. Click "Add"
7. Verify: Toast shows "Test added"
8. Verify: Trophy icon appears on the calendar day
9. Hover over Trophy icon
10. Verify: Test name appears in tooltip/popover

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/MicrocyclePlanningPage.tsx` | Update `handleAddTestEvent` to create new TrainingDay entries when day doesn't exist |

