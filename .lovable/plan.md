
## Redesign Athlete Calendar to Match Training Calendar View

### Overview

This is a significant redesign to replace the current monthly calendar in the Athlete Database with a week-based Training Calendar-style view. The new design will show assigned program workouts in day cells with the same visual styling and interaction patterns as the Microcycle Planning wizard.

---

### Current vs. Target Design

**Current Athlete Calendar:**
- Monthly grid view (5-6 rows of 7 days)
- Shows program assignments as colored horizontal bars spanning multiple days
- Click on a day to assign a program
- Simple "Assign Program" button in header
- No session details, exercises, or intensity indicators visible

**Target Design (Training Calendar Style):**
- Week-based view (1-week, 2-week, 4-week toggle options)
- Individual day cells showing:
  - Session cards with exercise counts
  - Intensity color indicators (badges)
  - Test/event indicators
  - "Add session" plus icon button
- Week navigation (previous/next)
- View mode selector in header
- Day header dropdown menus for copy/paste/clear operations

---

### Architecture Considerations

The Athlete Calendar has a fundamentally different data model than the Training Calendar:

| Aspect | Training Calendar | Athlete Calendar |
|--------|------------------|------------------|
| Data source | Active planning session (in-memory state) | Saved program assignments (localStorage/database) |
| Purpose | Building/editing a training program | Viewing/managing assigned programs for an athlete |
| Sessions | Dynamically created during planning | Loaded from saved program snapshots |
| Editing | Full exercise/session editing | Read-only view of assigned programs (or edit if needed) |

---

### Implementation Plan

#### Phase 1: Create New Week-Based Calendar Structure

**File:** `src/components/athletes/AthleteCalendarView.tsx`

1. **Add view mode state and navigation:**
   - `viewMode`: '1week' | '2week' | '4week'
   - `currentDate`: Date for week navigation
   - Previous/Next week navigation buttons
   - View mode selector dropdown

2. **Replace monthly grid with week-based grid:**
   - Calculate week ranges based on currentDate and viewMode
   - Use similar `calendarDays` and `weeks` computation as TrainingCalendarView
   - Create WeekRow-style layout for each week

3. **Create athlete-specific day cells:**
   - New component `AthleteCalendarDayCell` (or adapt existing patterns)
   - Show assigned program sessions for each day
   - Display session cards with exercise counts
   - Show intensity badges
   - Include test/event indicators from assigned programs

---

#### Phase 2: Day Cell Design (Matching TrainingDayCell)

**Create:** `src/components/athletes/AthleteCalendarDayCell.tsx`

Visual elements to include:
- Day number header with intensity badge
- Session cards showing:
  - Session name
  - Exercise count badge
  - Method name (primary)
- Today indicator (blue circle around date)
- Outside-month muted styling
- Hover state with dropdown menu

Interactions:
- Click on day → Expand to view session details or assign program
- Plus icon button → Assign new program starting from this date
- Dropdown menu → View details, copy, clear assignment

---

#### Phase 3: Load Assigned Program Data into Calendar

1. **Extract session data from assignments:**
   - Each `AthleteCalendarAssignment` contains `assignedMesocycles` with full program data
   - Parse the mesocycle data to get:
     - Session schedules per day
     - Exercise distributions
     - Intensity levels
     - Test/event schedules

2. **Map assignment dates to calendar days:**
   - Use the assignment's `startDate` and calculate each day's training schedule
   - Handle multiple overlapping assignments (show stacked or merged)

---

#### Phase 4: Header and Controls

Update the header to match Training Calendar style:
- Left side: Previous/Next navigation + "Today" button + date range display
- Center: View mode buttons (1 Week, 2 Week, 4 Week)
- Right side: "Assign Program" button

---

### Summary Table

| Component | Action |
|-----------|--------|
| `AthleteCalendarView.tsx` | Major rewrite - week-based layout, view mode, navigation |
| `AthleteCalendarDayCell.tsx` | New component - styled like TrainingDayCell |
| Program assignment data | Parse to extract daily sessions/exercises |
| Header controls | New navigation and view mode selector |

---

### Visual Mockup

**New Athlete Calendar Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  [<] [>] Jan 27 - Feb 23, 2026   [1W] [2W] [4W]    [+ Assign Program]│
├──────────────────────────────────────────────────────────────────────┤
│ Mon          Tue          Wed          Thu          Fri          Sat │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────┐      ┌────┐       ┌────┐       ┌────┐       ┌────┐       ┌───┐│
│ │27🟡│      │28🟢│       │29🔴│       │30🟡│       │31🔴│       │ 1 ││
│ │Sess│      │Sess│       │Rest│       │Sess│       │Test│       │   ││
│ │[4] │      │[6] │       │    │       │[5] │       │🏆  │       │[+]││
│ └────┘      └────┘       └────┘       └────┘       └────┘       └───┘│
├──────────────────────────────────────────────────────────────────────┤
│ (Week 2...)                                                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Technical Notes

1. **Data Extraction:** The assigned program snapshots contain complete mesocycle data. We need to:
   - Calculate day offsets from assignment start date
   - Map each day to the corresponding microcycle day
   - Extract session configurations (sections, exercises, intensity)

2. **Read vs. Edit Mode:** Initially, the Athlete Calendar will be read-only for viewing assigned programs. Future enhancement could allow editing sessions directly.

3. **Assignments List:** Keep the existing "Assigned Programs" card below the calendar as a summary/management view.

---

### Files to Modify/Create

| File | Action |
|------|--------|
| `src/components/athletes/AthleteCalendarView.tsx` | Major redesign |
| `src/components/athletes/AthleteCalendarDayCell.tsx` | Create new |
| `src/components/athletes/index.ts` | Export new component |

