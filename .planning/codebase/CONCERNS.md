# Codebase Concerns

**Analysis Date:** 2026-03-15

## Tech Debt

**Monolithic Page Components:**
- Issue: `src/pages/MesocyclePage.tsx` (5,112 lines), `src/pages/MicrocyclePlanningPage.tsx` (3,313 lines), and `src/pages/MacrocyclePage.tsx` (2,867 lines) are extremely large with tightly coupled business logic
- Files: `src/pages/MesocyclePage.tsx`, `src/pages/MicrocyclePlanningPage.tsx`, `src/pages/MacrocyclePage.tsx`
- Impact: Difficult to test, maintain, and extend; high risk of unintended side effects when modifying shared state
- Fix approach: Extract complex logic into custom hooks (e.g., `useMesocycleState`, `useMesocycleCalculations`); split pages into smaller concern-specific components; move business logic out of component render paths

**Excessive localStorage Direct Coupling:**
- Issue: 323 instances of direct `localStorage.get/setItem` calls scattered throughout the codebase instead of using abstraction layer. Multiple hooks and components independently manage the same keys, creating synchronization risks
- Files: `src/hooks/useTrainingPrograms.ts`, `src/hooks/useToolboxData.ts`, `src/contexts/CustomLibrariesContext.tsx`, `src/hooks/useAthleteCalendarEditing.ts`, and many page components
- Impact: Hard-coded storage keys mean changes require finding and updating multiple locations; no validation of stored data structure; data corruption if two components write simultaneously
- Fix approach: Create `StorageService` abstraction with typed, validated getters/setters; centralize all storage keys to a single constants file; use the existing `useLocalStorage` hook universally instead of direct calls

**Overly Complex State Structure:**
- Issue: Deeply nested state objects (6+ levels deep) in parameters and training plan data. Example: `parameterValues[mesocycleId][microcycleIndex][methodId][sessionIndex][exerciseId]`
- Files: `src/pages/MesocyclePage.tsx` (lines 82), `src/pages/MicrocyclePlanningPage.tsx` (line 63), `src/hooks/useAthleteCalendarEditing.ts` (line 68)
- Impact: Error-prone updates; difficult to trace data changes; performance issues with deep equality checks in React renders
- Fix approach: Normalize state to flat structures with IDs; use Map or Map-like structures for O(1) lookups; implement selector pattern to derive nested views without storing them

**Widespread `any` Type Usage:**
- Issue: 40+ instances of `any` type in critical paths, especially in data parsing and migration code
- Files: `src/hooks/useParametersDataV2.ts` (migration function), `src/components/microcycle-planning/WorkoutSessionSheet.tsx`, `src/pages/MacrocyclePage.tsx` (line 76), `src/pages/MicrocyclePlanningPage.tsx` (line 60)
- Impact: No compile-time type safety; runtime errors from unexpected data shapes; IDE cannot provide accurate autocomplete
- Fix approach: Define strict interfaces for all data structures; create type guards for data validation on load; use discriminated unions for variant data

---

## Known Bugs

**Date Shifting Timezone Issues (PARTIALLY FIXED):**
- Symptoms: Program assignments may show off-by-one day depending on user's timezone, particularly near midnight UTC
- Files: `src/components/athletes/AthleteCalendarView.tsx` (lines ~254-259), `src/utils/dateShifting.ts`
- Trigger: Assigning a program with start date spanning midnight UTC boundary; viewing in a timezone offset from UTC
- Current mitigation: Explicit UTC normalization added in `AthleteCalendarView` with comments about preventing "timezone-related off-by-one errors"; uses `Date.UTC()` for consistent date creation
- Note: Fix is incomplete - other components may still have naive `new Date()` usage
- Recommendation: Audit all date handling; standardize on `date-fns` format utilities; add timezone-aware test suite

**Auto-Save Infinite Loop Risk:**
- Symptoms: Calendar state may flicker or entries disappear briefly when editing
- Files: `src/hooks/useAthleteCalendarEditing.ts` (lines 75-96, refs for "flicker then disappear" bug prevention)
- Trigger: Rapid state updates during load; auto-save debounce during initialization
- Current mitigation: Uses refs (`lastSavedStateRef`, `loadingAssignmentIdRef`) to prevent re-loading same assignment; guards in effect dependencies; `isInitializing` flag
- Note: Comments indicate previous instability; refs suggest synchronous fixes applied instead of proper async handling
- Recommendation: Refactor with proper async/await patterns; use React 18 Suspense for async data loading; add integration tests for rapid assignment switching

**Parameter Value Persistence Race Condition:**
- Symptoms: Parameter edits in exercise may be lost if user rapidly switches between exercises or sessions before auto-save completes
- Files: `src/pages/MesocyclePage.tsx` (multiple `console.log('DEBUG:` statements throughout indicate ongoing debugging), `src/components/microcycle-planning/WorkoutSessionSheet.tsx`
- Trigger: Quick edits + navigation away before 500ms debounce completes
- Current mitigation: None visible - relies on hope that debounce completes
- Fix approach: Implement optimistic UI updates; add pending state indicators; flush debounced saves on component unmount; validate parameter data structure before storing

---

## Security Considerations

**localStorage Contains Full Training Plans:**
- Risk: Sensitive athlete data (complete training programs with performance parameters) stored unencrypted in browser localStorage; accessible via DevTools or malicious scripts
- Files: `src/hooks/useTrainingPrograms.ts`, `src/components/athletes/AthleteCalendarView.tsx`, all program persistence
- Current mitigation: None - data is plain JSON
- Recommendations:
  - Move critical data to server-backed storage with authentication
  - Never store plaintext athlete performance data in localStorage
  - Implement session tokens instead of persistent auth in storage
  - Use httpOnly cookies for sensitive session data

**Formula Evaluation (formulaEvaluator.ts):**
- Risk: If formula strings are ever user-inputable (currently appears developer-only), could be vector for injection
- Files: `src/utils/formulaEvaluator.ts`
- Current mitigation: Functions are defined in data files, not evaluated from user input (appears safe)
- Recommendation: Add input validation and document that this must never accept unsanitized user input

---

## Performance Bottlenecks

**Large Table Rendering Without Virtualization:**
- Problem: Periodization table (MesocyclePage) renders all rows/columns at once; up to 100+ cells with complex nested dropdowns
- Files: `src/pages/MesocyclePage.tsx`, `src/components/mesocycle/MesocycleCalendar.tsx`, `src/components/microcycle-planning/MicrocyclePlanningTable.tsx` (1,911 lines)
- Cause: React re-renders entire table on any parameter change; no virtualization
- Improvement path: Implement react-window or similar for row virtualization; memoize cell components; use React.memo + useMemo aggressively; consider moving to grid.js for large tables

**Excessive JSON Serialization:**
- Problem: 191 instances of `JSON.parse`/`JSON.stringify` scattered throughout; happens on every state update and localStorage operation
- Files: Multiple (full code search shows widespread usage)
- Cause: No structured serialization format; everything converted to string and back
- Improvement: Use JSON directly in state; serialize only at persistence boundary; consider MessagePack for complex data structures; cache serialized values

**Missing Parameter Debouncing in Complex Components:**
- Problem: `WorkoutSessionSheet.tsx` (2,749 lines) calculates method parameters on every render without debouncing
- Files: `src/components/microcycle-planning/WorkoutSessionSheet.tsx` (lines ~389-450 in parameter initialization)
- Cause: Parameter lookups happen during render phase, not in effects
- Improvement: Move parameter calculations to useMemo or useCallback; debounce parameter updates; batch parameter writes

**No Lazy Loading of Exercise Database:**
- Problem: Full exercise database loaded upfront; `src/data/exerciseData.ts` is 1,453 lines
- Files: `src/data/exerciseData.ts`
- Impact: Larger initial bundle; slower page load
- Fix: Implement code splitting for exercise database; lazy-load by category on demand

---

## Fragile Areas

**Mesocycle/Microcycle Date Recalculation:**
- Files: `src/utils/dateShifting.ts`, `src/pages/MesocyclePage.tsx` (debug logs suggest complex calculation logic)
- Why fragile: Deep nested recalculation of mesocycle/microcycle dates when structure changes; no validation that dates remain valid after shifts
- Safe modification:
  - Always test date recalculation with edge cases (year boundaries, leap years)
  - Validate that microcycle dates don't exceed mesocycle boundaries
  - Add unit tests for `shiftExerciseDates`, `shiftSessionSectionDates`, etc.
- Test coverage: Multiple `console.log('DEBUG:` statements in `MesocyclePage.tsx` (lines 283-4073) indicate debugging mode; no formal tests visible

**Method Allocation to Mesocycles:**
- Files: `src/pages/MesocyclePage.tsx` (line 94 `methodAllocations` state), `src/components/macrocycle/AddAdditionalMethodDialog.tsx`
- Why fragile: Method allocations not bidirectionally synced; if method removed from allocation but exercises still reference it, orphaned exercises occur
- Safe modification:
  - Before deleting method allocation, verify no exercises reference that method
  - Cascade deletes or prevent deletion with warning
  - Add validation pass after state changes
- Test coverage: No visible tests for allocation consistency

**Exercise Distribution Across Training Days:**
- Files: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx` (2,291 lines)
- Why fragile: Exercises distributed by frequency count; if frequency changes, no automatic redistribution happens
- Safe modification: After frequency updates, recalculate distribution; show "needs redistribution" warning; validate no exercises are orphaned
- Test coverage: Complex component with minimal error handling

**Parameter Values Storage Format:**
- Files: `src/pages/MesocyclePage.tsx` (parameterValues state structure), `src/components/microcycle-planning/WorkoutSessionSheet.tsx`
- Why fragile: Nested 6-level object structure with no schema validation; if keys are missing, entire reads fail
- Safe modification:
  - Add type-safe accessor functions with fallback defaults
  - Validate structure on load with warnings for missing keys
  - Provide migration path for format changes
- Test coverage: No visible schema validation tests

---

## Scaling Limits

**Browser localStorage Storage:**
- Current capacity: ~5-10MB per browser per domain (varies by browser)
- Limit: With large training plans (multiple mesocycles, 100+ exercises), storage can exceed 5MB
- Scaling path:
  - Implement data archival (move old programs to IndexedDB)
  - Compress program data before storage
  - Implement server-backed storage for production
  - Add storage quota warnings in UI

**State Reconciliation on Component Mount:**
- Current capacity: ~50 refs/intervals per page without performance issues
- Limit: The multiple refs and intervals in `useAthleteCalendarEditing` and `AthleteCalendarView` suggest synchronous state loading is already at limits
- Scaling path: Implement proper async initialization; use React.lazy and Suspense; defer non-critical state loads

---

## Dependencies at Risk

**date-fns Dependency Usage:**
- Risk: Heavy reliance on date-fns for date manipulation scattered across codebase; no centralized date utility layer
- Impact: If date-fns API changes or has bugs, many files must be updated
- Migration plan: Create `src/utils/dateUtils.ts` wrapper that abstracts date-fns calls; would allow swapping to Day.js or native Date APIs later

**react-beautiful-dnd (Hello Pangea fork):**
- Risk: Maintained by Hello Pangea (not the original author); potential maintenance risk
- Files: Used in `src/pages/MesocyclePage.tsx`, `src/components/microcycle-planning/SessionColumnView.tsx`, `src/components/athletes/AthleteCalendarView.tsx`
- Impact: Drag-and-drop is core to UI; library replacement would require significant refactoring
- Migration plan: Monitor maintenance status; have dnd-kit as fallback option; isolate DnD logic in abstraction layer

---

## Missing Critical Features

**No Data Validation Layer:**
- Problem: No centralized validation of program data on load; invalid data silently causes rendering errors or silent data loss
- Blocks: Cannot safely implement import/export features; data corruption goes unnoticed; user gets confused when edits don't persist

**No Audit Trail / Change History:**
- Problem: No way to track who changed what when; cannot undo changes beyond browser history
- Blocks: Collaborative coaching features; debugging data corruption; compliance with training records

**No Offline Support:**
- Problem: App requires localStorage but no service worker or IndexedDB fallback; no conflict resolution if app loads in two tabs
- Blocks: Mobile use cases; cannot work on airplane mode; simultaneous editing causes data loss

**No Backup/Restore:**
- Problem: No export feature; if localStorage is cleared (browser reset, incognito exit), all programs are lost
- Blocks: Data migration; program sharing between coaches; disaster recovery

---

## Test Coverage Gaps

**Complex State Management:**
- What's not tested: Mesocycle/microcycle recalculation, parameter value propagation through hierarchy, method allocation consistency
- Files: `src/pages/MesocyclePage.tsx`, `src/hooks/useAthleteCalendarEditing.ts`, `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`
- Risk: Silent data corruption when structure changes; cascading failures when one level updates
- Priority: High - these are core to data integrity

**localStorage Synchronization:**
- What's not tested: Multi-tab sync behavior, race conditions between components writing same keys, localStorage quota exceeded
- Files: `src/hooks/useLocalStorage.ts` (has custom sync event but no test coverage), all persistence hooks
- Risk: Silent data loss when multiple tabs/windows are open; no warning when storage fails
- Priority: High - directly affects user data safety

**Date Shifting and Timezone Handling:**
- What's not tested: Date calculations across year boundaries, leap years, timezone edge cases (midnight UTC), daylight saving time transitions
- Files: `src/utils/dateShifting.ts`, assignment logic in `src/components/athletes/AssignProgramDialog.tsx`
- Risk: Off-by-one errors in date calculations; athletes see wrong training dates
- Priority: High - user-facing correctness

**Integration Between Wizard Steps:**
- What's not tested: Bidirectional synchronization when user goes back/forward; data consistency across Macrocycle → Mesocycle → Microcycle → Session steps
- Files: All pages (`MacrocyclePage`, `MesocyclePage`, `MicrocyclePlanningPage`)
- Risk: User's earlier decisions are overwritten; changes propagate incorrectly
- Priority: High - breaks core workflow

**Exercise Distribution Validation:**
- What's not tested: Frequency constraints (planned vs actual exercises per training day), orphaned exercises when methods change, supersetting consistency
- Files: `src/components/microcycle-planning/EnhancedExerciseDistribution.tsx`, `src/types/microcycle-planning.ts`
- Risk: Training plan invalid at runtime; exercises missing from calendar
- Priority: Medium - error recovery is possible but disruptive

---

*Concerns audit: 2026-03-15*
