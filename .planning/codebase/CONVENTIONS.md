# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- React components (TSX): PascalCase with `.tsx` extension
  - Example: `AssignProgramDialog.tsx`, `MesocycleCalendar.tsx`
- Custom hooks: camelCase with `use` prefix and `.ts` extension
  - Example: `useLocalStorage.ts`, `useTrainingPrograms.ts`, `useAthletes.ts`
- Utilities: camelCase with `.ts` extension
  - Example: `dateCalculations.ts`, `dateShifting.ts`, `clearCache.ts`
- Type definition files: camelCase with `.ts` extension
  - Example: `training.ts`, `athlete.ts`, `exercises.ts`
- Context providers: PascalCase with `Context.tsx` suffix
  - Example: `DisplayModeContext.tsx`, `CustomLibrariesContext.tsx`

**Functions:**
- Regular functions: camelCase
  - Example: `toggleMesocycle()`, `calculateMesocycleDates()`, `handleAssign()`
- React component functions: PascalCase
  - Example: `AssignProgramDialog()`, `MesocycleCalendar()`
- Hook functions: camelCase with `use` prefix
  - Example: `useLocalStorage()`, `useTrainingPrograms()`
- Event handlers: camelCase with `handle` prefix
  - Example: `handleAssign()`, `handleSamePageSync()`, `handleCrossTabSync()`
- Toggle/state setters: camelCase with `toggle` prefix or direct `set` naming
  - Example: `toggleMesocycle()`, `toggleMicrocycle()`, `toggleExpanded()`

**Variables:**
- Component state: camelCase
  - Example: `selectedProgramId`, `startDate`, `expandedMesocycles`
- Boolean variables: camelCase (often prefixed with `is`, `has`, `should`, `can`)
  - Example: `isExpanded`, `isMesoSelected`, `hasExercises`, `shouldValidate`
- Constants: UPPER_SNAKE_CASE
  - Example: `SAME_PAGE_SYNC_EVENT = "useLocalStorage:sync"`, `STORAGE_KEY = 'trainingPrograms'`, `CURRENT_VERSION = 1`
- ID strings: lowercase snake_case with prefix
  - Example: `prog_${Date.now()}_${random}`, `meso-${index}`, `micro-${index}-${mIndex}`

**Types:**
- Interface names: PascalCase with `Interface` suffix or standalone descriptive noun
  - Example: `AthleteInfo`, `SmartGoal`, `TrainingProgram`, `AssignProgramDialogProps`
- Type names: PascalCase
  - Example: `DisplayMode`, `IntensityLevel`, `TrainableQuality`
- Union types: lowercase with hyphens or pipes
  - Example: `"step-by-step" | "macro" | "meso" | "micro"`, `"off" | "deload" | "easy" | "moderate"`
- Enums: Not used; prefer union types for type safety

## Code Style

**Formatting:**
- No explicit Prettier config file present; ESLint used for code quality
- Indentation: 2 spaces (inferred from codebase)
- Line length: No strict limit enforced

**Linting:**
- Tool: ESLint 9.32.0 with TypeScript support
- Config file: `eslint.config.js` (flat config format)
- Extended configs: `@eslint/js` recommended + `typescript-eslint` recommended
- Key enabled rules:
  - React hooks rules: `eslint-plugin-react-hooks` recommended rules
  - React refresh: `react-refresh/only-export-components` (warn level)
  - Unused imports: disabled (`@typescript-eslint/no-unused-vars: off`)
  - No explicit strict TypeScript checks enforced

**TypeScript Configuration:**
- Target: ES2020
- Module: ESNext with bundler module resolution
- JSX: react-jsx (automatic runtime)
- Strict mode: **disabled** (`"strict": false`)
- Notable disabled checks:
  - `noImplicitAny: false` - implicit any types allowed
  - `noUnusedLocals: false` - unused local variables permitted
  - `noUnusedParameters: false` - unused function parameters permitted
  - `noFallthroughCasesInSwitch: false` - fallthrough cases permitted
- Path aliases configured: `@/*` → `./src/*`

## Import Organization

**Order:**
1. React imports (React, React hooks)
2. Third-party library imports (date-fns, lucide-react, shadcn-ui components)
3. Application layer imports (hooks, contexts, utilities)
4. Type imports (types, interfaces)
5. Component imports (UI components, feature components)

**Example from actual code:**
```typescript
import { useState, useMemo, useEffect } from 'react';
import { format, differenceInDays, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TrainingProgram } from '@/hooks/useTrainingPrograms';
import { AthleteCalendarAssignment } from '@/types/athlete';
import { recalculateMesocycleDates } from '@/utils/dateShifting';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
```

**Path Aliases:**
- `@/*` resolves to `./src/*` - use this for all internal imports
- No relative path imports (../, ./) in the codebase
- Absolute imports with `@/` alias preferred throughout

## Error Handling

**Patterns:**
- Try-catch blocks used with empty catch clauses for graceful degradation
  ```typescript
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : initialValue;
  } catch {
    return initialValue;
  }
  ```

- Error logging with `console.error()` for development/debugging:
  ```typescript
  console.error('Error loading training programs:', error);
  ```

- User-facing errors via toast notifications:
  ```typescript
  toast({
    title: "Date mismatch warning",
    description: "...",
    variant: "destructive",
  });
  ```

- Optional error description in catch blocks (newer pattern):
  ```typescript
  try {
    // operation
  } catch (e) {
    // handle error
  }
  ```

- No custom error classes; native Error object used
- Guard clauses for null/undefined checks preferred:
  ```typescript
  if (!selectedProgram?.mesocycleData) return [];
  ```

## Logging

**Framework:** Native `console` object

**Patterns:**
- DEBUG logs with `console.log('DEBUG: ...')` prefix for development
  - Example: `console.log('DEBUG: Loaded macrocycle data:', data);`
- Error logs with `console.error()` for failures
- No production logging system visible (localStorage-based architecture)

**When to Log:**
- Data loading/parsing operations
- State synchronization between hooks and localStorage
- Complex calculations with date shifting
- Error conditions for debugging

**Where NOT to log:**
- Every state change (too verbose)
- Component renders (handled by React DevTools)
- Trivial operations

## Comments

**When to Comment:**
- Complex synchronization logic (e.g., `useLocalStorage` cross-tab sync)
- Non-obvious algorithm implementations
- Explain the "why", not the "what"
- Document known limitations or workarounds

**JSDoc/TSDoc:**
- Used sparingly for public functions and complex types
- Interface properties documented with single-line comments or inline descriptors
- Function parameters documented in interface props
- Example from code:
  ```typescript
  /**
   * Custom event name used to synchronize multiple useLocalStorage instances
   * that share the same key within the same page/tab.
   *
   * Problem this solves:
   *   Multiple React components can call useLocalStorage with the same key.
   *   [detailed explanation of issue and solution]
   */
  const SAME_PAGE_SYNC_EVENT = "useLocalStorage:sync";
  ```

- Deprecated fields marked with `@deprecated` comment:
  ```typescript
  /** @deprecated Use biometricDefinitions instead */
  ```

**Inline Comments:**
- Minimal use; code should be self-documenting
- Used for non-obvious logic or warnings
- Example: `// Handle both formats: direct array or { mesocycles: [...] } object`

## Function Design

**Size:**
- Most functions 20-50 lines
- Dialog components and complex features can extend to 200-300+ lines (e.g., `AssignProgramDialog.tsx` is 762 lines)
- Complex calculations broken into helper functions when possible
- No strict size limit enforced; prefer readability and cohesion

**Parameters:**
- Props interface pattern for React components with multiple parameters
- Maximum 5-7 parameters for non-component functions (use objects for more)
- Example:
  ```typescript
  interface AssignProgramDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    programs: TrainingProgram[];
    selectedDate: Date;
    onAssign: (assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>) => void;
  }
  ```

**Return Values:**
- Explicit return types for all functions
- Component functions return JSX.Element
- Hooks return destructured tuples (React pattern) or objects
- Example: `return [storedValue, setStoredValue] as const;`
- Utility functions return typed objects or primitives

## Module Design

**Exports:**
- Named exports for functions, types, interfaces
- Default exports for React components when it's a single primary export
- Index files used for barrel exports in component directories
  - Example: `src/components/athletes/index.ts` exports multiple components
- Example:
  ```typescript
  export function useLocalStorage<T>(key: string, initialValue: T) { ... }
  export default App;
  ```

**Barrel Files:**
- Used in component directories to simplify imports
- Pattern: `src/components/[feature]/index.ts` re-exports all components from that feature
- Example files: `src/components/athletes/index.ts`, `src/components/macrocycle/index.ts`

**File Coupling:**
- Custom hooks are isolated in `src/hooks/`
- UI components from shadcn-ui in `src/components/ui/`
- Feature components grouped by domain (athletes, mesocycle, microcycle-planning)
- Type definitions centralized in `src/types/`
- Utility functions in `src/utils/`

---

*Convention analysis: 2026-03-15*
