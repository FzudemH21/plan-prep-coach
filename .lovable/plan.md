
### What’s actually going wrong (root cause)
Right now, the Athlete Calendar “overview” and the “opened session” are reading **two different sources of truth**:

- **Calendar overview (grid)** is built from `assignmentDataCache[assignmentId]` (the snapshot stored in `localStorage` under `athlete-assignment-{assignmentId}`), so it can show the correct day intensity.
- **WorkoutSessionSheet (when you click a session)** is currently fed from `useAthleteCalendarEditing(selectedAssignmentId, assignments)` — but **`selectedAssignmentId` is not being synchronized to the assignment you clicked**.  
  So the sheet often loads the “wrong” assignment (or none), which causes:
  - `exercisesCount = 0` (because it’s filtering exercises from the wrong assignment)
  - Day/session intensity falling back to `moderate` (because it can’t find the correct `dailyIntensityData`)
  - `mesocycleId` sometimes being empty (sheet is opening before required IDs exist)

Additionally, even when the correct assignment is selected:
- The sheet is always passed `mesocycleId={editing.selectedAssignment?.assignedMesocycles[0]?.id || ''}` and `microcycleIndex={0}`, which can be wrong for a clicked date if you have multiple mesocycles/microcycles. That breaks parameter/intensity lookups inside the sheet and contributes to the “moderate” fallback behavior.

Finally:
- The calendar overview is currently hardcoding session names as `${meso.name} - Day X` instead of using the **real session names** stored in `trainingDays.sessionNames`.

---

### Goal / Acceptance criteria
After the fix:
1. **Exercises appear** in the Athlete Calendar sessions (both in the overview count and inside the opened WorkoutSessionSheet).
2. **Intensity matches**: if the overview shows “hard”, opening the workout shows Day intensity “hard” and Session intensity “hard” (unless the user explicitly changed session intensity).
3. **Session names match the plan**: the calendar overview shows the real session names from the planning wizard, not “Mesocycle 1 / Day 1”.

---

### Implementation plan (what I’ll change)

#### 1) Make session clicks unambiguous: pass the assignmentId through the click chain
Today, `AthleteCalendarDayCell` calls `onSessionClick(dayDate, sessionIndex)` and `AthleteCalendarView` tries to “guess” which assignment that date belongs to by scanning assignments. This is fragile and is a major source of “wrong assignment loaded”.

Changes:
- Update `AthleteCalendarDayCell` → `onSessionClick` to include `assignmentId`
  - New signature: `onSessionClick(dayDate: string, sessionIndex: number, assignmentId: string)`
- Update `AthleteCalendarWeekRow` to pass it through.
- Update `AthleteCalendarView.handleSessionClick` to use the provided assignmentId directly.

Result: clicking a session always targets the correct assignment snapshot.

Files:
- `src/components/athletes/AthleteCalendarDayCell.tsx`
- `src/components/athletes/AthleteCalendarWeekRow.tsx`
- `src/components/athletes/AthleteCalendarView.tsx`

---

#### 2) Synchronize the editing context to the clicked assignment BEFORE opening the sheet
When the user clicks a session:
- Set `selectedAssignmentId` to the clicked session’s `assignmentId`
- Set `selectedSessionInfo` to `{ dayDate, sessionIndex, assignmentId }`
- Open the sheet

Additionally, prevent “blank props” renders:
- Only render/open `WorkoutSessionSheet` when `selectedSessionInfo` exists and has a non-empty `dayDate` and `assignmentId`.
- (Optional but recommended) show a lightweight “Loading session…” state until `editing.selectedAssignment?.id === selectedSessionInfo.assignmentId`.

This removes the repeated console logs where `dayDate: ""` / `mesocycleId: ""` and avoids initializing the sheet against empty IDs.

Files:
- `src/components/athletes/AthleteCalendarView.tsx`

---

#### 3) Feed WorkoutSessionSheet the correct mesocycleId + microcycleIndex for the clicked day
Inside AthleteCalendarView (right before rendering WorkoutSessionSheet):
- Locate the clicked `trainingDay` from `editing.trainingDays` by `dayDate`
- Use that to compute:
  - `mesocycleId = trainingDay.mesocycleId` (instead of always using the first mesocycle)
  - `microcycleIndex` by finding `trainingDay.microcycleId` within the relevant `assignedMesocycle.microcycles[]`

Also pass:
- `trainingDay={trainingDay}`
- `totalSessionsOnDay={editing.daySplitStates[dayDate] ?? trainingDay.sessions ?? 1}`
- `sessionNameFromState={trainingDay.sessionNames?.[sessionIndex]}`

Result:
- Day intensity lookup inside the sheet will use the correct `dailyIntensityData` and dayDate
- Session intensity key lookups use the correct `mesocycleId`
- Session title can show the actual session name

Files:
- `src/components/athletes/AthleteCalendarView.tsx`

---

#### 4) Fix the calendar overview session names (and support multiple sessions per day)
Update the `calendarDays` builder in `AthleteCalendarView.tsx`:
- Instead of always creating a single session named `${meso.name} - Day X`, build sessions like the planning wizard does:
  - Use cached assignment snapshot (`assignmentDataCache[assignment.id]`) to fetch:
    - `trainingDays` (for sessionNames)
    - `daySplitStates` (for how many sessions exist)
    - `exerciseDistribution` (for per-session exercise counts)
    - `dailyIntensity` (for day intensity)
  - Create one session row per sessionIndex:
    - `sessionName = trainingDay.sessionNames?.[i] || Session ${i+1}`
    - `exerciseCount = number of exercises where dayDate===dateString && sessionIndex===i`
    - `intensity = localStorage sessionIntensity (if present) else dayIntensity`

Also: store assignmentId on each session object (so click handling is correct).

Result:
- Overview shows real session names (what you asked for)
- Overview and sheet intensities align
- Multi-session days render properly

Files:
- `src/components/athletes/AthleteCalendarView.tsx`
- (minor typing updates) `src/components/athletes/AthleteCalendarDayCell.tsx`

---

#### 5) Verification / debugging hooks (temporary logs)
Add a small number of targeted logs (and remove/limit them afterward if noisy):
- On session click: log `assignmentId`, `dayDate`, `sessionIndex`, and counts from:
  - `assignmentDataCache[assignmentId]?.exerciseDistribution?.length`
  - `editing.exerciseDistribution.length` after the assignment switches

This will confirm whether the issue was “wrong assignment context” vs “data truly missing”.

Files:
- `src/components/athletes/AthleteCalendarView.tsx`

---

### Why this will fix both problems you reported
- **No exercises shown**: today the sheet is filtering exercises from the wrong assignment’s editing state; syncing `selectedAssignmentId` to the clicked assignment fixes it.
- **Intensity mismatch**: the sheet is looking up intensity from the wrong assignment (or with wrong mesocycleId/dayDate); passing the correct `trainingDay.mesocycleId`, `microcycleIndex`, and correct assignment selection fixes it.
- **Session names wrong in overview**: currently hardcoded; switching to `trainingDays.sessionNames` fixes it.

---

### Files that will be changed
- `src/components/athletes/AthleteCalendarView.tsx` (main fixes: session selection, sheet wiring, session name/intensity building)
- `src/components/athletes/AthleteCalendarDayCell.tsx` (include assignmentId in session click)
- `src/components/athletes/AthleteCalendarWeekRow.tsx` (pass updated click signature through)

