

# Fix Clear Week/Day, Master Planner Sync, and Tests/Events Clearing

## Problems Found

### 1. Clear Week fails: Timezone bug
`handleClearWeek` uses `new Date(weekStartDate)` which parses "2025-02-09" as UTC midnight. In western timezones, this becomes Feb 8 evening, so the generated `weekDates` array is shifted by one day. No exercises match those wrong dates, so nothing gets cleared.

Same timezone bug exists in `handleCopyWeek`.

### 2. Clear Day/Week don't remove tests and events
Both `handleClearDay` and `handleClearWeek` clear sessions, exercises, sections, and supersets, but they do NOT clear `testNames` and `eventNames` from the `trainingDays` entries. So test/event markers remain on the calendar after clearing, making it appear as if the clear didn't work.

### 3. Master Planner shows no sessions: Timezone bug
The `allAssignmentDays` memo creates Date objects with `new Date(dateStr)` (line 1719). The `MasterPlannerGrid` then filters by `getDay(day.date)` to match the selected weekday. Due to UTC parsing, all dates shift back one day in western timezones, so day-of-week filtering fails -- Monday sessions appear under Sunday's column (or not at all).

## Technical Changes

### File: `src/hooks/useAthleteCalendarEditing.ts`

**A. Fix `handleClearWeek` (line 1013) -- local-safe date parsing + clear tests/events:**
Replace `new Date(weekStartDate)` with split-based local date construction:
```typescript
const [y, m, d] = weekStartDate.split('-').map(Number);
const startDateVal = new Date(y, m - 1, d);
```
Also update the `trainingDays` mapping to clear `testNames`, `eventNames`, `isTestDay`, `isEventDay`:
```typescript
{ ...day, sessions: 0, sessionNames: [], testNames: [], eventNames: [], isTestDay: false, isEventDay: false }
```

**B. Fix `handleCopyWeek` (line 967) -- same timezone fix:**
Replace `new Date(weekStartDate)` with local-safe parsing.

**C. Fix `handleClearDay` (line 800) -- clear tests/events:**
Update the `trainingDays` mapping to also clear `testNames`, `eventNames`, `isTestDay`, `isEventDay`.

**D. Fix `allAssignmentDays` (line 1706, 1719) -- local-safe Date creation:**
Replace `new Date(dateStr)` with:
```typescript
const [y, m, d] = dateStr.split('-').map(Number);
// use new Date(y, m - 1, d) for the date field
```
This ensures `getDay()` returns the correct weekday for Master Planner filtering.

## Expected Outcomes
- Clear Week correctly identifies and removes all exercises, sections, supersets, tests, and events for the 7 target dates
- Clear Day removes tests and events in addition to sessions/exercises
- Master Planner displays sessions on the correct weekday columns, matching the Calendar View
- All changes persist immediately to localStorage

