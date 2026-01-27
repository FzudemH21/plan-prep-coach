

# Athlete Calendar Feature Implementation Plan

## Summary
Add a calendar view to each athlete's profile where coaches can assign training programs (or specific mesocycles/microcycles). When assigning, dates are automatically shifted to the new start date, and a warning is shown if there's a significant date mismatch from the original program.

---

## Visual Integration Options

The Athlete Calendar will be added as a **tabbed view** within the Athlete Profile page. When viewing an athlete, the user will see:

```text
+------------------------------------------+
| [Profile] [Calendar]                     |  <-- Tab navigation
+------------------------------------------+
| (Currently: Profile Information Card)    |
| (Or: Calendar View with assignments)     |
+------------------------------------------+
```

**Recommendation**: Tabs at the top of the athlete content area, switching between "Profile" (current view) and "Calendar" (new view).

---

## Data Model

### New Type: `AthleteCalendarAssignment`

```typescript
interface AthleteCalendarAssignment {
  id: string;
  athleteId: string;
  programId: string;           // Reference to source TrainingProgram
  programName: string;         // Snapshot of program name at assignment time
  
  // Assignment dates (shifted to athlete's calendar)
  startDate: string;           // ISO date string
  endDate: string;             // ISO date string
  
  // Original program dates (for reference/warning)
  originalStartDate: string;
  originalEndDate: string;
  
  // Selection filters (what portions were assigned)
  selectedMesocycleIds: string[];      // Empty = all mesocycles
  selectedMicrocycleIds: string[];     // Empty = all microcycles in selected mesocycles
  
  // Copied data (snapshot at assignment time)
  assignedMesocycles: ExtendedMesocycle[];  // Full mesocycle data with shifted dates
  
  // Metadata
  createdAt: string;
  notes?: string;
}
```

### Storage: Extend `useAthletes` hook

Add a new array to the athlete database:
```typescript
interface AthleteDatabase {
  // ... existing fields ...
  calendarAssignments: AthleteCalendarAssignment[];
}
```

---

## Implementation Phases

### Phase 1: Data Layer

**File**: `src/types/athlete.ts`
- Add `AthleteCalendarAssignment` interface

**File**: `src/hooks/useAthletes.ts`
- Add `calendarAssignments` to database schema
- Add migration logic for existing data
- Add CRUD functions:
  - `createCalendarAssignment(athleteId, assignment)`
  - `updateCalendarAssignment(id, updates)`
  - `deleteCalendarAssignment(id)`
  - `getAthleteCalendarAssignments(athleteId)`

---

### Phase 2: Athlete Profile Tabs

**File**: `src/components/athletes/AthleteProfileView.tsx`
- Wrap content in Tabs component with two tabs: "Profile" and "Calendar"
- Move existing profile content into "Profile" tab
- Add new "Calendar" tab content

**File**: `src/components/athletes/AthleteCalendarView.tsx` (NEW)
- Monthly calendar view showing assigned program blocks
- Visual representation of mesocycles/microcycles as colored bars
- Click on empty date to open "Assign Program" dialog
- Click on existing assignment to view/edit/delete

---

### Phase 3: Program Assignment Dialog

**File**: `src/components/athletes/AssignProgramDialog.tsx` (NEW)
- Step 1: Select a training program from the library
- Step 2: Select mesocycles (checkboxes, default all)
- Step 3: For each selected mesocycle, select microcycles (checkboxes, default all)
- Step 4: Preview and confirm
  - Show date mismatch warning if applicable
  - Display the calculated new dates

**Date Mismatch Warning Logic**:
```typescript
// Show warning if original start date differs by more than 14 days
// from the assigned start date
const daysDiff = Math.abs(differenceInDays(
  new Date(originalStartDate), 
  new Date(assignedStartDate)
));
if (daysDiff > 14) {
  showWarningToast("Date mismatch: This program was originally created for different dates...");
}
```

---

### Phase 4: Date Shifting Logic

**File**: `src/utils/dateShifting.ts` (NEW)

```typescript
/**
 * Shifts all dates in mesocycle/microcycle data to a new start date
 * @param mesocycles - Array of mesocycles with original dates
 * @param newStartDate - The new start date for the assignment
 * @returns Mesocycles with all dates shifted
 */
function shiftMesocycleDates(
  mesocycles: ExtendedMesocycle[],
  newStartDate: Date
): ExtendedMesocycle[] {
  const originalStartDate = new Date(mesocycles[0].startDate);
  const dayOffset = differenceInDays(newStartDate, originalStartDate);
  
  return mesocycles.map(meso => ({
    ...meso,
    startDate: addDays(new Date(meso.startDate), dayOffset),
    endDate: addDays(new Date(meso.endDate), dayOffset),
    microcycles: meso.microcycles.map(micro => ({
      ...micro,
      // Microcycles store duration in days, not absolute dates
      // So they don't need shifting
    }))
  }));
}
```

---

## UI Mockups

### Calendar View
```text
+------------------------------------------------------------------+
| < January 2026 >                           [+ Assign Program]    |
+------------------------------------------------------------------+
|  Mon   Tue   Wed   Thu   Fri   Sat   Sun                         |
+------------------------------------------------------------------+
|  [Program A - Meso 1, Week 1                                   ] |
|  [Program A - Meso 1, Week 1                                   ] |
|  [                    ] [Program A - Meso 1, Week 2            ] |
|  [Program A - Meso 1, Week 2                                   ] |
|  [Program A - Meso 1, Week 3                                   ] |
+------------------------------------------------------------------+
```

### Assignment Dialog
```text
+--------------------------------------------------+
| Assign Training Program                          |
+--------------------------------------------------+
| 
| 1. Select Program
|    [Dropdown: "Strength Program A" ▼]
|
| 2. Start Date
|    [Date Picker: January 5, 2026]
|
| ⚠️ Warning: Original program ran from Aug 1 - Dec 31, 2025.
|    Dates will be shifted to match your selection.
|
| 3. Select Mesocycles
|    [x] Mesocycle 1: Foundation (4 weeks)
|    [x] Mesocycle 2: Build (4 weeks)  
|    [ ] Mesocycle 3: Peak (2 weeks)
|
| 4. Select Microcycles (for Mesocycle 1)
|    [x] Week 1 (7 days)
|    [x] Week 2 (7 days)
|    [ ] Week 3 (7 days)
|    [ ] Week 4 (7 days)
|
+--------------------------------------------------+
|                    [Cancel]  [Assign Program]    |
+--------------------------------------------------+
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/types/athlete.ts` | Modify | Add `AthleteCalendarAssignment` type |
| `src/hooks/useAthletes.ts` | Modify | Add calendar assignment CRUD operations |
| `src/components/athletes/AthleteProfileView.tsx` | Modify | Add tabs for Profile/Calendar |
| `src/components/athletes/AthleteCalendarView.tsx` | Create | Monthly calendar visualization |
| `src/components/athletes/AssignProgramDialog.tsx` | Create | Program selection and assignment dialog |
| `src/utils/dateShifting.ts` | Create | Date shifting utility functions |
| `src/components/athletes/index.ts` | Modify | Export new components |

---

## Technical Considerations

1. **Data Snapshot vs Reference**: When assigning a program, we store a **snapshot** of the mesocycle/microcycle data, not just a reference. This ensures that:
   - Assigned training doesn't change if the original program is modified
   - The athlete's calendar remains stable
   - Historical data is preserved

2. **Date Serialization**: All dates stored as ISO strings, converted to Date objects when loaded (following existing pattern from `mesocycleData` handling)

3. **Calendar Visualization**: Use a simple month-grid view (similar to standard calendar components) with program assignments shown as horizontal bars spanning their duration

4. **Performance**: For athletes with many assignments, consider pagination or lazy loading of calendar months

5. **Future Enhancement**: Allow editing assigned microcycles directly from the athlete calendar (opens workout sheet in context of that specific assignment)

