

## Prevent Sessions for "Off" Days in Step 1 of Microcycle Planning

### Overview

When a day's intensity is set to "off" in Step 2 of Mesocycle Planning (Daily Training Intensity Planning), Step 1 of Microcycle Planning should not show any sessions for that day by default. Currently, the system defaults to 1 session per day regardless of intensity.

---

### Current Behavior

The session count per day is determined by `daySplitStates`. When there's no entry for a day:

1. **MicrocyclePlanningPage.tsx (line 382)**: `sessions: daySplitStates[day.date] ?? 1` - defaults to 1 session
2. **EnhancedExerciseDistribution.tsx (line 2124)**: `const sessionsCount = day.sessions ?? 1` - also defaults to 1

This means every training day shows at least 1 session, even if intensity is "off".

---

### Solution

Modify the default session count logic to check the day's intensity level. If intensity is "off", default to 0 sessions instead of 1.

---

### Changes

#### File 1: `src/pages/MicrocyclePlanningPage.tsx`

**Change 1: Sync day split states with intensity awareness (lines 377-385)**

```typescript
// BEFORE
useEffect(() => {
  setTrainingDays(prev => 
    prev.map(day => ({
      ...day,
      sessions: daySplitStates[day.date] ?? 1
    }))
  );
}, [daySplitStates]);

// AFTER
useEffect(() => {
  setTrainingDays(prev => 
    prev.map(day => {
      // If there's a saved split state, use it
      if (daySplitStates[day.date] !== undefined) {
        return { ...day, sessions: daySplitStates[day.date] };
      }
      // Otherwise, default to 0 if intensity is "off", else 1
      const defaultSessions = day.intensity === 'off' ? 0 : 1;
      return { ...day, sessions: defaultSessions };
    })
  );
}, [daySplitStates]);
```

**Change 2: Update default when intensity changes to "off" (within intensity change handlers)**

When a day's intensity is changed to "off" and there are no exercises on that day, automatically set session count to 0. Conversely, when changed from "off" to another intensity, ensure at least 1 session exists if none.

This needs to be added to the `handleDayIntensityChange` function. Currently this function updates intensity, but now it should also update `daySplitStates` accordingly.

---

#### File 2: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

**Change: Update default session count fallback (line 2124)**

```typescript
// BEFORE
const sessionsCount = day.sessions ?? 1;

// AFTER
const sessionsCount = day.sessions ?? (day.intensity === 'off' ? 0 : 1);
```

---

### Behavior After Changes

| Intensity | Has Saved Split State | Has Exercises | Result |
|-----------|----------------------|---------------|--------|
| off | No | No | 0 sessions (no card shown) |
| off | No | Yes | Sessions match exercises |
| off | Yes (e.g., 2) | Any | 2 sessions (user explicitly set) |
| moderate | No | No | 1 session (default) |
| moderate | Yes (e.g., 3) | Any | 3 sessions |

---

### Edge Cases Handled

1. **User manually adds sessions on an "off" day**: This will create a `daySplitStates` entry, which takes precedence over the default
2. **Exercises already allocated to an "off" day**: Sessions will still be created for those exercises since they exist in `exerciseDistribution`
3. **Intensity changed from "off" to "moderate"**: The default kicks in (1 session) if no saved state exists
4. **Intensity changed from "moderate" to "off"**: Existing exercises remain; only the default changes

---

### Summary

| File | Lines | Change |
|------|-------|--------|
| MicrocyclePlanningPage.tsx | 377-385 | Add intensity check when defaulting session count |
| EnhancedExerciseDistribution.tsx | 2124 | Add intensity check in fallback default |

This ensures that "off" days don't show a session by default, matching the expectation that no training = no session card.

