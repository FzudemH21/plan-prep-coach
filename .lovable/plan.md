
# Plan: Enhance Tests/Events Dialog with Parameters Database Dropdown ✅ COMPLETED

## Summary
Updated the "Manage Tests/Events" dialog so that when adding a Test, the "Test Method" field becomes a searchable dropdown populated from the Athleticism Database V2 (Parameters Database). Users can select an existing parameter or create a new one using the same dialog as in the Athleticism Database page.

---

## Current Behavior
- When type is "Test" and mode is "Create New", there's a plain text input for "Test Method"
- Users type free-form test names like "1RM Back Squat"
- No connection to the Parameters Database

## New Behavior
- When type is "Test", the "Test Method" field becomes a searchable dropdown
- The dropdown lists all parameters from the Athleticism Database V2, grouped by category
- A "Create New Parameter" option appears at the bottom of the dropdown
- Clicking "Create New Parameter" opens the `AddParameterDialogV2` dialog
- Newly created parameters are immediately available for selection
- Events remain unchanged (still a text input)

---

## Technical Changes

### File 1: `src/components/microcycle-planning/CombinedTestEventDialog.tsx`

**New Props:**
```text
+ allParameters?: ParameterV2[]
+ toolboxEntries?: ToolboxEntry[]
+ onAddParameter?: (parameter: {...}) => void
```

**UI Changes:**
1. Replace the "Test Method" text Input with a Command/Popover component (searchable dropdown)
2. Group parameters by category in the dropdown
3. Add "Create New Parameter" button at the bottom
4. Show unit next to each parameter name (e.g., "1RM Front Squat (kg)")
5. Add state for the nested `AddParameterDialogV2`

**Logic Changes:**
- When a parameter is selected, store both the parameter ID and name
- When "Create New Parameter" is clicked, open `AddParameterDialogV2`
- After a new parameter is added, select it automatically

---

### File 2: `src/components/microcycle-planning/TrainingDayCell.tsx`
- Import `useParametersDataV2` hook
- Import `useToolboxData` hook
- Pass `allParameters`, `toolboxEntries`, and `onAddParameter` to `CombinedTestEventDialog`

---

### File 3: `src/components/microcycle-planning/MasterPlannerColumn.tsx`
- Import `useParametersDataV2` hook
- Import `useToolboxData` hook
- Pass `allParameters`, `toolboxEntries`, and `onAddParameter` to `CombinedTestEventDialog`

---

### File 4: `src/components/microcycle-planning/WorkoutSessionSheet.tsx`
- Import `useParametersDataV2` hook
- Import `useToolboxData` hook
- Pass `allParameters`, `toolboxEntries`, and `onAddParameter` to `CombinedTestEventDialog`

---

### File 5: `src/components/athletes/AthleteCalendarDayCell.tsx`
- Import `useParametersDataV2` hook
- Import `useToolboxData` hook
- Pass `allParameters`, `toolboxEntries`, and `onAddParameter` to `CombinedTestEventDialog`

---

## UI Design (Test Method Dropdown)

```text
+------------------------------------------+
| Test Method                              |
| +--------------------------------------+ |
| | Search parameters...                 | |
| +--------------------------------------+ |
| | Strength                             | |
| |   1RM Front Squat (kg)               | |
| |   1RM Back Squat (kg)                | |
| | Speed                                | |
| |   100m Sprint Time (s)               | |
| |   10m Sprint Time (s)                | |
| | Power                                | |
| |   Vertical Jump Height (cm)          | |
| +--------------------------------------+ |
| | + Create New Parameter               | |
| +--------------------------------------+ |
+------------------------------------------+
```

---

## Data Flow

```text
1. User opens "Manage Tests/Events" dialog
2. Dialog fetches parameters from useParametersDataV2
3. User selects a parameter from dropdown OR clicks "Create New Parameter"
4. If creating new: AddParameterDialogV2 opens
5. New parameter is added to the database
6. Dialog auto-selects the new parameter
7. User clicks "Add" to schedule the test
```

---

## Files Modified (Summary)

| File | Change |
|------|--------|
| `CombinedTestEventDialog.tsx` | Add parameter dropdown, nested AddParameterDialogV2 |
| `TrainingDayCell.tsx` | Pass parameters data to dialog |
| `MasterPlannerColumn.tsx` | Pass parameters data to dialog |
| `WorkoutSessionSheet.tsx` | Pass parameters data to dialog |
| `AthleteCalendarDayCell.tsx` | Pass parameters data to dialog |

---

## Scope Notes
- Events creation remains unchanged (free-form text input)
- The "Select Existing" mode for tests still shows SubGoals from the macrocycle (for tests already scheduled in the plan)
- The "Create New" mode now uses the parameters dropdown instead of free-text
- Both Training Calendar and Athlete Calendar get the same enhancement
