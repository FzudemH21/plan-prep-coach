

# Fix: Tests Not Adding to Calendar (No Icon Appearing)

## Root Cause

The `isCreateContext` variable in `CombinedTestEventDialog.tsx` evaluates to `false` when there are existing tests in the program (`existingTests.length > 0`), because `mode` defaults to `'select'` and `hasItems` is `true`.

When the user clicks "Add" for a test, `handleConfirm` takes the "select existing" branch which requires a `selectedId` -- but there is no radio group for tests (correctly removed). Since `selectedId` is empty, the function does nothing silently.

## The Fix

**File: `src/components/microcycle-planning/CombinedTestEventDialog.tsx`**

**Line 108** -- Update the `isCreateContext` definition to always treat tests as "create" context:

```typescript
// Before:
const isCreateContext = mode === 'create' || !hasItems;

// After:
const isCreateContext = type === 'test' || mode === 'create' || !hasItems;
```

This single-line change ensures that for tests, the `handleConfirm` function always takes the "create new" branch (line 186), which uses `newName` from the parameter dropdown -- exactly the unified flow that was intended.

No other files need to change. The handler in `MicrocyclePlanningPage.tsx` and the icon rendering in `TrainingDayCell.tsx` are both correct -- the problem is solely that `handleConfirm` silently exits without calling `onSelect`.
