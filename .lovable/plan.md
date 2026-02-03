
# Add Week/Day Copy, Paste, Clear, and Test/Event Management to Athlete Calendar

## Overview

You want the Athlete Calendar to have the same functionality as the Training Calendar wizard:
1. **Week-level operations**: Copy week, paste week, clear week
2. **Day-level operations**: Copy day, paste day (already exists in hook), clear day (already exists in hook), manage tests/events

## Current State

The `useAthleteCalendarEditing` hook already has:
- `handleCopyDay`, `handleClearDay`, `handlePasteDay` - Day copy/paste/clear
- `handleCopySession`, `handlePasteSession`, `handleDeleteSession` - Session operations
- `copiedSession`, `copiedDay` - Copy state

**Missing:**
- Week-level operations: `handleCopyWeek`, `handlePasteWeek`, `handleClearWeek`
- `copiedWeek` state
- Test/event management handlers for athlete calendar
- UI components to expose these features in `AthleteCalendarWeekRow` and `AthleteCalendarDayCell`

---

## Implementation Plan

### 1. Add Week Operations to `useAthleteCalendarEditing`
**File: `src/hooks/useAthleteCalendarEditing.ts`**

Add:
- `copiedWeek` state (similar to the Training Calendar structure)
- `handleCopyWeek(weekStartDate: string)` - Copy all exercises, sections, supersets, session structure for a week
- `handleClearWeek(weekStartDate: string)` - Clear all data for the week
- `handlePasteWeek(targetWeekStartDate: string)` - Paste with "Add as New Sessions" behavior
- Export these from the hook's return object

The implementation will mirror `MicrocyclePlanningPage.tsx` lines 1676-1970 but adapted for the athlete calendar context.

### 2. Add Test/Event Handlers to `useAthleteCalendarEditing`
**File: `src/hooks/useAthleteCalendarEditing.ts`**

Add:
- `handleAddTestEvent(dayDate, type, id, name, isNew, comments?)` - Add test/event to a day
- `handleDeleteTestEvent(dayDate, type, name)` - Remove test/event from a day
- Store test/event info in `trainingDays` (updating `testNames`, `eventNames`, `isTestDay`, `isEventDay`)

These will modify the `trainingDays` state to track which days have tests/events.

### 3. Update `AthleteCalendarWeekRow` Component
**File: `src/components/athletes/AthleteCalendarWeekRow.tsx`**

Add:
- 3-dot dropdown menu in week header with: "Copy week", "Clear week"
- "Paste Week" button (visible on hover when `copiedWeek` exists)
- Pass new props down to `AthleteCalendarDayCell`

New props interface:
```typescript
interface AthleteCalendarWeekRowProps {
  // ... existing props
  copiedWeek?: { exercises: any[]; weekStartDate: string } | null;
  copiedDay?: { exercises: any[]; sourceDate: string } | null;
  copiedSession?: { exercises: any[]; sourceDate: string; sessionIndex: number } | null;
  onCopyWeek?: (weekStartDate: string) => void;
  onClearWeek?: (weekStartDate: string) => void;
  onPasteWeek?: (weekStartDate: string) => void;
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  onPasteDay?: (dayDate: string) => void;
  onAddTestEvent?: (...) => void;
  onDeleteTestEvent?: (...) => void;
  availableTests?: SubGoal[];
  availableEvents?: Event[];
}
```

### 4. Update `AthleteCalendarDayCell` Component
**File: `src/components/athletes/AthleteCalendarDayCell.tsx`**

Enhance the existing 3-dot menu to include:
- "Copy day" (always visible)
- "Paste day" (visible when `copiedDay` exists)
- "Clear day" (visible when day has training)
- Separator
- "Manage tests/events" (opens `CombinedTestEventDialog`)

Add:
- Import and use `CombinedTestEventDialog`
- Paste Session/Day buttons on hover (like `TrainingDayCell`)
- Session 3-dot menu with "Copy session", "Delete session"

New props interface additions:
```typescript
interface AthleteCalendarDayCellProps {
  // ... existing props
  onCopyDay?: (dayDate: string) => void;
  onClearDay?: (dayDate: string) => void;
  onPasteDay?: (dayDate: string) => void;
  copiedDay?: {...} | null;
  copiedSession?: {...} | null;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onDeleteSession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  onAddTestEvent?: (...) => void;
  onDeleteTestEvent?: (...) => void;
  availableTests?: SubGoal[];
  availableEvents?: Event[];
}
```

### 5. Update `AthleteCalendarView` to Wire Everything Together
**File: `src/components/athletes/AthleteCalendarView.tsx`**

- Pass the new week/day/session handlers from `editing` hook to `AthleteCalendarWeekRow`
- Create or source available tests/events (from assignment data or allow ad-hoc creation)
- Pass `copiedWeek`, `copiedDay`, `copiedSession` state

---

## Technical Details

### Week Copy Structure (matching Training Calendar)
```typescript
interface CopiedWeek {
  exercises: ExerciseDistribution[];
  sections: SessionSection[];
  supersets: SupersetMapping;
  sessionStructure: Record<string, number[]>; // dayDate -> sessionIndices
  weekStartDate: string;
}
```

### Week Paste Behavior
Following the existing pattern ("Add as New Sessions" - Option B):
- Calculate day offset from source to target week
- For each target day that will receive sessions, calculate session offset based on existing sessions
- Remap section IDs, exercise IDs, superset IDs
- Shift session indices so pasted sessions become new sessions (not replacing existing)

### Test/Event Storage
Tests and events will be stored in the `trainingDays` array within each day object:
```typescript
{
  date: "2026-02-09",
  isTestDay: true,
  isEventDay: false,
  testNames: ["1RM Back Squat"],
  eventNames: [],
  // ... other fields
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useAthleteCalendarEditing.ts` | Add `copiedWeek` state, `handleCopyWeek`, `handlePasteWeek`, `handleClearWeek`, `handleAddTestEvent`, `handleDeleteTestEvent` |
| `src/components/athletes/AthleteCalendarWeekRow.tsx` | Add week 3-dot menu, paste week button, pass props to day cells |
| `src/components/athletes/AthleteCalendarDayCell.tsx` | Enhance 3-dot menu with copy/paste/clear day, manage tests/events, add session menu |
| `src/components/athletes/AthleteCalendarView.tsx` | Wire new handlers and state to week rows |

---

## Expected Outcome

After implementation:
1. **Week header** will have a 3-dot menu with "Copy week" and "Clear week" options
2. **Paste Week button** appears on hover when a week is copied
3. **Day 3-dot menu** includes: Copy day, Paste day, Clear day, Manage tests/events
4. **Session cards** have a 3-dot menu with: Copy session, Delete session
5. **Paste Session/Day buttons** appear on hover when data is copied
6. **CombinedTestEventDialog** opens for managing tests/events on any day
7. All operations persist correctly to the athlete-assignment localStorage
