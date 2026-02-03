
## Goal
Make Athlete Calendar copy/paste (week/day/session) and clear-week reliable and non-destructive:
- No more “appears for a split second then disappears”
- Paste keeps the correct intensity
- Clear week removes all sessions (no phantom sessions) and does not crash
- Parameters don’t mysteriously “vanish” after assignment/paste

## What’s actually going wrong (root causes)
### 1) The editing hook is re-loading on (almost) every render
In `useAthleteCalendarEditing`, the “load assignment” effect depends on `loadAssignmentForEditing`, and that callback depends on the `assignments` array.

In `AthleteCalendarView`, `assignments` is derived from `useAthletes()`; that hook returns a new object each render, so `assignments` gets a new reference frequently. Result:
- `loadAssignmentForEditing` is recreated frequently
- the effect fires repeatedly
- it reloads state from localStorage repeatedly
- any paste/clear update you just did gets overwritten by the “re-load”, which matches your symptom: content flashes, then disappears
- this also explains the “Maximum update depth exceeded” style crashes (render → load → setState → render → load…).

### 2) “0 sessions” is treated as falsy and becomes “1 session”
There are multiple places using `||` where `0` is a valid value:
- `AthleteCalendarView` live branch: `const numSessions = liveSplitState || 1;`
- `useAthleteCalendarEditing` master planner builder: `daySplitStates[dateStr] || (...)`

So after you “Clear week” and set splitState to `0`, the UI often still shows a “Session 1” placeholder (and can look like clear didn’t work).

### 3) New days created outside the original assignment range are missing important TrainingDay metadata
When pasting outside the assigned range, we create a `TrainingDay` but currently omit fields like:
- `mesocycleId`, `microcycleId`
- `isTestDay`, `isEventDay`
This causes secondary breakage:
- parameter lookups can fail or show empty methods
- intensity lookups may fall back incorrectly
- session sheet context can become inconsistent

### 4) Auto-save “fingerprint” is too weak and can skip important saves
The current infinite-loop prevention compares only counts/lengths. That means changes to:
- parameterValues
- intensities (if exercise counts don’t change)
- trainingDay metadata
may not persist reliably.

## Implementation plan (in order)

### A) Stop the “reload loop” so paste/clear doesn’t get overwritten (main fix for flicker/disappear + crash)
**File:** `src/hooks/useAthleteCalendarEditing.ts`

1) Add a stable `assignmentsRef`
- `const assignmentsRef = useRef(assignments);`
- `useEffect(() => { assignmentsRef.current = assignments; }, [assignments]);`

2) Refactor `loadAssignmentForEditing` to read from `assignmentsRef.current` so the callback does not depend on the `assignments` array reference.
- This makes `loadAssignmentForEditing` stable across renders.

3) Add `lastLoadedAssignmentIdRef`
- Only load when `selectedAssignmentId` actually changes (or when we explicitly request a reload).
- This prevents state from being reloaded right after paste/clear updates.

**Expected result:** paste/clear updates remain in React state; no more “flash then revert”; crash risk drops drastically.

---

### B) Replace the weak auto-save fingerprint with a correct “save only if data changed” fingerprint + debounce
**File:** `src/hooks/useAthleteCalendarEditing.ts`

1) Build a `savePayload` that matches what we store:
```ts
const savePayload = {
  exerciseDistribution,
  sessionSections,
  supersets,
  parameterValues,
  dailyIntensity: dailyIntensityData,
  trainingDays,
  daySplitStates,
};
```

2) Create a fingerprint from `JSON.stringify(savePayload)` (excluding `lastModified`)
- Compare to `lastSavedStateRef.current`
- If identical: skip save
- If changed: update ref + save

3) Debounce saves (e.g., 250–400ms) with `setTimeout` in a `saveTimeoutRef`
- Prevents excessive writes during rapid UI interactions
- Still guarantees persistence

4) When loading from localStorage, set `lastSavedStateRef.current` to the loaded fingerprint so we don’t immediately re-save the same data and create churn.

**Expected result:** parameters/intensity edits persist consistently; no more “it worked then got lost” due to skipped saves.

---

### C) Fix “0 sessions becomes 1” everywhere (clear week/day must actually look cleared)
**Files:**
- `src/components/athletes/AthleteCalendarView.tsx`
- `src/hooks/useAthleteCalendarEditing.ts` (master planner builder)

1) Replace `||` with nullish logic where `0` is meaningful:
- `liveSplitState || 1` becomes something like:
  - use `??` and/or explicit checks so `0` stays `0`
- In master planner day session count builder, use `??` instead of `||`

2) Tighten the “hasLiveData” condition:
- Do not treat `trainingDay.isTrainingDay` alone as a reason to render sessions
- Use:
  - exercises exist OR splitState > 0 OR tests/events exist
- This prevents cleared days from still rendering “empty sessions”.

**Expected result:** Clear week/day removes sessions visually and functionally. No phantom “Session 1”.

---

### D) Make paste operations create complete TrainingDay entries (including meso/micro metadata) for out-of-range dates
**File:** `src/hooks/useAthleteCalendarEditing.ts`

1) Extend copied payloads to include day metadata needed for “session screenshot” behavior:
- For `CopiedDay`: include `sourceTrainingDay` (or at least `mesocycleId`, `microcycleId`, `testNames`, `eventNames`)
- For `CopiedWeek`: when building `newTrainingDayUpdates`, also carry `mesocycleId` and `microcycleId` from the source day into the target day entry (not just intensity).

2) When creating a new TrainingDay (target date not found), populate:
- `mesocycleId`, `microcycleId` (copied from source)
- `isTestDay`, `isEventDay` (derived from copied names)
- keep intensity copied correctly
- sessions/sessionNames set correctly

**Expected result:** pasted sessions keep their method parameter context (the “screenshot” idea), and the session sheet won’t lose method parameters just because the date is outside the original program range.

---

### E) Fix session paste specifically (currently missing the “create missing day” logic)
**File:** `src/hooks/useAthleteCalendarEditing.ts`

1) Update `handlePasteSession` to:
- If `trainingDays` has no entry for `targetDate`, add one (merge logic like we already did for day/week paste)
- Set `daySplitStates[targetDate]` starting from `0` (not `1`) if the date is brand new
- Optionally: if the date is brand new, initialize day intensity from the copied session’s source day intensity

2) Copy supersets for session paste (so “everything” truly comes along)
- Capture the source session’s superset structure from `supersets[sourceDate]?.[sourceSessionIndex]`
- Remap section IDs and exercise IDs to the newly generated IDs
- Insert into `supersets[targetDate][newSessionIndex]`

**Expected result:** “Copy session → Paste session” works even outside range, including sections + supersets.

---

### F) Fix intensity correctness during week paste
**Files:**
- `src/hooks/useAthleteCalendarEditing.ts`
- `src/components/athletes/AthleteCalendarView.tsx` (display fallback improvements)

1) Ensure week paste sets intensity in both places:
- `trainingDays[targetDate].intensity`
- `dailyIntensityData` entry for that date

2) In `AthleteCalendarView`, if dailyIntensityData is missing for a date, fall back to `trainingDays` intensity for display (so the UI doesn’t show “moderate” just because intensity array is incomplete).

**Expected result:** pasted week/day shows the expected intensity immediately, without relying on a later save/reload.

---

## Acceptance checks (end-to-end)
1) Assign a program to an athlete.
2) Copy a session with exercises + supersets. Paste it to a date outside the assignment range.
   - It stays visible (no flash/disappear).
   - Opening the session shows the same sections + superset groupings.
3) Copy a full day and paste it outside range.
   - All sessions, sections, supersets show.
4) Copy a week and paste it outside range.
   - Sessions persist and do not revert.
   - Intensity matches the source week.
5) Clear a week.
   - No crash.
   - All sessions for that week are gone (calendar shows empty days with only “Add Session”).
6) Refresh the page.
   - The pasted/cleared state persists (verifies auto-save correctness).

## Files that will be updated
- `src/hooks/useAthleteCalendarEditing.ts`
  - stabilize loading (assignmentsRef + lastLoaded guard)
  - robust debounced auto-save fingerprint
  - session paste: add missing day + superset remap
  - paste week/day: carry meso/micro metadata
  - clear week/day: ensure splitState=0 behaves correctly
- `src/components/athletes/AthleteCalendarView.tsx`
  - fix `0` session handling
  - correct live “has data” rules so cleared days don’t render sessions
  - intensity display fallback

## Notes on the bigger redesign (your “workouts, not assigned programs” vision)
The above fixes make today’s system behave like your intended “screenshot then independent workouts” model (sessions can exist on any date, keep their context, and don’t get constrained by the original assignment window), without yet removing the assignment concept. After stability is restored, we can safely remove/hide the “Assigned Programs” UI and evolve the data model toward true per-athlete workouts.
