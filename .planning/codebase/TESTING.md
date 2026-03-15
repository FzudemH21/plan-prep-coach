# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Status:**
- No testing framework currently configured
- No test files in `src/` directory (dependency test files exist in `node_modules/` only)
- No Jest, Vitest, Mocha, or other test runner configured

**Build/Run Commands:**
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run build:dev  # Build in development mode
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

**Note:** No test execution commands available in `package.json`

## Recommended Test Framework Setup

If tests are to be added:

**Runner Option:** Vitest (recommended for Vite projects)
- Config file: `vitest.config.ts`
- Fast execution with Vite integration
- Compatible with existing React + TypeScript setup

**Assertion Library:**
- Vitest includes built-in `expect()`
- Or: add `@testing-library/react` + `@testing-library/jest-dom` for component testing

**Proposed test commands:**
```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## Test File Organization

**Current State:**
- No test files in codebase
- Structure would be co-located alongside source (recommended):
  ```
  src/
    components/
      athletes/
        AssignProgramDialog.tsx
        AssignProgramDialog.test.tsx    ← paired with component
    hooks/
      useLocalStorage.ts
      useLocalStorage.test.ts            ← paired with hook
    utils/
      dateShifting.ts
      dateShifting.test.ts               ← paired with utility
  ```

**Naming Convention (if implemented):**
- `[Name].test.ts` for unit tests
- `[Name].test.tsx` for React component tests
- `[Name].spec.ts` alternative naming (not observed in existing code)

## Test Structure

**Recommended pattern based on codebase complexity:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useLocalStorage } from '@/hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Cleanup
    localStorage.clear();
  });

  it('should initialize with provided initial value', () => {
    const [value] = useLocalStorage('test-key', 'initial');
    expect(value).toBe('initial');
  });

  it('should persist values to localStorage', () => {
    const [, setValue] = useLocalStorage('test-key', '');
    setValue('new-value');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
  });
});
```

**Suite Organization:**
- One `describe()` block per module/component
- Multiple `it()` or `test()` blocks for scenarios
- Clear, descriptive test names explaining behavior
- Example: `"should persist values to localStorage"` not `"test 1"`

**Setup/Teardown Pattern:**
- `beforeEach()`: Reset state, clear mocks, clear localStorage
- `afterEach()`: Cleanup event listeners, unmount components
- `beforeAll()`: One-time setup (rarely needed)
- `afterAll()`: One-time cleanup (rarely needed)

## Mocking

**Areas Likely Needing Mocks (if tests added):**

1. **localStorage**: Critical for this codebase
   ```typescript
   import { vi } from 'vitest';

   const localStorageMock = (() => {
     let store: Record<string, string> = {};
     return {
       getItem: (key: string) => store[key] || null,
       setItem: (key: string, value: string) => { store[key] = value; },
       removeItem: (key: string) => { delete store[key]; },
       clear: () => { store = {}; },
     };
   })();

   Object.defineProperty(window, 'localStorage', { value: localStorageMock });
   ```

2. **Date/Time**: date-fns used heavily
   ```typescript
   vi.useFakeTimers();
   vi.setSystemTime(new Date('2026-03-15'));
   // ... test code
   vi.useRealTimers();
   ```

3. **Custom Events**: `useLocalStorage` uses cross-tab sync
   ```typescript
   const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
   // trigger sync
   expect(dispatchSpy).toHaveBeenCalledWith(
     expect.objectContaining({ type: 'useLocalStorage:sync' })
   );
   ```

4. **Component Props**: Mock heavy props for dialog/complex components
   ```typescript
   const mockProps = {
     open: true,
     onOpenChange: vi.fn(),
     programs: [],
     selectedDate: new Date(),
     onAssign: vi.fn(),
   };
   ```

**What NOT to Mock:**
- React hooks themselves (`useState`, `useEffect`) - test their behavior through component output
- Date utilities (date-fns functions) - they're stable, test against real dates
- Type/interface definitions - not runtime code
- Business logic calculations - these should be tested with real values

## Fixtures and Factories

**Test Data Patterns (if tests added):**

For complex types like `TrainingProgram`, create factory functions:

```typescript
// src/__tests__/fixtures/trainingProgramFactory.ts
export const createMockTrainingProgram = (overrides = {}): TrainingProgram => ({
  id: 'prog_1',
  name: 'Test Program',
  athleteId: 'athlete_1',
  athleteName: 'John Doe',
  primaryGoal: 'Improve Sprint Time',
  duration: {
    startDate: '2026-03-15',
    endDate: '2026-04-15',
    weeks: 4,
  },
  createdAt: '2026-03-15',
  lastModifiedAt: '2026-03-15',
  status: 'draft',
  macrocycleData: null,
  mesocycleData: null,
  trainingDays: null,
  ...overrides,
});

export const createMockAthlete = (overrides = {}): AthleteInfo => ({
  id: 'athlete_1',
  name: 'John Doe',
  age: 25,
  sex: 'male',
  sport: 'Track & Field',
  ...overrides,
});
```

**Location:**
- `src/__tests__/fixtures/` - centralized fixture directory
- Or co-located near tests: `src/hooks/__tests__/fixtures.ts`

## Coverage

**Current Status:** No coverage measurement in place

**Recommended Target (if tests added):**
- Functions: 80%+ (critical path)
- Components: 60%+ (UI testing is expensive)
- Utilities: 90%+
- Hooks: 85%+

**View Coverage (once configured):**
```bash
npm run test:coverage
```

**Coverage config (vitest.config.ts):**
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/components/ui/**', 'src/types/**'],
    },
  },
});
```

## Test Types

### Unit Tests (Recommended to start)

**Scope:** Individual functions, hooks, utilities

**Examples to write first:**
- `useLocalStorage` hook: Test localStorage persistence, cross-tab sync, initialization
- `dateShifting` utility: Test date calculation with different inputs
- Type guards and validators: `Zod` schemas in `types/`

```typescript
describe('useLocalStorage', () => {
  it('should sync state across multiple hook instances', () => {
    // Multiple calls to useLocalStorage(same-key) should stay in sync
  });

  it('should handle corrupt JSON gracefully', () => {
    localStorage.setItem('key', 'invalid-json');
    const [value] = useLocalStorage('key', 'fallback');
    expect(value).toBe('fallback');
  });
});
```

### Integration Tests (Medium complexity)

**Scope:** Multiple components/hooks working together

**Examples to consider:**
- `AssignProgramDialog` + localStorage: Dialog saves/loads state
- `useTrainingPrograms` + `useLocalStorage`: Programs persist and reload
- Context providers + hooks: `DisplayModeContext` properly provides to nested hooks

```typescript
describe('AssignProgramDialog integration', () => {
  it('should save selected program to context when assigned', () => {
    // Render dialog, select program, click assign
    // Verify program appears in parent component state
  });
});
```

### Component Tests (React Testing Library pattern)

**Scope:** DOM rendering, user interactions

**Examples to write:**
- Dialog open/close behavior
- Form submission and validation
- List rendering (meso/microcycle selection)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignProgramDialog } from '@/components/athletes/AssignProgramDialog';

describe('AssignProgramDialog', () => {
  it('should render program list when opened', () => {
    render(<AssignProgramDialog open={true} programs={[mockProgram]} ... />);
    expect(screen.getByText(mockProgram.name)).toBeInTheDocument();
  });

  it('should call onAssign with correct data when submitted', async () => {
    const onAssign = vi.fn();
    render(<AssignProgramDialog onAssign={onAssign} ... />);

    fireEvent.click(screen.getByText('Assign Program'));
    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({
      programId: expect.any(String),
    }));
  });
});
```

### E2E Tests (Not currently configured)

**Status:** Not used in this codebase

**If needed in future:**
- Tool: Playwright or Cypress
- Scope: Full user workflows (create plan → assign to athlete)
- Config: `playwright.config.ts` or `cypress.config.ts`

## Common Patterns

### Async Testing

Since codebase uses `useEffect` heavily, async testing pattern is important:

```typescript
import { renderHook, waitFor } from '@testing-library/react';

describe('useTrainingPrograms', () => {
  it('should load programs from localStorage', async () => {
    localStorage.setItem('trainingPrograms', JSON.stringify({
      version: 1,
      programs: [mockProgram],
    }));

    const { result } = renderHook(() => useTrainingPrograms());

    await waitFor(() => {
      expect(result.current.programs).toHaveLength(1);
    });
  });
});
```

### Error Testing

```typescript
describe('useLocalStorage error handling', () => {
  it('should fallback to initial value when localStorage is corrupted', () => {
    localStorage.setItem('key', 'not-json');
    const [value] = useLocalStorage('key', 'fallback');
    expect(value).toBe('fallback');
  });

  it('should handle missing localStorage gracefully', () => {
    const { getItem } = localStorage;
    localStorage.getItem = vi.fn(() => { throw new Error('Storage full'); });

    const [value] = useLocalStorage('key', 'fallback');
    expect(value).toBe('fallback');

    localStorage.getItem = getItem;
  });
});
```

### Custom Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react';

describe('useLocalStorage hook', () => {
  it('should update value and persist to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'initial'));
    const [, setValue] = result.current;

    act(() => {
      setValue('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(localStorage.getItem('key')).toBe(JSON.stringify('updated'));
  });
});
```

## Critical Areas Needing Tests (Priority Order)

1. **useLocalStorage hook** (`src/hooks/useLocalStorage.ts`)
   - Complex cross-tab sync logic
   - Multiple listeners and custom events
   - Data persistence edge cases

2. **useTrainingPrograms hook** (`src/hooks/useTrainingPrograms.ts`)
   - Complex data management
   - CRUD operations for programs
   - Versioning logic

3. **Date shifting utilities** (`src/utils/dateShifting.ts`)
   - Mathematical correctness critical for training plans
   - Edge cases (leap years, timezone handling)

4. **AssignProgramDialog** (`src/components/athletes/AssignProgramDialog.tsx`)
   - Complex UI with multiple steps
   - User interactions (selection, date changes)
   - Data validation and transformation

5. **Mesocycle/Microcycle date calculations** (`src/utils/dateCalculations.ts`)
   - Core business logic for plan timing
   - Consistency across app

---

*Testing analysis: 2026-03-15*

**Note:** No testing framework is currently installed. To implement tests, start by:
1. Installing Vitest: `npm install -D vitest @vitest/ui`
2. Installing React Testing Library: `npm install -D @testing-library/react @testing-library/jest-dom`
3. Creating `vitest.config.ts` configuration
4. Writing tests for critical utilities first, then components
5. Adding test script to `package.json`
