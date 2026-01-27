

## Fix: Cross-Mesocycle Copy Missing Section ID Remapping

### Problem
When copying a mesocycle setup to another mesocycle, exercises are appearing outside of their sections (as seen in your screenshot where "Squat" and "RDL" appear above "Section 1" instead of inside it). This also causes sessions to not appear in the Training Calendar.

### Root Cause
The `handleCopyFromPreviousMesocycle` function in `EnhancedExerciseDistribution.tsx` has a critical bug:

1. **Wrong order**: It copies exercises BEFORE sections
2. **Missing mapping**: It doesn't create an `oldToNewSectionIds` mapping
3. **No remapping**: Exercises keep their original `sectionId` which doesn't exist in the target mesocycle
4. **Superset issue**: Supersets also use old section IDs without remapping

In contrast, the working microcycle copy (`handleCopyMicrocycleSetup`) correctly:
1. Copies sections FIRST, building an `oldToNewSectionIds` map
2. Copies exercises AFTER, remapping `sectionId` using: `sectionId: exercise.sectionId ? oldToNewSectionIds[exercise.sectionId] : undefined`

---

### Solution
Reorder the mesocycle copy logic to match the working microcycle copy pattern:

1. **Copy sections FIRST** - Create the `oldToNewSectionIds` mapping while doing so
2. **Copy exercises SECOND** - Use the mapping to remap each exercise's `sectionId`
3. **Copy supersets THIRD** - Use the mapping to remap section IDs in the superset structure

---

### Implementation Details

**File**: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`

#### Change: Restructure `handleCopyFromPreviousMesocycle` (Lines 1606-1696)

**Current (broken) order:**
```tsx
// Line 1606: Initialize arrays
const newExercises: ExerciseDistribution[] = [];
const newSections: SessionSection[] = [];
const oldToNewExerciseIds: Record<string, string> = {};  // Missing oldToNewSectionIds!

// Lines 1628-1646: Copy exercises FIRST (no sectionId remapping!)
newExercises.push({
  ...exercise,
  id: newId,
  dayDate: targetDate,
  // BUG: sectionId not remapped!
});

// Lines 1649-1665: Copy sections AFTER (mapping not stored!)
newSections.push({
  ...section,
  id: `section-${Date.now()}-...`,  // New ID created but not mapped!
  dayDate: targetDate,
});
```

**Fixed order:**
```tsx
// Initialize arrays with section mapping
const newExercises: ExerciseDistribution[] = [];
const newSections: SessionSection[] = [];
const oldToNewExerciseIds: Record<string, string> = {};
const oldToNewSectionIds: Record<string, string> = {};  // ADD THIS

// STEP 1: Copy sections FIRST, building the mapping
sourceDays.forEach((sourceDay, dayIndex) => {
  // ... get targetDate ...
  const sourceDateSections = sessionSections.filter(s => s.dayDate === sourceDay.date);
  
  sourceDateSections.forEach(section => {
    const newSectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    oldToNewSectionIds[section.id] = newSectionId;  // STORE MAPPING
    
    newSections.push({
      ...section,
      id: newSectionId,
      dayDate: targetDate,
    });
  });
});

// STEP 2: Copy exercises AFTER, using the mapping
sourceDays.forEach((sourceDay, dayIndex) => {
  // ... get targetDate ...
  const sourceDateExercises = exerciseDistribution.filter(ex => ex.dayDate === sourceDay.date);
  
  sourceDateExercises.forEach(exercise => {
    const newId = `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    oldToNewExerciseIds[exercise.id] = newId;
    
    newExercises.push({
      ...exercise,
      id: newId,
      dayDate: targetDate,
      sectionId: exercise.sectionId ? oldToNewSectionIds[exercise.sectionId] : undefined,  // REMAP
    });
  });
});

// STEP 3: Copy supersets, using both mappings
// ... also remap sectionId in superset structure ...
const newSectionId = oldToNewSectionIds[sectionId] || sectionId;
newSupersets[targetDate][sessionIndex][newSectionId] = { ... };
```

---

### Files Modified

| File | Changes |
|------|---------|
| `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx` | Reorder section/exercise copy, add `oldToNewSectionIds` mapping, remap exercise `sectionId` and superset section IDs |

---

### Testing Checklist

After implementation:
1. Add exercises to sessions in Mesocycle 1 (sections should auto-create)
2. Copy Mesocycle 1 setup to Mesocycle 2
3. Verify exercises appear INSIDE their sections (not above/outside)
4. Verify sessions appear correctly in Training Calendar (Step 2)
5. Verify supersets are preserved and work correctly in the copied mesocycle

