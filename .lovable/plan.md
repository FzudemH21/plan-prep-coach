

# Fix Athlete Calendar: Clear Week, Review Tests/Events, Master Planner Sync, and Intensities

## Issues to Fix

### 1. Clear Week not working
**Root cause**: `handleClearWeek` in `useAthleteCalendarEditing.ts` updates React state but relies on the debounced auto-save (300ms delay) to persist to localStorage. Per the architecture memory, clear operations should perform **immediate localStorage writes** and update `lastSavedStateRef` to bypass debounce. Additionally, the `assignmentDataCache` in `AthleteCalendarView.tsx` must be invalidated so the calendar re-reads the updated storage.

**Fix**: In `handleClearWeek` (and `handleClearDay` for consistency), after updating state, perform an immediate `localStorage.setItem` write and update `lastSavedStateRef.current`. Also expose an `invalidateCache` callback or event that `AthleteCalendarView.tsx` can react to. Alternatively, the simpler approach: after state updates in `handleClearWeek`, schedule an immediate save that bypasses debounce by reading current state + applying the clear.

### 2. Review Tests and Events in AssignProgramDialog shows duplicate entries
**Root cause**: The current implementation (lines 502-561 in `AssignProgramDialog.tsx`) renders each `reviewedSubGoal` as a separate entry. When the same test appears multiple times (on different dates), they show as separate rows. The user wants:
- Tests deduplicated by test method name
- Each unique test shows its scheduled dates as clickable badges
- Clicking a date badge opens a calendar popover to change the date
- X-ing out a date removes it; if all dates removed, the test disappears entirely

**Fix**: Refactor the "Step 4: Review Tests & Events" section:
- Group `reviewedSubGoals` by `testMethod` (or `parameterLinkedId`) so each unique test appears once
- Display scheduled dates as interactive badges with X buttons
- Add a calendar popover on each date badge to allow date changes
- When all dates for a test are removed, remove the test from `reviewedSubGoals`
- Same pattern for events

### 3. Intensity mismatch - assigned program intensities don't match source
**Root cause**: In `buildTrainingDaysFromAssignment` (line 138), the fallback intensity is `(meso.intensity || micro.intensity || 'moderate')`. This uses the mesocycle-level intensity rather than the per-day intensity that was stored in the program. When the assignment data is first created (in `AthleteCalendarView.tsx` `handleAssignProgram`), the daily intensity data from the source program should be date-shifted and stored. If the source program has per-day intensity overrides (stored in `dailyIntensityData` in localStorage), those need to be properly shifted and included in the assignment snapshot.

**Fix**: In `AthleteCalendarView.tsx` where the assignment is saved to localStorage (the `handleAssignProgram` callback), ensure the source program's `dailyIntensityData` is read from localStorage, date-shifted, and stored in the assignment snapshot. The `loadAssignmentForEditing` already reads `storedDailyIntensity` and uses it, so the issue is at assignment creation time.

### 4. Master Planner still shows "no session" when Calendar View shows sessions
**Root cause**: The `allAssignmentDays` memo (line 1617) uses `Math.max(daySessions, 1)` to build the sessions array even when `daySessions` is 0, but then filters with `daySessions > 0 ? sessions : []` on line 1634. However, the issue is that `daySplitStates` may not contain entries for all dates. When `hasExplicitSplitState` is false and `dayExercises.length > 0`, it correctly returns 1. But the `trainingDays` array may not include dates outside the original assignment range where content was pasted.

The Calendar View handles this via a broader date scanning approach (checks all dates in the visible range), while the Master Planner only iterates `trainingDays` which is limited to the original assignment's date range. If workouts are pasted outside this range, the Master Planner won't see them.

**Fix**: Extend `allAssignmentDays` to also include dates from `exerciseDistribution` and `daySplitStates` that aren't in `trainingDays`, creating synthetic entries for them. This aligns with the "continuous workout stream" model.

## Technical Plan

### File 1: `src/hooks/useAthleteCalendarEditing.ts`

1. **Fix `handleClearWeek`** (lines 979-1006): After state updates, perform an immediate localStorage write. Read current state, apply the clear transformations, build the save payload, write to localStorage, and update `lastSavedStateRef.current`.

2. **Fix `allAssignmentDays`** (lines 1605-1638): Extend to include dates from `exerciseDistribution` and `daySplitStates` that are not already in `trainingDays`. For these extra dates, create synthetic `trainingDay` entries so the Master Planner sees all content.

### File 2: `src/components/athletes/AssignProgramDialog.tsx`

3. **Refactor "Step 4: Review Tests & Events"** (lines 497-596):
   - Group `reviewedSubGoals` by `testMethod` + `parameterLinkedId` to deduplicate
   - Render each unique test once with: Baseline, Goal, Comments fields
   - Render scheduled dates as clickable Badge components with X buttons
   - Each date badge gets a Popover with a Calendar for changing the date
   - Removing all dates removes the test from the list
   - Same treatment for events

### File 3: `src/components/athletes/AthleteCalendarView.tsx`

4. **Fix intensity data at assignment creation time** (in `handleAssignProgram`): When creating assignment snapshot, read the source program's `dailyIntensityData` from localStorage, date-shift it, and include it in the saved snapshot. This ensures per-day intensity overrides from the source program are preserved.

5. **Invalidate `assignmentDataCache`** after clear week/day operations to force the calendar to re-read updated localStorage data.

## Expected Outcomes
- Clear Week removes all sessions/exercises for the week and persists immediately
- Review Tests/Events shows deduplicated tests with interactive date badges and calendar popovers
- Assigned program intensities match the source program's per-day settings
- Master Planner shows the same sessions as the Calendar View, including content pasted outside the original date range
- All changes sync bidirectionally between Master Planner and Calendar View

