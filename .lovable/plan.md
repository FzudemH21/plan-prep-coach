
## Goal
Make Athlete Calendar copy/paste (week/day/session) and clear-week reliable and non-destructive:
- ✅ No more "appears for a split second then disappears"
- ✅ Paste keeps the correct intensity
- ✅ Clear week removes all sessions (no phantom sessions) and does not crash
- ✅ Parameters don't mysteriously "vanish" after assignment/paste

## Fixes Applied

### A) Stop the "reload loop" (COMPLETED)
**File:** `src/hooks/useAthleteCalendarEditing.ts`

Added:
- `assignmentsRef` - stable reference prevents loadAssignmentForEditing recreation
- `lastLoadedAssignmentIdRef` - prevents re-loading same assignment after paste/clear
- Load guard: `if (lastLoadedAssignmentIdRef.current === assignmentId) return;`

### B) Robust auto-save with debounce (COMPLETED)
**File:** `src/hooks/useAthleteCalendarEditing.ts`

Added:
- Full `JSON.stringify(savePayload)` fingerprint instead of counts-only
- 300ms debounce via `saveTimeoutRef`
- Set fingerprint on load to prevent immediate re-save

### C) Fix "0 sessions becomes 1" (COMPLETED)
**Files:**
- `src/components/athletes/AthleteCalendarView.tsx`
- `src/hooks/useAthleteCalendarEditing.ts`

Fixed:
- Replaced `||` with `??` for splitState checks
- Proper `hasLiveData` condition: exercises > 0 OR splitState > 0 OR tests/events
- Cleared days no longer show phantom "Session 1"

### D) Paste operations include complete metadata (COMPLETED)
**File:** `src/hooks/useAthleteCalendarEditing.ts`

Extended interfaces:
- `CopiedSession`: added `supersets`, `sourceMesocycleId`, `sourceMicrocycleId`, `sourceIntensity`
- `CopiedDay`: added `sourceMesocycleId`, `sourceMicrocycleId`

Updated handlers:
- `handleCopySession`: captures supersets and metadata
- `handlePasteSession`: creates complete TrainingDay with metadata when pasting outside range
- `handleCopyDay`: captures meso/micro IDs
- `handlePasteDay`: creates TrainingDay with metadata when pasting outside range
- Week paste already had merge logic, now carries intensity correctly

## Acceptance checks
1) ✅ Assign a program to an athlete.
2) ✅ Copy a session → paste outside range → stays visible with supersets
3) ✅ Copy a day → paste outside range → all sessions show
4) ✅ Copy a week → paste outside range → sessions persist with correct intensity
5) ✅ Clear week → no crash, all sessions removed
6) ✅ Refresh page → pasted/cleared state persists
