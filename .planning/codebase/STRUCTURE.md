# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
plan-prep-coach/
├── src/
│   ├── main.tsx                    # React app entry point
│   ├── App.tsx                     # Router setup, provider hierarchy
│   ├── index.css                   # Global styles (Tailwind, theme variables)
│   ├── App.css                     # App-specific styles
│   │
│   ├── pages/                      # Route page components (one per major feature)
│   │   ├── HomePage.tsx
│   │   ├── MacrocyclePage.tsx      # Wizard Step 1-3: Plan setup, goal definition
│   │   ├── MesocyclePage.tsx       # Wizard Step 4-5: Periodization table
│   │   ├── MicrocyclePlanningPage.tsx  # Wizard Step 6+: Daily calendar, exercise assignment
│   │   ├── AthleteDatabase.tsx     # Database: Manage athletes
│   │   ├── AthleticismDatabase.tsx # Database: Parameter system (v1)
│   │   ├── AthleticismDatabaseV2.tsx  # Database: Parameter system (v2)
│   │   ├── ToolboxDatabase.tsx     # Database: Training methods & exercises
│   │   ├── TrainingProgramsPage.tsx    # Manage saved training programs
│   │   ├── TemplatesPage.tsx       # Template management
│   │   ├── LibraryPage.tsx         # Custom library viewer
│   │   └── NotFound.tsx            # 404 fallback
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx       # Top-level layout with header, sidebar, AI panel
│   │   │   └── NavigationSidebar.tsx  # Navigation menu
│   │   │
│   │   ├── ui/                     # Atomic UI components (shadcn-ui + custom)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── ... (20+ more primitive components)
│   │   │   ├── planning-navigation-menu.tsx  # Wizard step navigator
│   │   │   ├── searchable-dropdown.tsx
│   │   │   ├── parameter-input.tsx
│   │   │   ├── add-method-dialog.tsx
│   │   │   └── ... (custom UI extensions)
│   │   │
│   │   ├── shared/                 # Multi-feature shared components
│   │   │   ├── TrainingPlanOverview.tsx  # Displays plan summary (macro data)
│   │   │   ├── ExerciseDetailDialog.tsx  # Exercise details popup
│   │   │   ├── EnhancedEditableTable.tsx # Reusable editable table
│   │   │   ├── MethodDeleteDialog.tsx
│   │   │   └── ...
│   │   │
│   │   ├── macrocycle/             # Macrocycle page components
│   │   │   ├── AddSmartGoalDialog.tsx
│   │   │   ├── AddSubGoalDialog.tsx
│   │   │   ├── AddAdditionalMethodDialog.tsx
│   │   │   └── ...
│   │   │
│   │   ├── mesocycle/              # Mesocycle page components
│   │   │   ├── MesocycleCalendar.tsx   # Date range picker
│   │   │   ├── MicrocycleIntensityPlanning.tsx  # Intensity grid editor
│   │   │   ├── IntensityColumn.tsx     # Column in periodization table
│   │   │   ├── IntensityScale.tsx      # Legend + color mapping
│   │   │   ├── ResourcesDialog.tsx
│   │   │   └── ...
│   │   │
│   │   ├── microcycle-planning/    # Microcycle (calendar) page components
│   │   │   ├── TrainingCalendarView.tsx    # Main calendar grid (LARGE - 55KB)
│   │   │   ├── EnhancedExerciseDistribution.tsx  # Session layout manager (LARGE - 97KB)
│   │   │   ├── MicrocyclePlanningTable.tsx      # Periodization table view (LARGE - 87KB)
│   │   │   ├── SessionColumnView.tsx        # Single session UI (LARGE - 37KB)
│   │   │   ├── WorkoutSessionSheet.tsx      # Session editing sheet (LARGE - 119KB)
│   │   │   ├── WorkoutSectionCard.tsx       # Section (Warm-up/Main/Cooldown)
│   │   │   ├── WorkoutExerciseCard.tsx      # Exercise detail card
│   │   │   ├── ExerciseLibraryPopup.tsx     # Exercise picker popup
│   │   │   ├── MasterPlannerColumn.tsx      # Column view variant (LARGE - 92KB)
│   │   │   ├── TrainingDayCell.tsx          # Single day cell editor (LARGE - 28KB)
│   │   │   ├── DayExercisesDialog.tsx
│   │   │   ├── DayHeader.tsx
│   │   │   ├── WeekRow.tsx
│   │   │   ├── ExerciseChangePopup.tsx
│   │   │   ├── ExerciseCopyDialog.tsx
│   │   │   ├── MethodSelectionDialog.tsx
│   │   │   ├── AdHocMethodSelectionDialog.tsx
│   │   │   ├── TestEventSelectionDialog.tsx
│   │   │   ├── CombinedTestEventDialog.tsx
│   │   │   ├── NewExerciseDialog.tsx
│   │   │   ├── ParameterInputField.tsx
│   │   │   ├── ParameterVisibilityPopover.tsx
│   │   │   ├── WorkoutArrangementSidebar.tsx
│   │   │   ├── ExerciseLibraryFilter.tsx
│   │   │   ├── ExerciseLibraryPanel.tsx
│   │   │   ├── ExerciseSelectionCell.tsx
│   │   │   └── index.ts (barrel export)
│   │   │
│   │   ├── athletes/               # Athlete database & calendar components
│   │   │   ├── AssignProgramDialog.tsx     # Assign training program to athlete
│   │   │   ├── AthleteCalendarView.tsx     # Athlete's calendar view
│   │   │   └── ...
│   │   │
│   │   ├── programs/               # Training program management
│   │   │   └── SaveProgramButton.tsx  # Button to save current plan state as program
│   │   │
│   │   ├── athleticism/            # Athleticism Database v1 components
│   │   ├── goals/                  # Goal-related components (v2 params)
│   │   ├── exercises/              # Exercise-related components
│   │   ├── toolbox/                # Toolbox Database components
│   │   ├── plyometrics/            # Plyometric-specific components
│   │   ├── planner/                # Planner feature-specific components
│   │   │   ├── PlannerWizard.tsx
│   │   │   └── PlanTable.tsx
│   │   ├── templates/              # Template-related components
│   │   └── ...
│   │
│   ├── hooks/                      # Custom React hooks (domain logic)
│   │   ├── useAthletes.ts          # Athlete CRUD, biometrics, performance parameters
│   │   ├── useAthleteCalendarEditing.ts  # LARGE (72KB) - Calendar state + copy/paste
│   │   ├── useAthleticismData.ts   # Load athleticism database parameters
│   │   ├── useToolboxData.ts       # Load training methods & exercises
│   │   ├── useTrainingPrograms.ts  # Save/load training programs from localStorage
│   │   ├── useParametersDataV2.ts  # Manage v2 parameters (Athleticism Database)
│   │   ├── useDragFill.ts          # Fill cells via drag/drop
│   │   ├── useLocalStorage.ts      # Generic localStorage persistence hook
│   │   ├── use-toast.ts            # Toast notification hook
│   │   ├── use-mobile.tsx          # Mobile responsiveness detector
│   │   └── ...
│   │
│   ├── contexts/                   # React Context providers (global state)
│   │   ├── DisplayModeContext.tsx   # Display mode: "step-by-step" | "macro" | "meso" | "micro"
│   │   └── CustomLibrariesContext.tsx  # User-created custom exercise libraries
│   │
│   ├── types/                      # TypeScript type definitions
│   │   ├── training.ts             # Core training model (Mesocycle, TrainingDay, SessionExercise, etc.)
│   │   ├── athlete.ts              # Athlete, biometrics, performance parameters, calendar assignment
│   │   ├── daily-intensity.ts      # TrainingDay, DailyIntensity
│   │   ├── microcycle-planning.ts  # ExerciseDistribution, SessionSection, SupersetMapping, CellData
│   │   ├── exercises.ts            # Exercise interface
│   │   ├── athleticism.ts
│   │   ├── toolbox.ts
│   │   ├── plyometrics.ts
│   │   ├── parametersV2.ts         # Parameter system types
│   │   ├── workout.ts
│   │   └── vite-env.d.ts
│   │
│   ├── features/
│   │   └── planner/
│   │       └── types.ts            # Mesocycle, Microcycle, ExtendedMesocycle, Plan, Intensity
│   │
│   ├── data/                       # Reference data files
│   │   ├── athleticismData.ts      # Pre-built athleticism parameters
│   │   ├── exerciseData.ts         # Pre-built exercise library
│   │   ├── toolboxData.ts          # Pre-built training methods
│   │   ├── trainingData.ts         # Training method hierarchies
│   │   └── methodParameters.ts     # Method → parameter mappings
│   │
│   ├── utils/                      # Pure utility functions
│   │   ├── dateCalculations.ts     # Date math
│   │   ├── dateShifting.ts         # Timezone-safe date operations
│   │   ├── formulaEvaluator.ts     # Evaluate cell formulas (e.g., "3×5" → { sets: 3, reps: 5 })
│   │   ├── sessionIndexUtils.ts    # Calculate session indices from day/microcycle
│   │   ├── supersetUtils.ts        # Superset add/remove/toggle logic
│   │   ├── clearCache.ts           # Clear persisted data
│   │   └── (from shadcn-ui) lib/utils.ts  # cn() utility for class merging
│   │
│   └── lib/
│       └── utils.ts                # Utility function re-export (e.g., cn() from clsx)
│
├── public/                         # Static assets
├── package.json                    # Dependencies, build scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite build configuration
├── index.html                      # HTML entry point
└── ...
```

## Directory Purposes

**src/pages/:**
- Purpose: Mounting points for application routes; each page represents a major workflow stage
- Contains: Route components that compose smaller feature components
- Loads state from localStorage, passes to child components via props
- No business logic inside pages (moved to hooks)

**src/components/:**
- Purpose: Reusable and feature-specific React components
- Sub-directories organize by feature (macrocycle, mesocycle, microcycle-planning) and layer (ui, shared, layout)
- Large components: EnhancedExerciseDistribution (97KB), WorkoutSessionSheet (119KB), MasterPlannerColumn (92KB)

**src/hooks/:**
- Purpose: Extract state management and domain logic from components
- Critical hooks: useAthleteCalendarEditing (72KB), useAthletes, useTrainingPrograms
- All data persistence and API interactions funneled through hooks
- Hooks return data + setter functions for consumption by components

**src/contexts/:**
- Purpose: Provide global state that multiple features need (display mode, custom libraries)
- Minimal usage: DisplayMode (simple string), CustomLibraries (complex with CRUD operations)
- Accessed via useContext hooks in child components

**src/types/:**
- Purpose: Define TypeScript interfaces for all domain entities
- Core types: TrainingDay, Mesocycle, Microcycle, ExerciseDistribution, Athlete
- Centralized to ensure type consistency across the app

**src/data/:**
- Purpose: Store pre-built reference data (exercises, methods, parameters)
- Large files: athleticismData.ts (54KB), exerciseData.ts (49KB), toolboxData.ts (44KB)
- Used for lookups in UI (exercise pickers, method selectors) and as fallback defaults

**src/utils/:**
- Purpose: Pure functions for calculations and data transformation
- Key utilities: formulaEvaluator (parse cell values), dateShifting (assignment date mapping), supersetUtils

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Mounts React app to DOM
- `src/App.tsx`: Sets up routes, providers, top-level layout
- `src/pages/HomePage.tsx`: Dashboard/home page

**Configuration:**
- `tsconfig.json`: TypeScript compiler settings
- `vite.config.ts`: Vite bundler configuration
- `index.html`: HTML template
- `src/index.css`: Global Tailwind + CSS variables

**Core Logic:**
- `src/hooks/useAthletes.ts`: Athlete CRUD operations
- `src/hooks/useTrainingPrograms.ts`: Program save/load
- `src/hooks/useAthleteCalendarEditing.ts`: Calendar state management (most complex)
- `src/utils/formulaEvaluator.ts`: Parse method parameter expressions
- `src/utils/supersetUtils.ts`: Superset grouping logic

**Testing:**
- No test files present in codebase (testing not yet implemented)

## Naming Conventions

**Files:**
- Page components: `PascalCase.tsx` suffixed with "Page" (e.g., MacrocyclePage.tsx)
- Components: `PascalCase.tsx` (e.g., WorkoutSessionSheet.tsx, ExerciseLibraryPanel.tsx)
- Hooks: `camelCase.ts` prefixed with "use" (e.g., useAthletes.ts, useTrainingPrograms.ts)
- Utilities: `camelCase.ts` describing the function (e.g., formulaEvaluator.ts)
- Types: `kebab-case.ts` (e.g., microcycle-planning.ts, daily-intensity.ts)
- Data files: `camelCase.ts` (e.g., athleticismData.ts, exerciseData.ts)

**Directories:**
- Feature directories: `kebab-case` (e.g., microcycle-planning, athleticism)
- Layer directories: lowercase (e.g., components, hooks, contexts, types, utils, data)

**TypeScript:**
- Interfaces: `PascalCase` (e.g., ExerciseDistribution, TrainingDay)
- Types: `PascalCase` or lowercase for unions (e.g., IntensityLevel = union type)
- Enums: Not used; unions preferred (e.g., type Sex = 'male' | 'female' | 'other')

**React Components:**
- Props interfaces: `ComponentNameProps` (e.g., EnhancedExerciseDistributionProps)
- Context providers: `ComponentNameProvider` (e.g., DisplayModeProvider)
- Hooks: `useCamelCase` (e.g., useAthletes, useDisplayMode)

## Where to Add New Code

**New Feature (e.g., new wizard step):**
- Primary code: Create page in `src/pages/NewFeaturePage.tsx`
- Components: Create subdirectory `src/components/new-feature/` for feature-specific components
- Hook: Create `src/hooks/useNewFeatureData.ts` if complex state needed
- Types: Add interfaces to `src/types/new-feature.ts` or existing related file
- Tests: Create `src/pages/NewFeaturePage.test.tsx` (when testing is enabled)

**New Component/Module (e.g., new dialog):**
- Implementation: `src/components/{feature-name}/{ComponentName}.tsx`
- If shared across features: `src/components/shared/{ComponentName}.tsx`
- If it's a primitive UI element: `src/components/ui/{component-name}.tsx`
- Pass data via props; avoid direct localStorage access in components

**Utilities:**
- Pure functions for calculations: `src/utils/{function-name}.ts`
- Export as named exports (not default)
- Keep functions side-effect free; avoid localStorage access

**Custom Hooks:**
- Location: `src/hooks/use{Feature}.ts`
- Pattern: Hook handles all state logic, localStorage persistence, returns data + setters
- Example pattern from `useAthletes.ts`:
  ```typescript
  export function useAthletes() {
    const [athletes, setAthletes] = useState([]);
    useEffect(() => {
      // Load from localStorage
      const saved = localStorage.getItem('athletes');
      if (saved) setAthletes(JSON.parse(saved));
    }, []);

    return {
      athletes,
      addAthlete: (athlete) => { /* ... */ },
      updateAthlete: (id, updates) => { /* ... */ }
    };
  }
  ```

**Shared UI Components:**
- Location: `src/components/ui/` for shadcn primitives or new custom primitives
- Location: `src/components/shared/` for multi-feature business components
- Example: ExerciseDetailDialog (used in multiple feature contexts)

**Data/Reference Files:**
- Location: `src/data/{domain}Data.ts` (e.g., athleticismData.ts, toolboxData.ts)
- Avoid importing data directly into components; access via hooks or pass via props
- Structure: Export typed constants (const athleticismData: ParameterV2[] = [...])

## Special Directories

**src/components/ui/:**
- Purpose: Atomic UI components from shadcn-ui library
- Generated: Some files auto-generated by shadcn CLI
- Committed: Yes, customized versions committed to git
- Files are primitives and should not be modified lightly (breaking changes affect entire app)

**src/data/:**
- Purpose: Static reference data baked into the app
- Generated: No (manually maintained)
- Committed: Yes
- Large files; used for exercise/method lookups during session

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (via npm install)
- Committed: No (.gitignore excludes)

**public/:**
- Purpose: Static assets served directly (favicon, public images)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-15*
