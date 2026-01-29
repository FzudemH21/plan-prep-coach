

## Fix Counting Numbers Bug and Enable Session Click in Athlete Calendar

### Issues Identified

1. **Counting Numbers Bug**: The exercise count displayed on each session card is using `Math.floor(Math.random() * 8) + 3` (line 194 in AthleteCalendarView.tsx). Since React re-renders components frequently, this creates a new random number on every render, causing the numbers to count erratically.

2. **Session Click Not Working**: The `onSessionClick` handler is defined in `AthleteCalendarView.tsx` but is never passed down to `AthleteCalendarWeekRow` (line 473-481). The component has the prop available but it's not being used.

3. **Workout Session Sheet Not Properly Connected**: The WorkoutSessionSheet is rendered but with empty/placeholder data. It needs to receive the actual session exercises and be properly wired up to open when a session is clicked.

---

### Solution

#### Fix 1: Remove Random Number Generation (Line 194)

Replace the placeholder random exercise count with the actual exercise count from the assignment data. Since we're building sessions from the assignment mesocycle data, we need to:
- Track actual exercises from the `exerciseDistribution` state or calculate a proper count from the stored data.

For now, we'll replace the random number with a stable count calculation. The proper exercise count should come from stored assignment data.

**Current code (line 194):**
```tsx
exerciseCount: Math.floor(Math.random() * 8) + 3, // Placeholder - would come from actual data
```

**Fixed code:**
```tsx
exerciseCount: 0, // Will be populated from stored assignment data
```

But a better approach is to use the editing hook's data. We need to refactor the calendar days calculation to use real data.

---

#### Fix 2: Pass `onSessionClick` to Week Row (Line 473-481)

Add the missing `onSessionClick` prop to `AthleteCalendarWeekRow`:

**Current code:**
```tsx
<AthleteCalendarWeekRow
  key={`week-${idx}`}
  week={week}
  weekIdx={idx}
  onDayClick={handleDayClick}
  onAddSession={handleAddSession}
  onDeleteAssignment={handleDeleteAssignmentById}
  getIntensityColor={getIntensityColor}
/>
```

**Fixed code:**
```tsx
<AthleteCalendarWeekRow
  key={`week-${idx}`}
  week={week}
  weekIdx={idx}
  onSessionClick={handleSessionClick}
  onDayClick={handleDayClick}
  onAddSession={handleAddSession}
  onDeleteAssignment={handleDeleteAssignmentById}
  getIntensityColor={getIntensityColor}
/>
```

---

#### Fix 3: Create `handleSessionClick` Handler and Wire Up WorkoutSessionSheet

Add a new state and handler for opening a session:

```tsx
const [selectedSessionInfo, setSelectedSessionInfo] = useState<{
  dayDate: string;
  sessionIndex: number;
  exercises: ExerciseDistribution[];
} | null>(null);

const handleSessionClick = (dayDate: string, sessionIndex: number) => {
  // Get exercises for this session from editing hook or assignment data
  const sessionExercises = editing.exerciseDistribution.filter(
    ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex
  );
  
  setSelectedSessionInfo({
    dayDate,
    sessionIndex,
    exercises: sessionExercises,
  });
  setSessionSheetOpen(true);
};
```

---

#### Fix 4: Connect WorkoutSessionSheet with Real Data

Update the WorkoutSessionSheet to receive proper data from the assignment:

```tsx
<WorkoutSessionSheet
  isOpen={sessionSheetOpen}
  onClose={() => {
    setSessionSheetOpen(false);
    setSelectedSessionInfo(null);
  }}
  dayDate={selectedSessionInfo?.dayDate || ''}
  sessionIndex={selectedSessionInfo?.sessionIndex || 0}
  exercises={selectedSessionInfo?.exercises || []}
  mesocycleId={editing.selectedAssignment?.assignedMesocycles[0]?.id || ''}
  microcycleIndex={0}
  parameterValues={editing.parameterValues}
  onSaveParameters={handleSaveParameters}
  dailyIntensityData={editing.dailyIntensityData}
  onIntensityChange={editing.handleDayIntensityChange}
  onSessionIntensityChange={editing.handleSessionIntensityChange}
  getIntensityColor={getIntensityColor}
  intensityLevels={intensityLevels}
  sessionSections={editing.sessionSections}
  supersets={editing.supersets}
  onSectionsChange={(sections) => editing.setSessionSections(sections)}
  onSupersetsChange={(s) => editing.setSupersets(s)}
  toolboxData={toolboxData}
  allExerciseDistribution={editing.exerciseDistribution}
  onDistributionChange={editing.setExerciseDistribution}
  // ... additional props as needed
/>
```

---

#### Fix 5: Refactor Calendar Days to Use Real Exercise Counts

Update the `calendarDays` useMemo to calculate exercise counts from the stored assignment data rather than using random numbers:

```tsx
// Instead of random exercise count, look up from stored data
const storageKey = `athlete-assignment-${assignmentId}`;
const savedData = localStorage.getItem(storageKey);
let exerciseCount = 0;
if (savedData) {
  try {
    const parsed = JSON.parse(savedData);
    const exercises = parsed.exerciseDistribution || [];
    exerciseCount = exercises.filter(
      (ex: any) => ex.dayDate === dateString && ex.sessionIndex === 0
    ).length;
  } catch (e) {}
}

sessions.push({
  id: sessionId,
  sessionIndex: 0,
  sessionName: `${meso.name} - Day ${dayWithinMicro + 1}`,
  exerciseCount: exerciseCount,
  intensity: meso.intensity || 'moderate',
});
```

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/athletes/AthleteCalendarView.tsx` | 1. Add `handleSessionClick` handler<br>2. Pass `onSessionClick` to `AthleteCalendarWeekRow`<br>3. Replace random exercise count with real data lookup<br>4. Wire up WorkoutSessionSheet with proper props from editing hook<br>5. Add `selectedSessionInfo` state |

