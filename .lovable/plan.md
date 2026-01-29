

## Add Full Master Planner Editing Functionality to Athlete Calendar

### Overview

This is a significant enhancement to add complete Master Planner view functionality to the Athlete Calendar, matching the full editing capabilities available in the Training Calendar from the planning wizard. Users will be able to view and edit assigned programs directly from the athlete's calendar.

---

### Architecture Challenge

The Athlete Calendar has a fundamentally different data flow than the Training Calendar:

| Aspect | Training Calendar | Athlete Calendar |
|--------|------------------|------------------|
| Data source | Live `localStorage` state (editing session) | Assigned program snapshots stored in `AthleteCalendarAssignment` |
| State management | `MicrocyclePlanningPage` manages all state centrally | Need new state management in `AthleteCalendarView` |
| Persistence | Auto-saves to multiple localStorage keys | Must update assignment snapshot + separate athlete-specific overrides |
| Editing scope | One program at a time | Multiple assigned programs, need to track which is being edited |

---

### Implementation Plan

#### Phase 1: Extend View Mode and Add Master Planner Toggle

**File:** `src/components/athletes/AthleteCalendarView.tsx`

1. **Update ViewMode type:**
   ```typescript
   type ViewMode = '1week' | '2week' | '4week' | 'master';
   ```

2. **Add Master Planner state:**
   ```typescript
   const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1);
   const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
   ```

3. **Add view toggle buttons in header:**
   - Calendar icon + Master Planner icon toggle (matching TrainingCalendarView)
   - When in master mode: show day-of-week selector and assignment selector

---

#### Phase 2: Add Full Editing State Management

**File:** `src/components/athletes/AthleteCalendarView.tsx`

Add all the state needed for editing (mirroring MicrocyclePlanningPage):

```typescript
// Exercise distribution for the selected assignment
const [editableExerciseDistribution, setEditableExerciseDistribution] = useState<ExerciseDistribution[]>([]);

// Session sections
const [editableSessionSections, setEditableSessionSections] = useState<SessionSection[]>([]);

// Supersets
const [editableSupersets, setEditableSupersets] = useState<SupersetMapping>({});

// Parameter values
const [editableParameterValues, setEditableParameterValues] = useState<Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>>({}); 

// Daily intensity data
const [editableDailyIntensity, setEditableDailyIntensity] = useState<any[]>([]);

// Training days derived from assignment
const [editableTrainingDays, setEditableTrainingDays] = useState<TrainingDay[]>([]);

// Day split states
const [editableDaySplitStates, setEditableDaySplitStates] = useState<Record<string, number>>({});

// Copy/paste state
const [copiedSession, setCopiedSession] = useState<...>(null);
const [copiedDay, setCopiedDay] = useState<...>(null);
```

---

#### Phase 3: Load Assignment Data into Editable State

When an assignment is selected for editing:

1. **Extract exercise distribution** from the assignment's snapshot
2. **Extract session sections** from the assignment's snapshot  
3. **Extract supersets** from the assignment's snapshot
4. **Extract parameter values** from the assignment's snapshot
5. **Build training days** from the assignment's mesocycle/microcycle structure
6. **Build daily intensity data** from the mesocycle intensity settings

Create a new function `loadAssignmentForEditing(assignmentId: string)`:
```typescript
const loadAssignmentForEditing = useCallback((assignmentId: string) => {
  const assignment = assignments.find(a => a.id === assignmentId);
  if (!assignment) return;
  
  // Load stored override data for this assignment, or initialize from snapshot
  const storageKey = `athlete-assignment-${assignmentId}`;
  const savedData = localStorage.getItem(storageKey);
  
  if (savedData) {
    const parsed = JSON.parse(savedData);
    setEditableExerciseDistribution(parsed.exerciseDistribution || []);
    setEditableSessionSections(parsed.sessionSections || []);
    setEditableSupersets(parsed.supersets || {});
    setEditableParameterValues(parsed.parameterValues || {});
    setEditableDailyIntensity(parsed.dailyIntensity || []);
    setEditableTrainingDays(parsed.trainingDays || []);
    setEditableDaySplitStates(parsed.daySplitStates || {});
  } else {
    // Initialize from assignment snapshot (read-only data)
    initializeFromAssignment(assignment);
  }
  
  setSelectedAssignmentId(assignmentId);
}, [assignments]);
```

---

#### Phase 4: Create All Editing Handlers

Mirror the handlers from `MicrocyclePlanningPage`:

```typescript
// Session management
const handleAddSession = useCallback((dayDate: string) => { ... }, []);
const handleDeleteSession = useCallback((dayDate: string, sessionIndex: number) => { ... }, []);
const handleCopySession = useCallback((dayDate: string, sessionIndex: number) => { ... }, []);
const handlePasteSession = useCallback((dayDate: string) => { ... }, []);

// Day management  
const handleCopyDay = useCallback((dayDate: string) => { ... }, []);
const handleClearDay = useCallback((dayDate: string) => { ... }, []);
const handlePasteDay = useCallback((dayDate: string) => { ... }, []);

// Section management
const handleAddSectionToSession = useCallback((dayDate: string, sessionIndex: number) => { ... }, []);
const handleSectionReorder = useCallback((dayDate: string, sessionIndex: number, sectionId: string, direction: 'up' | 'down') => { ... }, []);
const handleSectionDuplicate = useCallback((dayDate: string, sessionIndex: number, sectionId: string) => { ... }, []);
const handleSectionDelete = useCallback((dayDate: string, sessionIndex: number, sectionId: string) => { ... }, []);

// Exercise management
const handleAddExerciseToSection = useCallback((dayDate: string, sessionIndex: number, sectionId: string) => { ... }, []);
const handleExerciseReorder = useCallback((dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string, direction: 'up' | 'down') => { ... }, []);
const handleExerciseDuplicate = useCallback((dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => { ... }, []);
const handleExerciseDelete = useCallback((dayDate: string, sessionIndex: number, sectionId: string, exerciseId: string) => { ... }, []);
const handleExerciseChange = useCallback((...) => { ... }, []);

// Parameter and notes
const handleParameterChange = useCallback((...) => { ... }, []);
const handleExerciseNotesChange = useCallback((exerciseId: string, notes: string) => { ... }, []);
const handleExerciseEachSideChange = useCallback((exerciseId: string, eachSide: boolean) => { ... }, []);

// Intensity management
const handleDayIntensityChange = useCallback((dayDate: string, intensity: IntensityLevel) => { ... }, []);
const handleSessionIntensityChange = useCallback((dayDate: string, sessionIndex: number, intensity: IntensityLevel) => { ... }, []);

// Superset management
const handleToggleSuperset = useCallback((...) => { ... }, []);

// Session naming
const handleSessionNameChange = useCallback((dayDate: string, sessionIndex: number, newName: string) => { ... }, []);
const handleSessionCommentChange = useCallback((dayDate: string, sessionIndex: number, comment: string) => { ... }, []);
const handleSectionCommentChange = useCallback((sectionId: string, comment: string) => { ... }, []);
```

---

#### Phase 5: Persist Edits to localStorage

Save athlete-specific overrides per assignment:

```typescript
// Auto-save edits to localStorage
useEffect(() => {
  if (!selectedAssignmentId) return;
  
  const storageKey = `athlete-assignment-${selectedAssignmentId}`;
  const dataToSave = {
    exerciseDistribution: editableExerciseDistribution,
    sessionSections: editableSessionSections,
    supersets: editableSupersets,
    parameterValues: editableParameterValues,
    dailyIntensity: editableDailyIntensity,
    trainingDays: editableTrainingDays,
    daySplitStates: editableDaySplitStates,
    lastModified: new Date().toISOString(),
  };
  
  localStorage.setItem(storageKey, JSON.stringify(dataToSave));
}, [
  selectedAssignmentId,
  editableExerciseDistribution,
  editableSessionSections,
  editableSupersets,
  editableParameterValues,
  editableDailyIntensity,
  editableTrainingDays,
  editableDaySplitStates,
]);
```

---

#### Phase 6: Calculate Calendar Days for Master Planner Grid

Create `allAssignmentDays` for the MasterPlannerGrid:

```typescript
const allAssignmentDays = useMemo((): CalendarDay[] => {
  if (viewMode !== 'master' || !selectedAssignment) return [];
  
  // Build CalendarDay[] from editableTrainingDays and editableExerciseDistribution
  return editableTrainingDays.map(trainingDay => {
    const dateStr = trainingDay.date;
    const dayExercises = editableExerciseDistribution.filter(e => e.dayDate === dateStr);
    const daySessions = editableDaySplitStates[dateStr] || 0;
    
    const sessions = [];
    for (let sessionIdx = 0; sessionIdx < daySessions; sessionIdx++) {
      const sessionExercises = dayExercises.filter(e => e.sessionIndex === sessionIdx);
      sessions.push({
        id: `${dateStr}-${sessionIdx}`,
        sessionIndex: sessionIdx,
        sessionName: trainingDay.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`,
        exercises: sessionExercises,
        methods: [...new Set(sessionExercises.map(e => e.methodId))],
        sessionIntensity: trainingDay.sessionIntensities?.[sessionIdx] || trainingDay.intensity,
      });
    }
    
    return {
      date: new Date(dateStr),
      dateString: dateStr,
      isCurrentMonth: true,
      trainingDay,
      sessions,
      totalExercises: dayExercises.length,
    };
  });
}, [viewMode, selectedAssignment, editableTrainingDays, editableExerciseDistribution, editableDaySplitStates]);
```

---

#### Phase 7: Render Master Planner Grid with Full Props

Pass all handlers to MasterPlannerGrid:

```tsx
{viewMode === 'master' && selectedAssignment && (
  <MasterPlannerGrid
    calendarDays={allAssignmentDays}
    selectedDayOfWeek={selectedDayOfWeek}
    getIntensityColor={getIntensityColor}
    dailyIntensityData={editableDailyIntensity}
    parameterValues={editableParameterValues}
    currentMesocycle={selectedMesocycleFromAssignment}
    trainingDays={editableTrainingDays}
    toolboxData={toolboxData}
    onParameterChange={handleParameterChange}
    sessionSections={editableSessionSections}
    supersets={editableSupersets}
    onSessionNameChange={handleSessionNameChange}
    onSessionCommentChange={handleSessionCommentChange}
    onSectionCommentChange={handleSectionCommentChange}
    onExerciseNotesChange={handleExerciseNotesChange}
    onExerciseEachSideChange={handleExerciseEachSideChange}
    onExerciseAutoCalcChange={handleExerciseAutoCalcChange}
    onDayIntensityChange={handleDayIntensityChange}
    onSessionIntensityChange={handleSessionIntensityChange}
    intensityLevels={intensityLevels}
    onSectionReorder={handleSectionReorder}
    onExerciseReorder={handleExerciseReorder}
    onAddSectionToSession={handleAddSectionToSession}
    onAddExerciseToSection={handleAddExerciseToSection}
    onExerciseDuplicate={handleExerciseDuplicate}
    onExerciseDelete={handleExerciseDelete}
    onToggleSuperset={handleToggleSuperset}
    onSectionDuplicate={handleSectionDuplicate}
    onSectionDelete={handleSectionDelete}
    onCopySession={handleCopySession}
    onDeleteSession={handleDeleteSession}
    onPasteSession={handlePasteSession}
    copiedSession={copiedSession}
    onCopyDay={handleCopyDay}
    onClearDay={handleClearDay}
    onPasteDay={handlePasteDay}
    copiedDay={copiedDay}
    onAddSession={handleAddSession}
    allExerciseDistribution={editableExerciseDistribution}
    onOpenExerciseDetail={handleOpenExerciseDetail}
    onExerciseChange={handleExerciseChange}
  />
)}
```

---

### Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/components/athletes/AthleteCalendarView.tsx` | Major enhancement - add master mode, full editing state, all handlers, MasterPlannerGrid integration |

---

### Technical Notes

1. **Data Isolation**: Each assignment gets its own localStorage key (`athlete-assignment-{assignmentId}`) for storing edits. This keeps athlete-specific changes separate from the original program template.

2. **Initial Data Loading**: When first selecting an assignment for editing, we attempt to parse exercise data from the assignment snapshot. If the snapshot doesn't contain detailed exercise distribution (older assignments), we show a message that the assignment can be viewed but limited editing is available.

3. **Handler Complexity**: Most handlers can be adapted from MicrocyclePlanningPage with minor modifications to work with the editable state variables instead of the original state.

4. **Toolbox Integration**: We'll need to import and use `useToolboxData` hook to get toolbox data for parameter grids and method lookups.

5. **Exercise Library**: The `ExerciseLibraryPopup` and `MethodSelectionDialog` components will be reused for adding exercises in the Master Planner.

6. **Superset Utilities**: Import `toggleSuperset` and `cleanupSupersetsOnExerciseDelete` from `@/utils/supersetUtils` for superset management.

---

### Visual Result

**Header - Master Planner Mode:**
```
📅 Athlete Calendar  [Calendar|Master Planner]  [Monday▼]  [Program Name▼]
```

**Master Planner Grid (Fully Editable):**
```
┌──────────────────────────────────────────────────────────────────────┐
│                 Weeks 1-4 of 6                                       │
├────────────┬────────────┬────────────┬────────────┬─────────────────┤
│  Week 1    │  Week 2    │  Week 3    │  Week 4    │                 │
│  Mon Jan 6 │  Mon Jan 13│  Mon Jan 20│  Mon Jan 27│                 │
├────────────┼────────────┼────────────┼────────────┼─────────────────┤
│  Session 1 │  Session 1 │  Session 1 │  Session 1 │                 │
│  [⋮ menu]  │  [⋮ menu]  │  [⋮ menu]  │  [⋮ menu]  │                 │
│  ┌────────┐│  ┌────────┐│  ┌────────┐│  ┌────────┐│                 │
│  │Squat   ││  │Squat   ││  │Squat   ││  │Squat   ││                 │
│  │3x8@75% ││  │3x8@77% ││  │4x8@80% ││  │4x8@82% ││                 │
│  │[↑][↓]  ││  │[↑][↓]  ││  │[↑][↓]  ││  │[↑][↓]  ││                 │
│  └────────┘│  └────────┘│  └────────┘│  └────────┘│                 │
│  [+Section]│  [+Section]│  [+Section]│  [+Section]│                 │
│  [+Workout]│  [+Workout]│  [+Workout]│  [+Workout]│                 │
└────────────┴────────────┴────────────┴────────────┴─────────────────┘
```

All editing features available:
- Add/delete/copy/paste sessions
- Add/delete/duplicate/reorder sections
- Add/delete/duplicate/reorder exercises
- Change exercises (swap with library)
- Edit parameters in grid
- Create/remove supersets
- Edit notes and "each side" flags
- Edit intensity (day and session level)
- Copy/paste/clear days

