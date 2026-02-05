
## Goal (confirming scope)
Yes — this is about the **Programming Wizard → Microcycle Planning → Step 2 “Training Calendar”** (route `/microcycle`), not the Athlete Calendar.

## What’s actually still broken (root cause)
Even though the “Add” button is now clickable, in the **“no existing tests/events yet”** case the dialog still has an internal state mismatch:

- When there are **no existing items** (`hasItems === false`), the UI correctly shows the **Create** form.
- But the dialog’s internal state still defaults to `mode === 'select'`.
- When you click **Add**, `handleConfirm()` currently only creates something if `mode === 'create'`.
- Result: the dialog closes, but **never calls `onSelect()`**, so:
  - `onAddTestEvent()` never runs
  - `handleAddTestEvent()` never updates `trainingDays`
  - therefore **no icon can appear** (because the calendar cell only renders icons when `trainingDay.testNames/eventNames` exist)

This matches your symptom precisely: “Add is clickable, but nothing happens.”

## Fix (once and for all)
Make the dialog treat **“no existing items”** as **Create mode**, not just for the disabled state (we already adjusted disabled), but also for the **confirm action**.

### File to change
- `src/components/microcycle-planning/CombinedTestEventDialog.tsx`

### Implementation steps
1. **Introduce a single source of truth** for confirm logic:
   - Add a derived boolean:
     - `const isCreateContext = mode === 'create' || !hasItems;`

2. **Update `handleConfirm()`** to use the derived boolean:
   - If `isCreateContext`:
     - require `newName.trim()`
     - call `onSelect({ ... isNew: true, goalValue, baselineValue, unit, comments })`
   - Else (true select mode):
     - require `selectedId`
     - call `onSelect({ ... isNew: false })`
   - Then close/reset as it already does.

3. **(Optional but recommended) Auto-set the mode when dialog opens**
   - Add an effect:
     - When `open === true` and `!hasItems`, set `mode` to `'create'`
   - This prevents future confusion and keeps the UI state consistent with what’s shown.

4. **Keep the existing disabled logic**, but refactor it to reuse `isCreateContext` (prevents future regressions):
   - `disabled={(!isCreateContext && hasItems && !selectedId) || (isCreateContext && !newName.trim())}`

## Why this will make the icon appear
Once `onSelect()` fires correctly:
- `TrainingDayCell.tsx` calls `onAddTestEvent(...)`
- `MicrocyclePlanningPage.tsx → handleAddTestEvent(...)` updates/creates the `TrainingDay` entry (your latest diff already handles the “day doesn’t exist” case)
- `TrainingCalendarView.tsx` recomputes `calendarDays` and sets `trainingDay` for that date
- `TrainingDayCell.tsx` sees `day.trainingDay.testNames/eventNames` and renders:
  - Trophy badge for tests
  - Calendar badge for events
  - HoverCard tooltip containing the scheduled names

## Verification checklist (end-to-end)
In `/microcycle` Step 2:
1. Pick a day → 3-dot menu → “Manage tests/events”
2. Select a parameter (test) or type an event name
3. Click **Add**
4. Confirm you now see at least one of:
   - Toast: “Test added” / “Event added”
   - Trophy/Calendar icon on that day cell
5. Hover the icon and confirm the tooltip lists the scheduled test/event name

## Notes / edge cases covered
- Works whether you have **0 existing tests/events** or many.
- Fix applies everywhere this dialog is used (Training Calendar day cell, Master Planner column, Workout Session Sheet).
