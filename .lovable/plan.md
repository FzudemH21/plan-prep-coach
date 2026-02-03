

# Fix Intensity Not Being Copied During Paste Operations

## Problem Identified

After analyzing the copy/paste handlers, I found specific bugs where intensity is **not properly applied when pasting to dates that already exist**:

### Session Paste Bug (`handlePasteSession`)
1. **Line 533-538**: When updating an existing day, the `intensity` field is NOT included in the update
2. **Line 562-563**: `dailyIntensityData` keeps existing intensity instead of applying the copied source intensity

### Week Paste Issue
The week paste handler (lines 911 and 1007-1018) correctly applies intensity for new days, but may have edge cases where intensity isn't propagated correctly. The fix will ensure consistent behavior.

### Day Paste - Works Correctly
The day paste handler (lines 692-728) already updates intensity correctly in both `trainingDays` and `dailyIntensityData`.

---

## Solution

### File: `src/hooks/useAthleteCalendarEditing.ts`

#### Fix 1: Session Paste - Update intensity for existing days

**Current code (lines 526-538):**
```typescript
if (existingIdx >= 0) {
  // Update existing day
  const existingDay = updated[existingIdx];
  const sessionNames = [...(existingDay.sessionNames || [])];
  while (sessionNames.length <= newSessionIndex) {
    sessionNames.push(`Session ${sessionNames.length + 1}`);
  }
  updated[existingIdx] = {
    ...existingDay,
    sessions: newSplitState,
    sessionNames,
    isTrainingDay: true,
    // MISSING: intensity field!
  };
}
```

**Fixed code:**
```typescript
if (existingIdx >= 0) {
  // Update existing day - include intensity from source session
  const existingDay = updated[existingIdx];
  const sessionNames = [...(existingDay.sessionNames || [])];
  while (sessionNames.length <= newSessionIndex) {
    sessionNames.push(`Session ${sessionNames.length + 1}`);
  }
  updated[existingIdx] = {
    ...existingDay,
    sessions: newSplitState,
    sessionNames,
    isTrainingDay: true,
    intensity, // FIX: Apply copied intensity
  };
}
```

#### Fix 2: Session Paste - Update dailyIntensityData for existing days

**Current code (lines 560-566):**
```typescript
setDailyIntensityData(prev => {
  const existingIdx = prev.findIndex(di => di.date === targetDate);
  if (existingIdx >= 0) {
    return prev; // Keep existing intensity <-- BUG
  }
  return [...prev, { date: targetDate, intensity }].sort(...);
});
```

**Fixed code:**
```typescript
setDailyIntensityData(prev => {
  const updated = [...prev];
  const existingIdx = updated.findIndex(di => di.date === targetDate);
  if (existingIdx >= 0) {
    // FIX: Update existing entry with copied intensity
    updated[existingIdx] = { ...updated[existingIdx], intensity };
    return updated;
  }
  return [...updated, { date: targetDate, intensity }].sort((a, b) => a.date.localeCompare(b.date));
});
```

---

## Summary of Changes

| Location | Issue | Fix |
|----------|-------|-----|
| `handlePasteSession` lines 533-538 | Missing `intensity` when updating existing day | Add `intensity` field to update object |
| `handlePasteSession` lines 560-566 | Keeps old intensity for existing days | Update existing entry with source intensity |

---

## Expected Outcome

After this fix:
- **Copy Session → Paste Session**: Intensity from source day is applied to target day
- **Copy Day → Paste Day**: Already works (no changes needed)
- **Copy Week → Paste Week**: Intensity is correctly copied from each source day

The intensity indicator on the calendar should now match the source day's intensity after any paste operation.

