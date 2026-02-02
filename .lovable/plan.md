
## Step-by-step investigation summary (what’s actually happening)

### A) Exercises “appear once, then disappear”
This is not because the program has no exercises. The exercises are being copied into the athlete assignment key, but then they get wiped out by an **auto-save race condition**:

- The athlete calendar loads assignment data from `localStorage` key: `athlete-assignment-{assignmentId}`.
- `useAthleteCalendarEditing` has an “auto-save” effect that writes the current in-memory state back to that same key.
- When you click/open a session, `selectedAssignmentId` changes → the hook starts loading the assignment…
- But **before the load finishes**, the auto-save effect can run once with the default empty state (`exerciseDistribution = []`) and overwrite the assignment storage with empty arrays.
- Result: you see exercises briefly, then they’re gone; leaving/re-entering the calendar shows everything reset to “moderate” and empty.

This is visible in:
- `src/hooks/useAthleteCalendarEditing.ts` (auto-save effect around lines ~200-226)

### B) Some programs assign with no exercises or missing days (e.g., only day 1 shows)
There is also a separate failure mode during assignment:

- `AthleteCalendarView.handleAssignProgram` uses `program.duration.startDate` as the “anchor” for date shifting.
- If `program.duration.startDate` is empty or invalid, date shifting can produce errors or invalid results, and exercises won’t land on the expected dates (or may fail to save cleanly).

This is in:
- `src/components/athletes/AthleteCalendarView.tsx` (originalStartDate logic around lines ~397-405)
- `src/utils/dateShifting.ts` (shift helpers assume valid dates)

### C) Intensities revert to “moderate”
This is mostly a consequence of (A): once the assignment snapshot gets overwritten, `dailyIntensity` becomes empty and the UI falls back to “moderate”.

Additionally, `WorkoutSessionSheet` reads session intensity from global localStorage keys:
- `sessionIntensity_${mesocycleId}_${dayDate}_${sessionIndex}`
If those keys don’t exist for the athlete-assigned dates, it falls back to “moderate”.

This is in:
- `src/components/microcycle-planning/WorkoutSessionSheet.tsx` (load effect around lines ~663-692)

## Implementation plan (what I will change)

### 1) Fix the auto-save race condition (prevents data wipeouts)
File: `src/hooks/useAthleteCalendarEditing.ts`

Changes:
- Introduce a synchronous `useRef` guard (example: `loadingAssignmentIdRef.current`) that is set **immediately** when `selectedAssignmentId` changes, before state updates.
- Update the auto-save effect to exit early if:
  - the hook is currently loading that assignment (checked via the ref), or
  - we haven’t completed the first successful load for that assignment yet.
- Remove the current `setTimeout(() => setIsInitializing(false), 100)` approach and instead mark loading complete deterministically after parsing and setting state.

Expected result:
- Assignment data (exercises, intensity, sections, etc.) will not get overwritten with empty defaults during navigation/open/close.
- Exercises will no longer “disappear” after reopening.

### 2) Make assignment date shifting robust (prevents missing days / “only first day has exercises”)
File: `src/components/athletes/AthleteCalendarView.tsx`

Changes:
- Replace `program.duration.startDate` as the sole anchor.
- Compute a reliable `originalStartDate` using the earliest valid date found in this order:
  1) `program.trainingDays[].date`
  2) `program.exerciseDistribution[].dayDate`
  3) `program.dailyIntensityData[].date`
  4) fallback: `program.duration.startDate` only if it’s valid
- If we still cannot compute a valid start date, show a clear toast error and do not create the assignment (or rollback the assignment creation).

Also:
- Wrap the shifting + localStorage save in a try/catch.
- If shifting fails, immediately delete the just-created assignment metadata to avoid leaving a broken assignment in the athlete database.

Expected result:
- Exercises and training days will be shifted correctly and appear on all the correct days, not just day 1.

### 3) Enforce “only assign programs that have at least one session” (your requested constraint)
Files:
- `src/components/athletes/AssignProgramDialog.tsx`

Changes:
- Tighten `availablePrograms` filtering so a program is only assignable if it has at least one real session.
- Practical rule (reliable with current data model): require `exerciseDistribution?.length > 0`.
  - This ensures at least one actual workout exists, which matches your “at least one session” requirement in a way that won’t allow empty templates.
- In the UI, show a helpful message if there are no assignable programs: “No programs with sessions available”.

Expected result:
- You can no longer assign “empty” programs that could trigger confusing states.

### 4) Fix intensity mismatch inside the opened session (remove “snap back to moderate”)
File: `src/components/microcycle-planning/WorkoutSessionSheet.tsx` (targeted change)
and possibly small glue in:
- `src/components/athletes/AthleteCalendarView.tsx`

Changes:
- Add an “external persistence” mode to `WorkoutSessionSheet` (for Athlete Calendar usage) so it does not read/write session intensity from the global `sessionIntensity_*` localStorage keys.
- In Athlete Calendar, session intensity should be derived from:
  - the assignment snapshot’s `dailyIntensity` for day intensity, and
  - (optionally) a new assignment-scoped session intensity map saved inside `athlete-assignment-{id}` if we want per-session intensity overrides.

Minimum viable version (fastest and already a big improvement):
- When used in Athlete Calendar, always initialize session intensity from the passed `dailyIntensityData` (day intensity) and do not overwrite it from global localStorage.

Expected result:
- When the calendar overview says “hard”, opening the session will also show “hard” and won’t revert to “moderate”.

## Verification checklist (end-to-end)
After implementing, you should be able to:
1) Assign an existing saved program to an athlete.
2) Open Day 1 session → see exercises.
3) Close and reopen the same session → exercises still there.
4) Open Day 2 session → exercises also there.
5) Navigate out of athlete profile and back into calendar → exercises and intensities remain.
6) Compare overview intensity vs opened session intensity → they match.

## Notes / why this will finally stabilize it
- The biggest “it worked for a second then broke” symptom is classic for an auto-save overwrite. Fixing that race condition is the key.
- The second major issue is invalid or inconsistent “start date anchors” causing shifting problems. Making the anchor robust prevents missing-day copying.
- Restricting assignable programs to those with at least one session eliminates a whole class of edge cases that don’t make sense in real coaching usage.
