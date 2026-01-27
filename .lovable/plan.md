

## Fix: Superset Copying Between Mesocycles and Microcycles

### Problem
When copying exercises between mesocycles or microcycles, supersets are not being copied correctly. Exercises that are in a superset lose their superset connection after copying.

### Root Cause Analysis

**Issue 1: Missing `__unsectioned__` Handling in Mesocycle Copy**

The microcycle copy correctly handles the special `__unsectioned__` key:
```tsx
// Microcycle copy (CORRECT)
const newSectionId = oldSectionId === '__unsectioned__' 
  ? '__unsectioned__' 
  : (oldToNewSectionIds[oldSectionId] || oldSectionId);
```

But the mesocycle copy doesn't:
```tsx
// Mesocycle copy (BUG)
const newSectionId = oldToNewSectionIds[sectionId] || sectionId;
```

When supersets exist at the session level (not inside a section), they use `__unsectioned__` as the key. The mesocycle copy tries to remap this through `oldToNewSectionIds` which returns `undefined`, causing the fallback to use the original `__unsectioned__` string - but this happens incorrectly because the lookup logic differs.

**Issue 2: Superset Validity Check**

The current code only checks `if (newExerciseIds.length > 0)` before adding a superset. However, a valid superset requires at least 2 exercises. With `> 0`, orphan supersets with only 1 exercise could be copied.

---

### Solution

1. **Fix mesocycle copy superset handling**: Add the same `__unsectioned__` check as microcycle copy
2. **Fix superset validity check**: Change from `> 0` to `>= 2` in both functions to ensure only valid supersets are copied

---

### Implementation Details

**File**: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

#### Change 1: Fix Mesocycle Copy `__unsectioned__` Handling (Line 1686)

| Current | Fixed |
|---------|-------|
| `const newSectionId = oldToNewSectionIds[sectionId] \|\| sectionId;` | `const newSectionId = sectionId === '__unsectioned__' ? '__unsectioned__' : (oldToNewSectionIds[sectionId] \|\| sectionId);` |

#### Change 2: Fix Mesocycle Copy Superset Validity Check (Line 1694)

| Current | Fixed |
|---------|-------|
| `if (newExerciseIds.length > 0)` | `if (newExerciseIds.length >= 2)` |

#### Change 3: Fix Microcycle Copy Superset Validity Check (Line 1488)

| Current | Fixed |
|---------|-------|
| `if (newExerciseIds.length > 0)` | `if (newExerciseIds.length >= 2)` |

---

### Files Modified

| File | Changes |
|------|---------|
| `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx` | Fix `__unsectioned__` handling and superset validity checks in both copy functions |

---

### Testing Checklist

After implementation:
1. **Mesocycle Copy with Supersets**:
   - Add exercises to Mesocycle 1 and create supersets (A1/A2)
   - Copy Mesocycle 1 to Mesocycle 2
   - Verify supersets appear correctly in Mesocycle 2

2. **Microcycle Copy with Supersets**:
   - Add exercises to Microcycle 1 within a mesocycle and create supersets
   - Copy Microcycle 1 to Microcycle 2
   - Verify supersets appear correctly in Microcycle 2

3. **Edge Cases**:
   - Supersets without sections (`__unsectioned__`)
   - Supersets inside sections
   - 3+ exercise superset chains (A1/A2/A3)

