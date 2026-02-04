
## Goal
Fix two athlete-calendar bugs:

1) **Multi-session intensity decoupling (overview day square):** Changing the *day* intensity from the calendar overview must **not** modify any *session* intensity when the day has 2+ sessions.

2) **Drag/drop sessions (calendar overview):** Dragging works, but **dropping opens the session sheet and doesn’t move the session**. We need sessions to actually move day-to-day, and dropping should not trigger a “click-to-open” side-effect.

---

## Findings (what’s currently happening)

### A) Why day-intensity changes session intensity (multi-session)
In `AthleteCalendarView.tsx`, session cards are built like this:

- `dayIntensity` is computed from `editing.dailyIntensityData` / `editing.trainingDays`
- each session’s `intensity` is computed as:
  - `editing.sessionIntensities[${date}-${idx}] ?? dayIntensity`

So if `sessionIntensities` **doesn’t have explicit values** for session 0/1, both sessions “inherit” `dayIntensity`. When you change day intensity, the UI recomputes and both sessions appear to change.

Also, in `AthleteCalendarDayCell.tsx`, the “day intensity square” is currently rendered from `day.sessions[0].intensity` (session 0), not from an actual day-intensity field. On a multi-session day this is conceptually wrong and amplifies the confusion.

### B) Why dropping opens the session and doesn’t move it
There are two underlying issues:

1) **Click-suppression uses React state**, not a ref:
   - `AthleteCalendarView` stores `lastDragEndTimestamp` in state and passes it down.
   - On drop, `setLastDragEndTimestamp(Date.now())` runs, but React won’t re-render and propagate the new prop **before the click event fires**.
   - Result: the session card’s `onClick` still sees the *old* timestamp and opens the sheet.

2) **Drop targets are incomplete / too narrow**:
   - `AthleteCalendarDayCell` only renders a `<Droppable>` when `hasTraining` is true.
   - Dropping onto an empty day (or onto a part of the card outside the droppable area) can yield `destination = null`, so no move happens.
   - When no move happens, the click opens the session sheet, making it feel like “drop = open”.

---

## Fix approach (high-level)
### 1) Make multi-session session intensities truly independent
- Add a **day-level intensity** to `AthleteCalendarDay` and render the overview square from it (not from session 0).
- Ensure that whenever a day has **2+ sessions**, `useAthleteCalendarEditing` guarantees `sessionIntensities` has entries for **every session index**, initialized once (default = current day intensity), without overwriting later.
- Ensure move/add/delete session operations **also move/shift** entries in `sessionIntensities`.

### 2) Make drag/drop reliable and prevent “drop opens sheet”
- Replace `lastDragEndTimestamp` state with a **ref** that updates synchronously (`lastDragEndRef.current = Date.now()`), and pass that ref down so the click handler sees it immediately.
- Render a `<Droppable>` for **every day cell**, including empty days, and make the droppable cover the **whole day card** (or at least the full content area) so “drop anywhere in the day” is recognized.

---

## Concrete code changes (by file)

### A) `src/components/athletes/AthleteCalendarView.tsx`
1) **Stop using state for drag-end suppression**
   - Replace:
     - `const [lastDragEndTimestamp, setLastDragEndTimestamp] = useState(0);`
   - With:
     - `const lastDragEndRef = useRef(0);`
   - Update `handleSessionDragEnd`:
     - set `lastDragEndRef.current = Date.now()` at the **top** of the handler (even if `destination` is null or same-day).

2) **Pass the ref down**
   - Change props passed to `AthleteCalendarWeekRow` from `lastDragEndTimestamp={...}` to `lastDragEndRef={lastDragEndRef}`.

3) **Add explicit day intensity to calendar day objects**
   - Extend `AthleteCalendarDay` shape returned in `calendarDays` to include `intensity: dayIntensity`.
   - This lets the overview day-square represent the true day intensity even if session 0 differs.

4) (Optional cleanup) **Avoid duplicate toasts**
   - Currently `editing.handleMoveSession` also toasts, and `handleSessionDragEnd` toasts too.
   - Choose one place for the toast (preferably the UI layer: `AthleteCalendarView`) and remove/disable the other to prevent double messages.

---

### B) `src/components/athletes/AthleteCalendarWeekRow.tsx`
- Update prop interface and passthrough:
  - Replace `lastDragEndTimestamp?: number` with `lastDragEndRef?: React.MutableRefObject<number>` (or a suitably typed ref).
- Pass it to `AthleteCalendarDayCell`.

---

### C) `src/components/athletes/AthleteCalendarDayCell.tsx`
1) **Render droppable for every day**
   - Move `<Droppable>` so it wraps the day content even when there are no sessions.
   - Ensure the droppable container has a usable height (e.g. `min-h-[100px]`) and covers the part of the card users naturally drop onto.
   - Add a “Drop here” hint when `isDraggingOver` and the day is empty (copy the TrainingDayCell pattern).

2) **Use day-level intensity for the day square**
   - Update the clickable intensity square to use `day.intensity` (new field) rather than `day.sessions[0].intensity`.
   - Highlight selected intensity in the popover based on `day.intensity`.

3) **Use ref-based click suppression**
   - Replace `lastDragEndTimestamp` usage with `lastDragEndRef.current` in the session card `onClick`:
     - if `Date.now() - lastDragEndRef.current < 200`, do nothing.
   - This will reliably prevent “drop triggers click” without waiting for re-render.

---

### D) `src/hooks/useAthleteCalendarEditing.ts`
1) **Guarantee `sessionIntensities` exists for multi-session days**
   - Add a `useEffect` that runs when `daySplitStates`, `dailyIntensityData`, or `trainingDays` changes:
     - For each day where `sessionCount > 1`, ensure keys:
       - `${dayDate}-0` ... `${dayDate}-${sessionCount-1}`
     - Initialize missing keys to that day’s current intensity (from `dailyIntensityData` or `trainingDays`).
     - Do not overwrite existing keys.

2) **Upsert dailyIntensity/trainingDays for out-of-range dates**
   - Update `handleDayIntensityChange` so that if a `dailyIntensityData` entry for `dayDate` doesn’t exist, it is created (same for `trainingDays` day record if needed).
   - This keeps day intensity consistent when users create/move sessions outside the original assignment range.

3) **Move/shift session intensity when sessions move**
   - In `handleMoveSession`:
     - Move the source session intensity key to destination key.
     - Shift intensity keys down for source day indices `> sourceSessionIndex`.
     - Initialize destination intensity if missing (prefer: moved value; else source day intensity; else day intensity).

4) **Shift session intensity when sessions are deleted**
   - In `handleDeleteSession`:
     - Remove `${dayDate}-${sessionIndex}`
     - Shift keys for indices above it down by 1
     - Optionally clean up keys when a day becomes 0 sessions.

5) **Initialize per-session intensity when adding a session**
   - In `handleAddSession`:
     - Use `prev[dayDate] ?? 0` (not `?? 1`) to avoid creating “2 sessions by default” for previously-untracked dates.
     - When transitioning to 2+ sessions, ensure session 0 and the new session get initialized to current day intensity.

---

## Acceptance tests (what to verify after implementation)

### Drag/drop
1) Drag a session from a day with sessions → drop onto an **empty day**:
   - session appears on the target day
   - source day session count decrements
   - **session sheet does not open**

2) Drag a session → drop onto a day that already has sessions:
   - session is appended as a new session (current behavior)
   - **session sheet does not open**

3) Drag a session → drop outside any day:
   - session snaps back
   - **session sheet does not open** (click suppression should still prevent it)

### Intensity
1) Create a day with 2 sessions. Set session intensities differently (in the sheet).
2) In calendar overview, change the **day intensity square**:
   - the day square updates
   - each session’s intensity indicator stays unchanged
3) Open each session sheet after changing day intensity:
   - per-session intensity is preserved
   - day intensity reflects the new day setting

---

## Scope note
This plan keeps “drop position within a day” out of scope (we append moved sessions to the end of the destination day), matching the existing move behavior. If you want true reordering within a day based on drop index, we can add that after the base move is stable.
