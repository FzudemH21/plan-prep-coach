

## Fix: Exercises Not Being Copied When Assigning Program to Athlete Calendar

### Problem Identified

When a training program is assigned to an athlete's calendar, the exercises are not appearing because of a **stale data issue** in how the program is retrieved.

**Current Flow (Broken):**
1. User saves a program via "Save Program" button in the planning wizard
2. `saveCurrentSession()` collects data from localStorage keys (`exerciseDistribution`, `parameterValues`, etc.)
3. Program is saved to `localStorage.getItem('trainingPrograms')` with all workout data
4. User navigates to Athlete Database → Athlete Calendar → Assign Program
5. `AthleteCalendarView` uses `useTrainingPrograms()` hook which loads programs into React state
6. When assigning, `getProgram(programId)` reads from the hook's **state** (not localStorage)
7. **Issue**: The hook's state may not have the latest data, or the `programs` array in the callback closure might be stale

**Root Cause:** The `getProgram` function in `handleAssignProgram` uses the closure-captured `data.programs` which may not reflect the latest saved program. Also, the callback dependency array only includes `getProgram` (not `programs`), so changes to programs don't trigger a new callback.

---

### Solution

Update `handleAssignProgram` to read the program **directly from localStorage** rather than from the hook's state. This ensures we always get the freshest data.

**File: `src/components/athletes/AthleteCalendarView.tsx`**

Change the `handleAssignProgram` callback to:

```tsx
const handleAssignProgram = useCallback((assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>) => {
  // Create the assignment and get the new ID
  const newAssignment = athleteData.createCalendarAssignment(athlete.id, assignment);
  
  // Copy program workout data with shifted dates
  if (newAssignment && assignment.programId) {
    // Read directly from localStorage to ensure we get latest data
    let program: TrainingProgram | null = null;
    try {
      const stored = localStorage.getItem('trainingPrograms');
      if (stored) {
        const parsed = JSON.parse(stored);
        program = parsed.programs?.find((p: TrainingProgram) => p.id === assignment.programId) || null;
      }
    } catch (e) {
      console.error('Error reading program from localStorage:', e);
    }
    
    // Fallback to hook's getProgram if localStorage read fails
    if (!program) {
      program = getProgram(assignment.programId);
    }
    
    if (program) {
      console.log('[handleAssignProgram] Program found:', {
        id: program.id,
        name: program.name,
        exerciseCount: program.exerciseDistribution?.length || 0,
        hasSessionSections: !!program.sessionSections,
        hasDailyIntensity: !!program.dailyIntensityData?.length,
      });
      
      // ... rest of the existing code for shifting dates and saving
    } else {
      console.warn('[handleAssignProgram] Program not found:', assignment.programId);
    }
  }
  
  setShowAssignDialog(false);
  setSelectedDate(null);
}, [athlete.id, athleteData, getProgram]);
```

---

### Additional Improvement: Add Fallback to Session Data

If the program somehow doesn't have `exerciseDistribution` (e.g., user never saved), we could also try to read from the current session's localStorage keys. However, this is less likely since the user is assigning an already-saved program.

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/athletes/AthleteCalendarView.tsx` | Update `handleAssignProgram` to read program data directly from `localStorage.getItem('trainingPrograms')` instead of relying on the hook's potentially stale state |

---

### Why This Works

1. **Direct localStorage access** bypasses any React state synchronization issues
2. Programs are saved to `trainingPrograms` key via `saveData()` which writes both to state and localStorage
3. By reading directly from localStorage, we guarantee we get the most recently saved data
4. Console logging helps debug if the program data is truly missing or just not being copied properly

