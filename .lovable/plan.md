
## Root Cause Analysis

The investigation confirms:
1. **Exercises ARE being copied and stored** - Console logs show "2 exercises, 2 sections, 28 dailyIntensity" being loaded from storage
2. **The data is being loaded correctly** - The `useAthleteCalendarEditing` hook successfully parses and loads the data
3. **BUT exercises don't appear in the UI** - The filter at line 847 (`ex.dayDate === selectedSessionInfo.dayDate`) returns no matches

### The Problem: Date Mismatch

The exercises stored in `editing.exerciseDistribution` have `dayDate` values that don't match the calendar's `selectedSessionInfo.dayDate`. This can happen because:

1. **The date shifting IS working** during initial assignment, BUT...
2. **A subsequent auto-save may be overwriting the data** with unshifted dates, OR
3. **The dates are in a different format** (e.g., ISO timestamp vs `yyyy-MM-dd` string), OR
4. **Timezone issues** are causing off-by-one day errors

### The Solution: Add Debug Logging + Fix Date Comparison

I'll add diagnostic logging to identify exactly what dates the exercises have vs what the calendar is looking for. Then I'll implement a robust fix.

---

## Implementation Plan

### Step 1: Add Diagnostic Logging (to pinpoint the exact issue)
**File: `src/hooks/useAthleteCalendarEditing.ts`**

Add detailed logging when loading exercises to show the actual `dayDate` values:
- Log the first few exercise dates to see the format
- Log the trainingDays dates to compare

### Step 2: Add Diagnostic Logging in the Calendar View
**File: `src/components/athletes/AthleteCalendarView.tsx`**

When opening a session, log:
- The `selectedSessionInfo.dayDate` being searched for
- The actual `dayDate` values in `editing.exerciseDistribution`
- The count of matching exercises

### Step 3: Normalize Date Format
**File: `src/utils/dateShifting.ts`**

Ensure all date shifting functions handle edge cases:
- Add validation for invalid input dates
- Ensure consistent `yyyy-MM-dd` format output
- Handle edge cases where `parseISO` might fail

### Step 4: Fix Potential Race Condition (additional safeguard)
**File: `src/hooks/useAthleteCalendarEditing.ts`**

Ensure the auto-save effect doesn't overwrite correctly shifted data:
- Add a flag to track whether the current data has been "freshly loaded" and shouldn't trigger auto-save immediately
- Prevent auto-save from running until the user has made an actual edit

### Step 5: Add Date Normalization on Load and Save
**File: `src/hooks/useAthleteCalendarEditing.ts`**

When loading exercises, normalize all `dayDate` values to consistent `yyyy-MM-dd` format:
```typescript
const storedExercises = (parsed.exerciseDistribution || []).map(ex => ({
  ...ex,
  dayDate: format(parseISO(ex.dayDate), 'yyyy-MM-dd'),
}));
```

---

## Technical Details

### Why this happens
The most likely cause is that when the data is saved during assignment (`handleAssignProgram`), the shifted dates are correct. But when the data is loaded and re-saved by the auto-save effect, the dates may get corrupted or reset.

Another possibility is that the original exercise dates in the program have a format like `2025-01-15T00:00:00.000Z` (ISO timestamp) instead of `2025-01-15` (date string), and the `parseISO` + `format` pattern isn't handling this correctly.

### The fix approach
1. **Defensive normalization**: Always normalize `dayDate` to `yyyy-MM-dd` format when loading and comparing
2. **Better logging**: Add specific logs to identify the exact mismatch
3. **Validate on assignment**: Log what dates are being stored during assignment to verify shifting works

---

## Files to Modify
1. `src/hooks/useAthleteCalendarEditing.ts` - Add logging + date normalization on load
2. `src/components/athletes/AthleteCalendarView.tsx` - Add logging when opening session + defensive date comparison
3. `src/utils/dateShifting.ts` - Add validation for edge cases

## Expected Outcome
After these changes:
- Console will clearly show what dates exercises have vs what's being searched
- Dates will be normalized to consistent format
- Exercises will match correctly and display in the session view
