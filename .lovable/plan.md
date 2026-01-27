

## Align Athlete Calendar with Training Calendar Design

### Overview

This plan updates the Athlete Calendar header layout to match the Training Calendar from the planning wizard, and adds a dropdown menu when clicking the plus button to allow users to either "Assign Program" or "Add Session" (which opens an empty workout session sheet).

---

### Changes

#### 1. Update Header Layout to Match Training Calendar

**File:** `src/components/athletes/AthleteCalendarView.tsx`

Current layout:
```
[<] [>] [Today] Jan 27 - Feb 23   [1W] [2W] [4W]   [+ Assign Program]
```

New layout (matching TrainingCalendarView):
```
[📅 Calendar]   [1W] [2W] [4W]   [<] [Today] [>]
```

Changes:
- Remove the separate "Assign Program" button from header (will be in day cell dropdown)
- Move navigation (< Today >) to the **right side** of the header
- Add Calendar icon with title on the left side (like Training Calendar)
- Keep view mode selector (1W, 2W, 4W) in the **center** of the navigation group

---

#### 2. Add Dropdown Menu to Plus Button in Day Cells

**File:** `src/components/athletes/AthleteCalendarDayCell.tsx`

When user clicks the plus (+) button on an empty day, show a dropdown menu with two options:
- **"Assign Program"** - Opens the existing AssignProgramDialog
- **"Add Session"** - Opens an empty workout session sheet

Update props interface:
```typescript
interface AthleteCalendarDayCellProps {
  // ... existing props
  onAddSession?: (date: Date) => void;  // NEW: Opens workout session sheet
}
```

Replace the current Button with a DropdownMenu:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="icon" className="h-7 w-7" title="Add to calendar">
      <Plus className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="center" className="z-[100] bg-background">
    <DropdownMenuItem onClick={() => onDayClick?.(day.date)}>
      <CalendarPlus className="mr-2 h-4 w-4" />
      Assign Program
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onAddSession?.(day.date)}>
      <Dumbbell className="mr-2 h-4 w-4" />
      Add Session
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

#### 3. Add Workout Session Sheet Integration

**File:** `src/components/athletes/AthleteCalendarView.tsx`

Add state and handler for opening an empty workout session sheet:
```typescript
const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
const [selectedSessionDate, setSelectedSessionDate] = useState<Date | null>(null);

const handleAddSession = (date: Date) => {
  setSelectedSessionDate(date);
  setSessionSheetOpen(true);
};
```

Import and render the WorkoutSessionSheet component:
```tsx
import { WorkoutSessionSheet } from '@/components/microcycle-planning/WorkoutSessionSheet';

// In the component JSX:
<WorkoutSessionSheet
  isOpen={sessionSheetOpen}
  onClose={() => setSessionSheetOpen(false)}
  dayDate={selectedSessionDate ? format(selectedSessionDate, 'yyyy-MM-dd') : ''}
  sessionIndex={0}
  exercises={[]}  // Empty for new session
  // ... minimal required props for empty session
/>
```

---

#### 4. Update Props Flow

**File:** `src/components/athletes/AthleteCalendarWeekRow.tsx`

Pass the new `onAddSession` callback down to day cells:
```typescript
interface AthleteCalendarWeekRowProps {
  // ... existing
  onAddSession?: (date: Date) => void;  // NEW
}
```

---

### Visual Result

**Header - Before:**
```
[<] [>] [Today] Jan 27 - Feb 23    [1W] [2W] [4W]    [+ Assign Program]
```

**Header - After:**
```
📅 Athlete Calendar    [1W] [2W] [4W]    [<] [Today] [>]
```

**Day Cell Plus Button - Before:**
```
┌─────────────────┐
│ 27              │
│                 │
│      [+]        │  ← Single button opens Assign Program
│                 │
└─────────────────┘
```

**Day Cell Plus Button - After:**
```
┌─────────────────┐
│ 27              │
│                 │
│      [+]        │  ← Dropdown with 2 options:
│                 │     📅 Assign Program
└─────────────────┘     🏋️ Add Session
```

---

### Summary of Files to Modify

| File | Changes |
|------|---------|
| `AthleteCalendarView.tsx` | Update header layout, add WorkoutSessionSheet integration |
| `AthleteCalendarDayCell.tsx` | Replace plus button with dropdown menu |
| `AthleteCalendarWeekRow.tsx` | Pass `onAddSession` prop to day cells |

---

### Technical Notes

1. **WorkoutSessionSheet Props**: The sheet requires several props (mesocycleId, microcycleIndex, parameterValues, etc.). For athlete ad-hoc sessions, we'll provide minimal/dummy values since these sessions aren't tied to a training program structure.

2. **Session Storage**: Ad-hoc athlete sessions will need a new storage mechanism. For this initial implementation, we can store them in a new array within the athlete database (e.g., `athleteSessions: AthleteSession[]`). This is an enhancement that can be added after the UI is working.

3. **Future Enhancement**: Full session editing and persistence for athlete calendar will require extending the `useAthletes` hook to store session data separately from program assignments.

