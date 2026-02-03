
# Fix: Add Session Dialog Not Opening

## Root Cause

The `WorkoutSessionSheet` component fails to render when adding a new ad-hoc session because of an overly strict conditional check.

**Location**: `src/components/athletes/AthleteCalendarView.tsx`, line 922

**Current Code**:
```tsx
{selectedSessionInfo && selectedSessionInfo.dayDate && selectedSessionInfo.assignmentId && (
  <WorkoutSessionSheet ... />
)}
```

**Problem**:
- When `handleAddSession` is called (for ad-hoc sessions), it sets `assignmentId: ''` (empty string)
- Empty string is **falsy** in JavaScript
- The condition `selectedSessionInfo.assignmentId` evaluates to `false`
- The `WorkoutSessionSheet` component never renders

---

## Solution

Allow the dialog to render for ad-hoc sessions by checking that `assignmentId` is explicitly defined (including empty string), not just truthy.

**Fix**: Change the condition from:
```tsx
selectedSessionInfo && selectedSessionInfo.dayDate && selectedSessionInfo.assignmentId
```

To:
```tsx
selectedSessionInfo && selectedSessionInfo.dayDate && selectedSessionInfo.assignmentId !== undefined
```

This allows:
- Ad-hoc sessions: `assignmentId = ''` (empty string) - sheet will open
- Existing sessions: `assignmentId = 'some-id'` - sheet will open
- Invalid state: `assignmentId = undefined` - sheet won't open

---

## File to Modify

| File | Change |
|------|--------|
| `src/components/athletes/AthleteCalendarView.tsx` | Fix conditional rendering on line 922 |

---

## Technical Details

### Line 922 Change

```tsx
// Before
{selectedSessionInfo && selectedSessionInfo.dayDate && selectedSessionInfo.assignmentId && (

// After
{selectedSessionInfo && selectedSessionInfo.dayDate && selectedSessionInfo.assignmentId !== undefined && (
```

This single-character change (adding ` !== undefined`) fixes the issue while maintaining proper type safety for the component.
