
## Goal
Eliminate the remaining “session opens after drop” behavior in Athlete Calendar drag-and-drop, without breaking normal click-to-open.

## What we know (from your console logs)
- `handleSessionDragEnd` is firing and moving sessions successfully.
- Immediately after some drops, `handleSessionClick` fires and opens a session.
- The click that opens the sheet sometimes targets a different session/day than the one that was dragged (example: drag 2/11 → 2/09, but click opens 2/10). This strongly suggests an “extra click” is being generated after the drag ends, and it lands on whatever is under the cursor at that moment.
- Our current protection is time-window based (300ms) and is applied in `AthleteCalendarDayCell` only. The fact that `handleSessionClick` still fires means the synthetic/delayed click is occurring after that 300ms window (common on some trackpads and especially touch devices where a click can be synthesized ~300ms later).

## Approach
Add a “belt + suspenders” suppression strategy that is robust to delayed/synthesized clicks:
1) **Global capture-phase click eater (most reliable):** after ANY drag completes, swallow exactly the next `click` event at the window/document level in capture phase. This prevents React’s delegated `onClick` from ever firing, regardless of which session/day ends up under the cursor.
2) **Keep local suppression, but increase slightly:** keep the existing `lastDragEndRef` time check in `AthleteCalendarDayCell`, increase it from 300ms → 500ms (or 600ms) as a backup.
3) **Guard at the final entry-point:** add the same suppression check at the start of `handleSessionClick` in `AthleteCalendarView.tsx`. This guarantees that even if some future UI path calls `handleSessionClick` without the per-card suppression, the sheet still won’t open right after a drop.

This combination is intentionally redundant: the global capture listener handles the intermittent cases; the local and entry-point checks prevent regressions.

---

## Files & changes

### 1) `src/components/athletes/AthleteCalendarView.tsx`
#### A. Add refs for global suppression
Add:
- `const suppressNextClickRef = useRef(false);`
- `const suppressNextClickTimeoutRef = useRef<number | null>(null);`

#### B. Install a capture-phase click listener (once)
Add a `useEffect` that:
- `window.addEventListener('click', handler, true)` (capture phase)
- In the handler:
  - If `suppressNextClickRef.current` is `true`:
    - set it to `false`
    - `event.preventDefault()`
    - `event.stopPropagation()`
    - optionally call `(event as any).stopImmediatePropagation?.()` for extra safety
- Cleanup on unmount.

This ensures the “post-drop click” never reaches React.

#### C. Mark suppression on drag end (and optionally drag start)
In `handleSessionDragEnd`:
- Keep `lastDragEndRef.current = Date.now()` at the very top.
- Add:
  - `suppressNextClickRef.current = true;`
  - Clear any existing timeout and set a new one to auto-reset after ~800ms (so a future real click isn’t swallowed if, for some reason, no click is generated after the drop).

Optional extra-hardening:
- Also set `suppressNextClickRef.current = true` inside `DragDropContext onDragStart` so the suppression is armed as soon as a drag begins. (Then the next click after the drag gesture will be swallowed no matter what.)

Update `DragDropContext` usage:
- Add `onDragStart={() => { suppressNextClickRef.current = true; }}`

#### D. Guard `handleSessionClick` itself
At the very top of `handleSessionClick`:
- If `Date.now() - lastDragEndRef.current < 600` then return without opening the sheet.

This is a final safety net.

---

### 2) `src/components/athletes/AthleteCalendarDayCell.tsx`
#### A. Increase the per-card suppression window slightly
Change:
- `if (Date.now() - dragEndTime < 300) return;`
to:
- `if (Date.now() - dragEndTime < 500) return;` (or 600ms)

This helps in cases where the click comes a bit after 300ms, and it aligns with the fact that some devices synthesize clicks around 300ms.

No other behavioral change needed here, since the global capture listener will do the heavy lifting.

---

## Why this should fix it
- The intermittent opening is caused by an extra click event after drag completion.
- Timing-based suppression can fail when that click is delayed (300ms is right on the edge for touch-like synthesized clicks).
- A capture-phase listener prevents the click from ever reaching React, regardless of delay and regardless of which element ends up under the cursor.
- The extra guards ensure we don’t regress later if other components trigger session opening.

---

## Testing checklist (acceptance)
1) Drag a session and drop it onto another day repeatedly (try fast drops and slower drops).
   - Expected: session moves; sheet does not open.
2) Drag and drop onto a day with many sessions and onto an empty day.
   - Expected: no sheet open.
3) Immediately after dropping, try to click a session intentionally.
   - Expected: the first click right after the drop may be swallowed; a second click should open normally.
4) Confirm normal (non-drag) clicking on session cards still opens the sheet reliably.

---

## Notes / small UX tradeoff
Swallowing the “next click” after a drag means that if a user intentionally tries to click immediately after dropping, that one click may be ignored. In practice this feels far better than the sheet randomly opening on drop, and the user can click again immediately.

If you prefer, we can narrow the behavior further (e.g., only swallow clicks within the calendar grid container rather than globally), but global capture is the most reliable fix with the least complexity.
