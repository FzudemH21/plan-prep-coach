

# Fix Athlete Calendar: Crashes, Paste Issues, and Conceptual Redesign

## Summary

You've identified two categories of issues:
1. **Technical bugs**: Clear Week causes a crash (infinite loop), Paste Week/Day/Session doesn't work properly
2. **Conceptual feedback**: The Athlete Calendar should treat workouts as independent entities, not tied to "assigned programs"

This plan addresses the technical bugs first (so the app works), then outlines the conceptual redesign.

---

## Part 1: Fix the Crash (Clear Week Infinite Loop)

### Root Cause

The console shows:
```
Maximum update depth exceeded...
at useAthleteCalendarEditing.ts:126
```

This happens because the `handleClearWeek` function triggers state updates (`setTrainingDays`, `setDaySplitStates`, etc.) which cause the auto-save effect to run, which in turn might trigger re-renders that cascade into more updates.

The issue is in the auto-save `useEffect` dependency array - when `trainingDays` changes, it triggers a save, but the save might be triggering additional state changes in a loop.

### Fix

Add a debounce mechanism to the auto-save effect and ensure state updates don't cause cascading loops:

```text
File: src/hooks/useAthleteCalendarEditing.ts

1. Add a lastSavedRef to track what was last saved
2. Compare current state with last saved before triggering save
3. Use a stable reference for the save function
```

---

## Part 2: Fix Paste Week/Day/Session Not Displaying

### Root Cause

The current logic correctly pastes exercises to the state, but there are two issues:

1. **Pasting outside assignment range**: The calendar view filters dates by assignment range - dates outside get no sessions displayed
2. **Intensity not matching**: When pasting, the intensity from the copied week/day is not being applied to the target

### Current Logic Issue

In `handlePasteWeek`, the intensity is not being copied from the source day to the target day. The code sets:
```typescript
intensity: existingDay?.intensity || ('moderate' as IntensityLevel)
```

But it should use the copied week's training day intensity.

### Fix

```text
File: src/hooks/useAthleteCalendarEditing.ts

In handlePasteWeek:
1. Look up the source day's intensity from copiedWeek.trainingDays
2. Apply that intensity to the target day (unless target already has custom intensity)
3. Update dailyIntensityData to include the pasted intensity values

In handlePasteDay:
1. Apply copiedDay.intensity to the target day's intensity data
2. Ensure trainingDays gets updated with the copied intensity
```

---

## Part 3: Conceptual Redesign - Workouts Independent of Programs

### Your Vision

1. **Training Programming Wizard = Template Factory**
   - Creates plans with dates, exercises, parameters, methods, periodization
   - The dates are just for template organization

2. **Athlete Calendar = Independent Workout View**
   - When assigning: Take a "screenshot" of the template
   - After assignment: Workouts are independent entities
   - Sessions can be moved anywhere
   - Parameters travel with the session
   - No concept of "program range" limiting where workouts appear

3. **Remove "Assigned Programs" Section**
   - The calendar should just show workouts on days
   - No need to track which program workouts came from

### Implementation Approach

This is a larger architectural change. For now, I'll focus on making the current system work properly, with one key change that aligns with your vision:

**Remove the date range filter for the selected assignment** - Allow workouts to appear on ANY date where they exist, not just within the original program's date range.

```text
File: src/components/athletes/AthleteCalendarView.tsx

Change in calendarDays memo:
- Currently: Check if date is within assignment's startDate-endDate range
- New: Always show workouts from the editing state, regardless of original range
```

This means:
- When you paste a week to dates outside the program range, the workouts appear
- The athlete's calendar becomes the "source of truth" for what workouts exist where
- The original program range becomes irrelevant after assignment

### Future Enhancement (Not in This Plan)

Completely remove the `AthleteCalendarAssignment` concept and instead store workouts directly in a per-athlete structure:
```typescript
interface AthleteWorkout {
  id: string;
  athleteId: string;
  date: string;
  sessionIndex: number;
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  // Parameters are embedded in exercises
}
```

This would be a larger refactor for a future iteration.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useAthleteCalendarEditing.ts` | 1. Fix infinite loop in auto-save effect<br>2. Fix handlePasteWeek to copy intensity values<br>3. Fix handlePasteDay to copy intensity values |
| `src/components/athletes/AthleteCalendarView.tsx` | Remove date range filter for selected assignment - show workouts wherever they exist |

---

## Technical Implementation Details

### 1. Fix Infinite Loop (useAthleteCalendarEditing.ts)

The auto-save effect needs a stable comparison:

```typescript
// Add ref to track last saved state
const lastSavedStateRef = useRef<string>('');

// In auto-save effect:
useEffect(() => {
  if (!selectedAssignmentId || isInitializing) return;
  if (loadingAssignmentIdRef.current !== null) return;
  if (loadedAssignmentIdRef.current !== selectedAssignmentId) return;
  
  const storageKey = `athlete-assignment-${selectedAssignmentId}`;
  const dataToSave = {
    exerciseDistribution,
    sessionSections,
    supersets,
    parameterValues,
    dailyIntensity: dailyIntensityData,
    trainingDays,
    daySplitStates,
    lastModified: new Date().toISOString(),
  };
  
  // Only save if data actually changed
  const stateString = JSON.stringify({
    exerciseDistribution,
    sessionSections,
    supersets,
    daySplitStates,
    // Exclude lastModified from comparison
  });
  
  if (stateString === lastSavedStateRef.current) return;
  lastSavedStateRef.current = stateString;
  
  localStorage.setItem(storageKey, JSON.stringify(dataToSave));
}, [...dependencies]);
```

### 2. Fix Paste Week Intensity (useAthleteCalendarEditing.ts)

In `handlePasteWeek`, update the intensity copy logic:

```typescript
// Find source training day to get intensity
const sourceTrainingDay = copiedWeek.trainingDays.find(
  td => td.date === sourceDayDate
);
const copiedIntensity = sourceTrainingDay?.intensity || 'moderate';

// Apply to target
newTrainingDayUpdates[targetDayDate] = {
  ...
  intensity: copiedIntensity as IntensityLevel, // Use copied intensity
  ...
};
```

Also update `dailyIntensityData`:

```typescript
setDailyIntensityData(prev => {
  const updated = [...prev];
  Object.entries(newTrainingDayUpdates).forEach(([date, update]) => {
    const existingIdx = updated.findIndex(d => d.date === date);
    if (existingIdx >= 0) {
      updated[existingIdx] = { ...updated[existingIdx], intensity: update.intensity };
    } else {
      updated.push({ date, intensity: update.intensity });
    }
  });
  return updated.sort((a, b) => a.date.localeCompare(b.date));
});
```

### 3. Remove Date Range Filter (AthleteCalendarView.tsx)

The current `calendarDays` memo already checks live editing state first - we just need to ensure it properly displays content without the range limitation. The key is that for the **selected assignment**, we should ALWAYS check the editing state first, and display whatever is there.

The recent changes should handle this, but we need to ensure the training days are being created for pasted dates (which the merge logic now handles).

---

## Expected Outcome

After these fixes:
1. **Clear Week** - Works without crashing
2. **Paste Week** - Pastes all exercises AND copies intensity from source days
3. **Paste Day/Session** - Works correctly with proper intensity
4. **Workouts appear anywhere** - No longer limited by original program date range

