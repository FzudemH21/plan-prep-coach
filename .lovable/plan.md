

# Fix "Clear Week" Not Working (Again)

## Problem

After the previous fix separated `isExplicitlyCleared` from `hasLiveData`, clearing a week stopped working because:

1. When a week is cleared, `daySplitStates[date]` is set to `0` and all exercises are removed
2. With the fix, `hasLiveData` is now `false` (since `isExplicitlyCleared` was removed from it)
3. So `usedLiveEditingState` stays `false`, and the code falls through to the fallback block (line 311)
4. In the fallback, the selected assignment hits the `isCleared` check at line 335 and skips via `return` -- but this only exits the `forEach` callback for that one assignment
5. The other 3 duplicate assignments (non-selected) still render from cache at lines 386-440, making sessions reappear

Additionally, you have 4 duplicate assignments from repeated assign attempts. The clear operation only affects the currently selected one.

## Solution

### 1. Restore `isExplicitlyCleared` in the top-level check, but handle it differently

Instead of including it in `hasLiveData` (which caused the previous bug of blocking other assignments), handle it as a separate branch that marks the day as "handled for the selected assignment" but still allows the fallback path to run for OTHER assignments -- while also skipping the selected assignment in the fallback path.

The approach: when a day is explicitly cleared for the selected assignment, we still need to enter the fallback path for non-selected assignments, but we must skip the selected assignment there. The current code already has the skip at line 335-338 for the fallback path's `isEditingAssignment` branch. The issue is that the top-level block (line 243-308) doesn't produce any sessions but also doesn't prevent the fallback from re-processing the selected assignment.

The simplest fix: add `isExplicitlyCleared` back to `hasLiveData` BUT also let the fallback path still run for other assignments. This means changing the fallback condition from `if (!usedLiveEditingState)` to always process non-selected assignments.

### 2. Refactored logic

```text
// Top-level: handle selected assignment's live data (including cleared state)
if (selectedAssignmentId) {
  // ... existing checks ...
  const hasLiveData = hasLiveExercises || hasLiveSessions || hasTestsOrEvents || isExplicitlyCleared;
  
  if (hasLiveData) {
    usedLiveEditingState = true;
    // Only render sessions if NOT explicitly cleared
    if (!isExplicitlyCleared && (numSessions > 0 || hasLiveExercises)) {
      // ... build sessions ...
    }
    // If isExplicitlyCleared, we skip session building but still mark usedLiveEditingState
  }
}

// Fallback: ALWAYS process non-selected assignments (even when usedLiveEditingState is true)
// But skip the selected assignment in the fallback since it was already handled above
const dayAssignments = assignments.filter(assignment => {
  if (assignment.id === selectedAssignmentId && usedLiveEditingState) return false; // already handled
  // ... existing date range check ...
});
```

This ensures:
- Cleared days for the selected assignment produce no sessions (empty calendar day)
- Other assignments on the same dates still render from cache
- The selected assignment is never double-processed

## Technical Changes

| File | Change |
|------|--------|
| `src/components/athletes/AthleteCalendarView.tsx` | Add `isExplicitlyCleared` back to `hasLiveData`. Guard session-building loop with `!isExplicitlyCleared`. Change fallback block to always run but skip the selected assignment when already handled by the live path. |

