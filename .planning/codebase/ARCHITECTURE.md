# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** React SPA with layered state management (Context + custom hooks) supporting a multi-step wizard architecture for training program planning.

**Key Characteristics:**
- Multi-page wizard pattern with bidirectional state synchronization (Macrocycle → Mesocycle → Microcycle)
- Hierarchical data model mirroring training periodization (Macro → Meso → Micro cycles)
- Local storage-based persistence for session state and custom libraries
- Custom hooks managing complex domain logic (athlete data, calendar editing, parameter tracking)
- Context API for shared cross-cutting state (display mode, custom libraries)
- Component-driven UI built with shadcn-ui and Radix UI primitives

## Layers

**Presentation Layer:**
- Purpose: React components rendering the UI
- Location: `src/components/`
- Contains: Page components, feature-specific components, shared UI components, library-specific components
- Depends on: Hooks (for state/logic), Context (for shared state), Utils (for formatting/calculations)
- Used by: App.tsx routing

**Page/Route Layer:**
- Purpose: Mounting points for major workflow steps (Macrocycle, Mesocycle, Microcycle planning)
- Location: `src/pages/`
- Contains: MacrocyclePage.tsx, MesocyclePage.tsx, MicrocyclePlanningPage.tsx, database pages (AthleteDatabase, AthleticismDatabase, etc.)
- Depends on: Components, hooks, contexts
- Used by: BrowserRouter in App.tsx

**State Management Layer:**
- Purpose: Managing application and domain state
- Location: `src/contexts/` and `src/hooks/`
- Contains:
  - Contexts: DisplayModeContext.tsx, CustomLibrariesContext.tsx
  - Custom Hooks: useAthletes, useAthleteCalendarEditing, useAthleticismData, useToolboxData, useTrainingPrograms, etc.
- Depends on: Types, utils, localStorage API
- Used by: Components and pages

**Data Layer:**
- Purpose: Structuring and organizing reference data
- Location: `src/data/`
- Contains: athleticismData.ts, exerciseData.ts, toolboxData.ts, trainingData.ts, methodParameters.ts
- Depends on: Types
- Used by: Hooks and components for reference/lookup

**Type System:**
- Purpose: TypeScript interfaces defining data structures
- Location: `src/types/`
- Contains: training.ts (main training model), athlete.ts (athlete data), microcycle-planning.ts (micro-level UI state), daily-intensity.ts, exercises.ts, workout.ts, etc.
- Depends on: None (leaf layer)
- Used by: All layers

**Utilities:**
- Purpose: Pure functions for calculations and data manipulation
- Location: `src/utils/`
- Contains: dateCalculations.ts, dateShifting.ts, formulaEvaluator.ts, sessionIndexUtils.ts, supersetUtils.ts, clearCache.ts
- Depends on: date-fns library, types
- Used by: Hooks, components, and other utilities

**Feature Layer:**
- Purpose: Feature-specific types and organization
- Location: `src/features/planner/`
- Contains: types.ts (Mesocycle, Microcycle, Intensity types for planning)
- Depends on: Types
- Used by: Pages and hooks

## Data Flow

**Forward Flow (Macrocycle → Microcycle):**

1. **MacrocyclePage (Step 1-3):** Coach selects athlete, defines smart goal, chooses training methods
   - Stores: Plan name, date range, athlete ID, goal parameters, quality selections, methods
   - Output: macrocycleData structure saved to localStorage

2. **MesocyclePage (Step 4-5):** Coach configures mesostructure and periodization table
   - Input: macrocycleData from localStorage
   - Creates: Mesocycle definitions with intensity profiles per microcycle
   - Key component: MesocycleCalendar, IntensityColumn components
   - Stores: mesocycles array, parameter values for each method×microcycle cell
   - Output: ExtendedMesocycle[] with training method parameters

3. **MicrocyclePlanningPage (Step 6+):** Coach builds daily calendar and assigns exercises
   - Input: mesocycles from localStorage, trainingDays computed from dates
   - Creates: Calendar grid with training days, sessions, sections, exercises
   - Key component: TrainingCalendarView, EnhancedExerciseDistribution, WorkoutSessionSheet
   - Stores: exerciseDistribution[], sessionSections[], supersets mapping, parameter overrides
   - Output: Complete training calendar with exercise-level parameters

**Backward Propagation (Microcycle changes affect Mesocycle):**

- When intensity changed on microcycle day: updates `dailyIntensityData` and reflects up to mesocycle
- When exercises are modified: parameter values from periodization table automatically cascade down
- Formula evaluation in cells: `evaluateFormula()` in `src/utils/formulaEvaluator.ts` applies method parameters to exercises

**State Management Strategy:**

- **Macrocycle state:** localStorage key `macrocycleData`, loaded via custom hook in pages
- **Mesocycle state:** localStorage key `mesocycleData`, step tracking via localStorage
- **Microcycle state:** Complex local component state + localStorage auto-save via `useAthleteCalendarEditing` hook
- **Session/transient state:** useState hooks within components (copy/paste buffers, UI toggles)
- **Shared global state:** Context (DisplayMode for UI preferences, CustomLibraries for user-created libraries)

## Key Abstractions

**ExtendedMesocycle:**
- Purpose: Represents a training block with time bounds and intensity profiles
- Examples: `src/features/planner/types.ts`, `src/pages/MesocyclePage.tsx`
- Pattern: Extends base Mesocycle with startDate, endDate, trainingMethods array

**ExerciseDistribution:**
- Purpose: Atomic unit representing an exercise assigned to a specific day/session/section
- Examples: `src/types/microcycle-planning.ts`, `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`
- Pattern: Contains exerciseId, dayDate, sessionIndex, sectionId, plus optional superset grouping and parameter overrides

**CellData:**
- Purpose: Represents a periodization table cell (method × microcycle intersection)
- Examples: `src/types/microcycle-planning.ts`, `src/components/mesocycle/`
- Pattern: Stores method ID, category, and selected exercises; keyed by unique cellId in exerciseSelectionData record

**SessionSection:**
- Purpose: Groups exercises within a training session (Warm-up, Main, Cooldown)
- Examples: `src/types/microcycle-planning.ts`, `src/components/microcycle-planning/`
- Pattern: Hierarchical: Session contains Sections, Sections contain Exercises

**SupersetMapping:**
- Purpose: Nested record structure mapping exercises grouped as supersets
- Examples: `src/types/microcycle-planning.ts`, `src/utils/supersetUtils.ts`
- Pattern: `{ dayDate → { sessionIndex → { sectionId → { supersetId → exerciseIds[] } } } }`

**TrainingDay:**
- Purpose: Represents a calendar day with intensity and assigned sessions
- Examples: `src/types/daily-intensity.ts`, `src/components/microcycle-planning/TrainingCalendarView.tsx`
- Pattern: Date + isTrainingDay flag + intensity level + sessions array

## Entry Points

**Main Application:**
- Location: `src/main.tsx`
- Triggers: App mount in root HTML element
- Responsibilities: ReactDOM initialization

**App Component:**
- Location: `src/App.tsx`
- Triggers: Application initialization
- Responsibilities: Route setup (BrowserRouter), provider setup (QueryClient, DisplayMode, CustomLibraries), top-level UI layout

**AppLayout:**
- Location: `src/components/layout/AppLayout.tsx`
- Triggers: Every route navigation
- Responsibilities: Header bar, navigation sidebar, AI agent panel, outlet for page content

**Wizard Pages (entry points to major features):**
- `MacrocyclePage`: `/macrocycle` - Initial plan setup
- `MesocyclePage`: `/mesocycle` - Periodization configuration
- `MicrocyclePlanningPage`: `/microcycle` - Daily calendar + exercise assignment
- Database pages: `/athletes`, `/templates/*` - Data management

## Error Handling

**Strategy:** Try-catch blocks in hooks with toast notifications; graceful fallbacks in data loading

**Patterns:**
- Hook data fetching: `try { load data } catch { toast error, return default }`
  - Example: `useAthleticismData()` in `src/hooks/useAthleticismData.ts`
- localStorage persistence: Wrapped in try-catch with JSON.parse error handling
  - Example: CustomLibrariesContext load logic
- Formula evaluation: Wrapped in `evaluateFormula()` utility with validation
  - Example: `src/utils/formulaEvaluator.ts` validates syntax before evaluation

**Patterns:**
- Network errors: Toast notifications (Sonner library)
- Validation errors: Inline error messages in forms, AlertDialog for destructive actions
- State corruption: Clear cache utilities in `src/utils/clearCache.ts`

## Cross-Cutting Concerns

**Logging:** console.log/error statements in critical paths (e.g., copy/paste operations, state loads)

**Validation:**
- Form validation: react-hook-form with Zod schemas (for future implementation)
- Parameter validation: `evaluateFormula()` validates cell formulas
- Exercise assignment: Constraint checking in UI (frequency warnings on MicrocyclePlanningPage)

**Authentication:** Not implemented (coach is assumed to be authenticated before app loads)

**Caching/Performance:**
- useMemo for derived data: athlete lists, filtered exercises, computed date ranges
- useCallback for event handlers to prevent unnecessary re-renders
- React Query (QueryClientProvider) set up but minimal usage currently
- localStorage for session persistence to avoid re-fetching on page reload

**Date Management:**
- Centralized via date-fns library
- Timezone-safe operations in `src/utils/dateShifting.ts`
- Date ISO string format (YYYY-MM-DD) used consistently across types

---

*Architecture analysis: 2026-03-15*
