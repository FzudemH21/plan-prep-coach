
# Plan: Fix Dialog Z-Index and Add Goal Value for Tests

## Summary
Two fixes needed for the Manage Tests/Events dialog:
1. **Z-index layering**: The "Add New Parameter" dialog opens behind the parent dialog
2. **Missing goal value**: When adding a test, there's no option to set a target/goal value

---

## Issue 1: Z-Index Layering Problem

### Root Cause
- `CombinedTestEventDialog` uses `z-[150]` for overlay and `z-[160]` for content
- The nested `AddParameterDialogV2` uses the default Dialog component which has `z-[100]` for overlay and `z-[110]` for content
- Since 110 < 160, the child dialog appears behind the parent

### Solution
Modify `AddParameterDialogV2` to use higher z-index values when rendered as a nested dialog. Add a `zIndexOverride` prop that allows parent components to specify higher z-index values.

### Implementation

**File: `src/components/goals/AddParameterDialogV2.tsx`**

1. Add new optional prop:
```typescript
interface AddParameterDialogV2Props {
  // ... existing props
  containerClassName?: string; // Allow custom z-index for nested dialogs
}
```

2. Apply custom className to DialogContent:
```typescript
<DialogContent className={cn(
  "w-[calc(100%-2rem)] max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col mx-4 sm:mx-auto",
  containerClassName
)}>
```

**File: `src/components/microcycle-planning/CombinedTestEventDialog.tsx`**

Pass higher z-index to the nested dialog:
```typescript
<AddParameterDialogV2
  open={addParameterDialogOpen}
  onOpenChange={setAddParameterDialogOpen}
  allParameters={allParameters}
  toolboxEntries={toolboxEntries}
  onAdd={handleAddNewParameter}
  containerClassName="z-[200]" // Higher than parent's z-[160]
/>
```

Also need to ensure the Portal renders the overlay correctly. Alternative approach: wrap the AddParameterDialogV2 in its own DialogPortal with explicit higher z-index overlay.

---

## Issue 2: Add Goal Value Field for Tests

### Current Behavior
When creating a new test, only "Test Method" (parameter name) and "Comments" fields are available.

### New Behavior
When creating a new test, add:
- **Goal Value**: Input field for the target value (e.g., "120")
- **Unit**: Auto-filled from the selected parameter (e.g., "kg")

### Implementation

**File: `src/components/microcycle-planning/CombinedTestEventDialog.tsx`**

1. Add new state variables:
```typescript
const [goalValue, setGoalValue] = useState<string>('');
const [selectedParameterUnit, setSelectedParameterUnit] = useState<string>('');
```

2. Update `handleParameterSelect` to also capture the unit:
```typescript
const handleParameterSelect = (param: ParameterV2) => {
  setNewName(param.name);
  setSelectedParameterUnit(param.unit || '');
  setParameterDropdownOpen(false);
};
```

3. Add Goal Value input field (shown only when type is 'test'):
```tsx
{type === 'test' && (
  <div className="space-y-2">
    <Label htmlFor="goalValue">
      Goal Value
      {selectedParameterUnit && (
        <span className="text-xs text-muted-foreground ml-2">({selectedParameterUnit})</span>
      )}
    </Label>
    <Input
      id="goalValue"
      type="number"
      placeholder="e.g., 120"
      value={goalValue}
      onChange={(e) => setGoalValue(e.target.value)}
    />
  </div>
)}
```

4. Update `onSelect` callback interface to include `goalValue`:
```typescript
onSelect: (selected: { 
  type: 'test' | 'event';
  id: string; 
  name: string; 
  isNew: boolean;
  comments?: string;
  goalValue?: number;  // NEW
  unit?: string;       // NEW
}) => void;
```

5. Update `handleConfirm` to pass the goal value:
```typescript
onSelect({
  type,
  id: `${type}-${Date.now()}`,
  name: newName.trim(),
  isNew: true,
  comments: newComments.trim() || undefined,
  goalValue: goalValue ? parseFloat(goalValue) : undefined,
  unit: selectedParameterUnit || undefined,
});
```

6. Reset states in `handleClose`:
```typescript
setGoalValue('');
setSelectedParameterUnit('');
```

---

## Files Modified

| File | Changes |
|------|---------|
| `AddParameterDialogV2.tsx` | Add `containerClassName` prop for z-index override |
| `CombinedTestEventDialog.tsx` | 1. Pass higher z-index to nested dialog. 2. Add goal value input field. 3. Update onSelect interface. 4. Store and pass selected parameter unit. |

---

## UI Layout After Changes

```text
+------------------------------------------+
| Test Method                              |
| [Dropdown: Select a parameter...]        |
+------------------------------------------+
| Goal Value (kg)                          |
| [Input: e.g., 120]                       |
+------------------------------------------+
| Comments (Optional)                      |
| [Textarea: Add notes...]                 |
+------------------------------------------+
```

---

## Expected Outcome

1. **Z-index fixed**: When clicking "Create New Parameter", the AddParameterDialogV2 appears in front of (on top of) the Manage Tests/Events dialog
2. **Goal value available**: When adding a test, users can specify a target/goal value with the unit automatically shown from the selected parameter
