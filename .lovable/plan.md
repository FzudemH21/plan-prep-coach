

# Plan: Fix Add Button Bug + Add Baseline Value for Tests

## Summary

Two issues to address:
1. **Bug Fix**: The "Add" button is grayed out/disabled even when filling in test/event fields
2. **Feature**: Add "Baseline Value" field for tests that auto-populates from athlete's existing parameter value

---

## Issue 1: Add Button Bug (Critical)

### Root Cause
The disabled logic on line 558-561 checks:
```typescript
disabled={
  (mode === 'select' && !selectedId) || 
  (mode === 'create' && !newName.trim())
}
```

**The problem**: When `hasItems` is `false` (no existing tests/events), the UI displays the create form (line 391), but the `mode` state stays at `'select'` (the default from line 85).

So the first condition `(mode === 'select' && !selectedId)` is always `true`, keeping the button disabled.

### Solution
Update the disabled logic to account for the scenario where `!hasItems` but `mode` is still `'select'`:

```typescript
disabled={
  (mode === 'select' && hasItems && !selectedId) || 
  ((mode === 'create' || !hasItems) && !newName.trim())
}
```

Alternatively, force `mode` to `'create'` when there are no items. Either approach works.

---

## Issue 2: Baseline Value Feature

### Current State
- Tests have a "Goal Value" field (just implemented)
- No "Baseline Value" field exists
- No athlete context is passed to the dialog

### Requirements
1. Add a "Baseline Value" input field (optional, user can override)
2. When a parameter is selected AND an athlete is in context, auto-fill baseline value from athlete's existing performance parameter value
3. In the Training Programming Wizard: athlete context comes from the selected athlete in macrocycle
4. In the Athlete Calendar: athlete context comes from the currently viewed athlete

### Data Flow for Baseline Value

```text
Selected Parameter (e.g., "1RM Back Squat")
          |
          v
Look up athlete's AthletePerformanceParameter
where athleticismParameterId matches parameter.id
          |
          v
Get latest value from values[] array (sorted by recordedAt)
          |
          v
Pre-fill "Baseline Value" input
```

### New Props for CombinedTestEventDialog

```typescript
interface CombinedTestEventDialogProps {
  // ... existing props
  
  // NEW: For baseline auto-population
  selectedAthleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
}
```

### UI Changes

```text
+------------------------------------------+
| Test Method                              |
| [Dropdown: Select a parameter...]        |
+------------------------------------------+
| Baseline Value (kg)                      |
| [Input: 100] <-- auto-filled from athlete|
+------------------------------------------+
| Goal Value (kg)                          |
| [Input: 120] <-- manual entry            |
+------------------------------------------+
| Comments (Optional)                      |
| [Textarea: Add notes...]                 |
+------------------------------------------+
```

### Logic for Auto-Fill

When `handleParameterSelect` is called:
1. Set `newName` and `selectedParameterUnit` (existing)
2. NEW: If `selectedAthleteId` and `athletePerformanceParameters` are provided:
   - Find the `AthletePerformanceParameter` where `athleticismParameterId === param.id`
   - Get the latest value (last item in sorted values array)
   - Set `baselineValue` state to that value

### Update onSelect Interface

```typescript
onSelect: (selected: { 
  type: 'test' | 'event';
  id: string; 
  name: string; 
  isNew: boolean;
  comments?: string;
  goalValue?: number;
  baselineValue?: number;  // NEW
  unit?: string;
}) => void;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `CombinedTestEventDialog.tsx` | 1. Fix disabled logic for Add button. 2. Add baselineValue state. 3. Add Baseline Value input field. 4. Auto-fill logic when parameter selected. 5. Update onSelect to pass baselineValue. |
| `TrainingDayCell.tsx` | Pass `selectedAthleteId` and `athletePerformanceParameters` props |
| `MasterPlannerColumn.tsx` | Pass `selectedAthleteId` and `athletePerformanceParameters` props |
| `WorkoutSessionSheet.tsx` | Pass `selectedAthleteId` and `athletePerformanceParameters` props |
| `AthleteCalendarDayCell.tsx` | Pass the current athlete's ID and performance parameters |

---

## Implementation Details

### File 1: CombinedTestEventDialog.tsx

**New props:**
```typescript
selectedAthleteId?: string;
athletePerformanceParameters?: AthletePerformanceParameter[];
```

**New state:**
```typescript
const [baselineValue, setBaselineValue] = useState('');
```

**Updated handleParameterSelect:**
```typescript
const handleParameterSelect = (param: ParameterV2) => {
  setNewName(param.name);
  setSelectedParameterUnit(param.unit || '');
  setParameterDropdownOpen(false);
  
  // Auto-fill baseline value from athlete's data
  if (selectedAthleteId && athletePerformanceParameters) {
    const athleteParam = athletePerformanceParameters.find(
      pp => pp.athleticismParameterId === param.id
    );
    if (athleteParam && athleteParam.values.length > 0) {
      // Get latest value (sorted by recordedAt)
      const sortedValues = [...athleteParam.values].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
      setBaselineValue(sortedValues[0].value);
    } else {
      setBaselineValue('');
    }
  }
};
```

**New UI field (after Test Method dropdown, before Goal Value):**
```tsx
{type === 'test' && (
  <div className="space-y-2">
    <Label htmlFor="baselineValue">
      Baseline Value
      {selectedParameterUnit && (
        <span className="text-xs text-muted-foreground ml-2">({selectedParameterUnit})</span>
      )}
    </Label>
    <Input
      id="baselineValue"
      type="number"
      placeholder={selectedAthleteId ? "Auto-filled from athlete data" : "e.g., 100"}
      value={baselineValue}
      onChange={(e) => setBaselineValue(e.target.value)}
    />
  </div>
)}
```

**Fixed disabled logic:**
```typescript
disabled={
  (mode === 'select' && hasItems && !selectedId) || 
  ((mode === 'create' || !hasItems) && !newName.trim())
}
```

**Updated handleConfirm:**
```typescript
onSelect({
  type,
  id: `${type}-${Date.now()}`,
  name: newName.trim(),
  isNew: true,
  comments: newComments.trim() || undefined,
  goalValue: type === 'test' && goalValue ? parseFloat(goalValue) : undefined,
  baselineValue: type === 'test' && baselineValue ? parseFloat(baselineValue) : undefined,
  unit: type === 'test' ? selectedParameterUnit || undefined : undefined,
});
```

**Reset in handleClose:**
```typescript
setBaselineValue('');
```

### Files 2-5: Parent Components

Each parent component needs to:
1. Import `AthletePerformanceParameter` type
2. Pass the athlete context to the dialog

For **Training Calendar** components (TrainingDayCell, MasterPlannerColumn, WorkoutSessionSheet):
- Get `selectedAthleteId` from wizard context/props
- Get `athletePerformanceParameters` using `useAthletes().athletePerformanceParameters` or filter by athlete

For **AthleteCalendarDayCell**:
- The `athleteId` is already available in props
- Pass the athlete's performance parameters

---

## Testing Checklist

1. **Add Button Bug Fix**:
   - Open Manage Tests/Events dialog when there are NO existing tests
   - Type in a test name
   - Verify "Add" button becomes clickable

2. **Baseline Value - Manual Entry**:
   - Open dialog, select a parameter
   - Verify Baseline Value field appears
   - Enter a value manually
   - Click Add and verify value is passed

3. **Baseline Value - Auto-Fill** (in wizard with athlete selected):
   - Select an athlete who has recorded values for a parameter
   - Open Manage Tests/Events
   - Select that parameter from dropdown
   - Verify Baseline Value auto-fills with athlete's latest recorded value

4. **Events Unchanged**:
   - Switch to Event type
   - Verify no Baseline/Goal Value fields appear
   - Verify Add button works correctly

