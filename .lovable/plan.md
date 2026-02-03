
# Fix: Date Shifting Off-by-One Due to Timezone

## Problem Identified

When assigning a training program to an athlete calendar, the date shifting is **off by one day** due to timezone handling:

1. User selects February 9 (Monday) as the start date
2. JavaScript creates `new Date()` at midnight *local time*
3. When stored/logged in UTC, this becomes `2026-02-08T23:00:00.000Z` (11 PM on Feb 8)
4. The original program start is `2026-02-01T00:00:00.000Z` (midnight UTC on Feb 1)
5. `differenceInDays()` calculates offset = 7 days (not 8) because it's based on actual time difference
6. Shifting Feb 1 by 7 days = Feb 8, not Feb 9

Result: The program starts on Sunday (Feb 8) instead of Monday (Feb 9), so the "Easy" Monday session appears instead of the "Hard" Sunday session.

## Solution

Normalize both dates to midnight UTC before calculating the offset. This ensures the shift is based purely on calendar days, not timestamps.

### Files to Modify

**1. `src/utils/dateShifting.ts`**

Add a helper function to normalize dates to UTC midnight:

```typescript
/**
 * Normalizes a date to UTC midnight to ensure consistent day-based calculations
 */
function normalizeToUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
```

Update `calculateDayOffset()` to normalize dates:

```typescript
export function calculateDayOffset(originalStartDate: Date, newStartDate: Date): number {
  // Normalize both dates to UTC midnight for accurate day-based offset
  const normalizedOriginal = normalizeToUTCMidnight(originalStartDate);
  const normalizedNew = normalizeToUTCMidnight(newStartDate);
  return differenceInDays(normalizedNew, normalizedOriginal);
}
```

**2. `src/components/athletes/AthleteCalendarView.tsx`**

When computing `originalStartDate` and `newStartDate`, ensure they're normalized before calling shift functions:

In the `handleAssignProgram` function (~line 447):

```typescript
// Normalize dates to UTC midnight for accurate day-based shifting
const normalizedOriginalStart = new Date(Date.UTC(
  originalStartDate.getFullYear(),
  originalStartDate.getMonth(),
  originalStartDate.getDate()
));

const assignmentDate = new Date(assignment.startDate);
const normalizedNewStart = new Date(Date.UTC(
  assignmentDate.getFullYear(),
  assignmentDate.getMonth(),
  assignmentDate.getDate()
));

// Then use normalizedOriginalStart and normalizedNewStart for shifting
const shiftedExercises = program.exerciseDistribution 
  ? shiftExerciseDates(program.exerciseDistribution, normalizedOriginalStart, normalizedNewStart)
  : [];
// ... etc
```

### Why This Fixes It

With normalization:
- `originalStartDate`: Feb 1, 2026 00:00:00 UTC
- `newStartDate`: Feb 9, 2026 00:00:00 UTC (not Feb 8 23:00!)
- Offset: 8 days (correct!)
- Feb 1 + 8 days = Feb 9 (correct!)

Now the "Hard" session from Feb 1 (Day 1 of the program) will correctly land on Feb 9 (the assigned start date), regardless of user timezone.

## Technical Details

The issue affects ALL date-based operations when the user's timezone is not UTC. By normalizing to UTC midnight:

1. We preserve the **calendar date** the user selected (Feb 9)
2. We ignore the **time component** which varies by timezone
3. All day calculations become consistent regardless of user location

This is a common fix pattern for date-based (not datetime-based) applications.

## Testing Verification

After the fix:
1. Create a program starting on any day (e.g., Sunday Feb 1)
2. Set Day 1 to "Hard" intensity with exercises
3. Assign to athlete calendar starting on a different day (e.g., Monday Feb 9)
4. The assigned start date should show "Hard" intensity and Day 1's exercises
5. Day 2 of the program should appear on Feb 10, etc.
