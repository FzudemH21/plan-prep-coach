# Code Audit – Plan Prep Coach
_Generated: 2026-05-12_

## Summary
The codebase is well-structured overall and the Supabase migration pattern (`useSupabaseStore`) is clean. The single most impactful issue is that `ExerciseDistribution` (and related types) are re-declared as local `interface`s in **11 separate files** rather than imported from the canonical types file — meaning type drift goes undetected and circuit/parameter fields are silently missing in many components. Beyond that, `MicrocyclePlanningPage` has grown to >3,300 lines with 40+ scattered `localStorage.setItem` calls that need centralising before adding RAG state. Several `any` types undermine TypeScript's value at the most critical data boundaries. The AI layer is well-designed and RAG context will slot in cleanly with a single parameter addition.

---

## Priority Issues (fix before RAG implementation)

| # | File | Issue | Severity | Effort |
|---|------|-------|----------|--------|
| 1 | 11 component files | `ExerciseDistribution` re-declared locally instead of imported | 🔴 High | M |
| 2 | `MicrocyclePlanningPage.tsx` | 40+ scattered `localStorage.setItem` calls, no central write util | 🔴 High | L |
| 3 | `features/planner/types.ts:26` | `trainingMethods: any[]` on the core `ExtendedMesocycle` type | 🔴 High | M |
| 4 | `utils/anthropicApi.ts:27` | Default model is `claude-opus-4-6` — accidental callers pay 60× premium | 🟡 Medium | S |
| 5 | `useSupabaseStore.ts:44-66` | SELECT + UPDATE/INSERT pattern has a race condition; use `.upsert()` | 🟡 Medium | S |
| 6 | `EnhancedExerciseDistribution.tsx` | Only 5 `useCallback`/`useMemo` for a large stateful component | 🟡 Medium | M |
| 7 | Wizard pages (3 files) | 27 `console.log/warn/error` calls left in production code | 🟢 Low | S |

---

## TypeScript

### 🔴 `trainingMethods: any[]` — `src/features/planner/types.ts:26`
`ExtendedMesocycle.trainingMethods` is typed as `any[]`. This is the central data structure flowing through MacrocyclePage → MesocyclePage → MicrocyclePlanningPage. Fixing this would catch bugs at the boundary where methods are filtered, allocated, and assigned to exercises.

**Suggested type:**
```ts
export interface TrainingMethod {
  id: string;
  name: string;
  category?: string;
  parentCategory?: string;
}
// Then:
trainingMethods: TrainingMethod[];
```

### 🟡 Other `any` occurrences worth fixing

| File | Line | Context |
|------|------|---------|
| `MicrocycleIntensityChart.tsx` | 48, 115, 255 | Recharts `data` and `payload` — replace with typed chart data interfaces |
| `MesocycleCalendar.tsx` | 92, 95 | `getMicrocycleForDate` — parameter typed as `any`, should be `ExtendedMesocycle` |
| `utils/dateShifting.ts` | 195, 198 | `trainingDays: any[]` — replace with `TrainingDay[]` from `@/types/daily-intensity` |
| `pages/LibraryPage.tsx` | 19 | `findLibraryBySlug(libraries: any[])` — replace with `CustomLibrary[]` |
| `pages/MacrocyclePage.tsx` | 265, 815–816 | Smart goals parse + inline interaction/method interfaces — extract named types |
| `utils/seedData.ts` | 1752, 1769, 1793 | Internal migration — acceptable but add a type guard |

### 🟢 Acceptable `any` (leave as-is)
- `(el as any).indeterminate` in column filters — DOM workaround, no typed alternative
- Recharts `payload` in tooltip callbacks — library limitation

---

## Component Size & Complexity

| File | Est. Lines | Status |
|------|-----------|--------|
| `MicrocyclePlanningPage.tsx` | ~3,350 | 🔴 Too large — split urgently |
| `WorkoutSessionSheet.tsx` | ~900 | 🟡 Large but coherent |
| `EnhancedExerciseDistribution.tsx` | ~900 | 🟡 Large but coherent |
| `MacrocyclePage.tsx` | ~850 | 🟡 Acceptable |
| `SessionColumnView.tsx` | ~500 | 🟢 OK |
| `CircuitBuilderDialog.tsx` | ~520 | 🟢 OK |

### `MicrocyclePlanningPage.tsx` — recommended extractions

| Logic block | Suggested hook/util |
|-------------|---------------------|
| `localStorage` reads on mount (lines ~150–300) | `useWizardStorage()` — centralises all keys |
| Frequency warning calculation | `useFrequencyWarnings(trainingDays, periodizationData)` |
| Session copy/paste logic (~2100–2260) | `useSessionCopyPaste()` |
| Day intensity change + propagation (~1350–1460) | `useDayIntensity()` |
| Parameter value management (~1680–1710) | Already in a handler; extract to `useParameterValues()` |
| `handleAddSession` / `handleRemoveSession` | `useSessionManagement()` |

These extractions would bring the page down to ~1,500 lines and make each piece independently testable.

---

## State Management

### 🔴 `ExerciseDistribution` declared in 11 files (most critical issue)

The canonical definition lives in `src/types/microcycle-planning.ts` (lines 88–106) and includes these fields that **local copies are missing**:
- `eachSide?: boolean`
- `autoCalculateWeight?: boolean`
- `autoCalculateTargetHR?: boolean`
- `parameterSource?: 'toolbox' | 'periodization'`

Files with local re-declarations (none import from the types file):
```
DayExercisesDialog.tsx          ← missing 4 fields
EnhancedExerciseDistribution.tsx ← missing 4 fields (has circuit fields added locally)
ExerciseLibraryPanel.tsx        ← missing 4 fields
MasterPlannerColumn.tsx         ← missing 4 fields
MasterPlannerGrid.tsx           ← missing 4 fields
SessionColumnView.tsx           ← missing 4 fields
TrainingCalendarView.tsx        ← missing 4 fields
TrainingDayCell.tsx             ← missing 4 fields
WeekRow.tsx                     ← missing 4 fields
WorkoutSessionSheet.tsx         ← missing 4 fields
```
`EnhancedExerciseDistribution.tsx` also re-declares `SessionSection` and `SupersetMapping` locally — both already exported from the types file.

**Fix:** In each of these files, delete the local `interface ExerciseDistribution` and add:
```ts
import { ExerciseDistribution } from '@/types/microcycle-planning';
```
The circuit fields (`isCircuit`, `circuitId`, etc.) should also be added to the canonical type in `microcycle-planning.ts` since they are now part of the data model.

### 🟡 `MicrocyclePlanningPage` localStorage access pattern
40+ `localStorage.setItem` calls are spread throughout the page with no central utility. Some keys are written in 3+ different handlers:
- `dailyIntensityData` — written at lines ~1165, ~1443, ~2431
- `trainingDays` — written at lines ~615, ~2452, ~2543, ~2652, ~2740
- `macrocycleData` — written at lines ~2707, ~2775, ~2794, ~2828, ~3267

**Recommended pattern:**
```ts
// src/utils/wizardStorage.ts
export const WIZARD_KEYS = {
  exerciseDistribution: 'exerciseDistribution',
  daySplitStates: 'daySplitStates',
  trainingDays: 'trainingDays',
  dailyIntensityData: 'dailyIntensityData',
  sessionSections: 'sessionSections',
  supersets: 'supersets',
  macrocycleData: 'macrocycleData',
  // ...
} as const;

export function saveWizardKey<T>(key: keyof typeof WIZARD_KEYS, value: T): void {
  localStorage.setItem(WIZARD_KEYS[key], JSON.stringify(value));
}
```
This is also the hook point for adding RAG-related state later.

### 🟢 `useSupabaseStore` — design is solid
The cache-first, Supabase-as-source-of-truth pattern with optimistic saves is correct. Minor issue: `upsertRow` does `SELECT` then `UPDATE`/`INSERT` (two round trips, race window). Replace with:
```ts
const { error } = await supabase
  .from(tableName)
  .upsert({ user_id: userId, data, updated_at: now }, { onConflict: 'user_id' });
```

### 🟢 Wizard state split (intentional, but document it)
Per `CLAUDE.md`, wizard working state (`exerciseDistribution`, `trainingDays`, etc.) intentionally stays in `localStorage` as ephemeral state. This is fine. The key risk is that these keys are not namespaced by plan ID — if a coach has two plans in progress, data would collide. Not urgent but worth noting for future multi-plan support.

---

## Data Flow

### Prop drilling depth
The main data path is:
```
MicrocyclePlanningPage
  → EnhancedExerciseDistribution  (exerciseDistribution, sessionSections, supersets, daySplitStates, onDistributionChange, onSessionSectionsChange, onSupersetsChange, ...)
    → SessionColumnView             (subset of above + onEditCircuit)
      → WorkoutSessionSheet         (further subset + onDistributionChange)
```
`onDistributionChange` is passed 3 levels deep. This is the main candidate for a context. A `WizardSessionContext` (or extending the existing `WorkoutSessionContext`) would eliminate the drilling.

### `WorkoutSessionContext.tsx` — exists but underused
`src/components/microcycle-planning/WorkoutSessionContext.tsx` already exists. Check if it can absorb `exerciseDistribution` + `sessionSections` + `supersets` so these don't need to be drilled.

### Callback stability in `EnhancedExerciseDistribution`
Only 5 `useCallback`/`useMemo` hooks in a ~900-line component that passes many callbacks down to `SessionColumnView` and further to `WorkoutExerciseCard`. Each render creates new function references, causing child re-renders. Priority targets for `useCallback`: `handleExerciseAdd`, `handleExerciseRemove`, `handleExerciseMove`, `handleDrop`.

---

## Dead Code

| File | Item | Confidence |
|------|------|------------|
| `src/components/athleticism/index.ts` | Exports from a removed "Athleticism DB v1" | High |
| `src/pages/AthleticismDatabaseV2.tsx` | If DB v1 was removed, check if v2 is still routed | Medium |
| `MacrocyclePage.tsx` (27 console calls) | Debug logs not useful in production | High |
| `MicrocyclePlanningPage.tsx` (5 console calls) | Same | High |
| `MesocyclePage.tsx` (9 console calls) | Same | High |

---

## AI / RAG Readiness

### Current architecture (clean)
`WizardAIAssistant` already has a well-structured `buildSystemPrompt`:
```
[coach profile]
[coach memory — past plans]
[current wizard state]
[apply format instructions]
```

### Where RAG chunks slot in
Add a `ragContext?: string` prop to `WizardAIAssistantProps` and inject it into `buildSystemPrompt`:
```ts
function buildSystemPrompt(coachContext, wizardContext, canApply, coachMemoryContext?, ragContext?): string {
  const ragBlock = ragContext
    ? `\n\n## Relevant Research & References\n${ragContext}`
    : "";
  return `...${memoryBlock}${ragBlock}\n\n## Current Wizard State\n${wizardContext}...`;
}
```
The RAG block sits between coach memory and wizard state so the AI prioritises current context over retrieved docs.

### `anthropicApi.ts` — default model risk 🟡
```ts
export async function sendMessage(
  messages: Message[],
  systemPrompt: string,
  model = "claude-opus-4-6"   // ← EXPENSIVE default
```
`WizardAIAssistant` explicitly passes `"claude-haiku-4-5"` so it's fine, but any future caller that omits the model will hit Opus (~60× the cost of Haiku). Change the default to `"claude-haiku-4-5"` and require callers to opt up explicitly.

### `sendMessageWithFile` — already RAG-adjacent
`anthropicApi.ts` already has `sendMessageWithFile` with base64 document support. For RAG, you won't need this (chunks come from the DB, not raw files), but it's useful for the "Semantic Extraction from Uploaded Documents" feature that feeds the initial embedding pipeline.

### No streaming yet
Both `sendMessage` and `sendMessageWithFile` use non-streaming fetch. For RAG responses (potentially longer with citations), streaming would significantly improve perceived responsiveness. The Anthropic API supports `stream: true` — worth adding a `sendMessageStream` variant before RAG goes live.

---

## Supabase

### ✅ Pattern is consistent
All persistent stores use `useSupabaseStore` or a custom hook built on the same pattern (`useCoachProfile`, `useTrainingPrograms`, `useToolboxData`, etc.). RLS is enabled. Error handling exists in all Supabase hooks.

### 🟡 `upsertRow` double-query (minor)
As noted above — replace with native `.upsert({ onConflict: 'user_id' })`.

### 🟡 No pgvector table yet
For RAG you'll need a new table and the `vector` extension enabled. Suggested schema:
```sql
-- Enable extension
create extension if not exists vector;

-- Document chunks table
create table document_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  document_id text not null,        -- Supabase Storage object key
  chunk_index int  not null,
  content     text not null,
  embedding   vector(1536),         -- OpenAI ada-002 or Anthropic dimensions
  metadata    jsonb,
  created_at  timestamptz default now()
);

create index on document_chunks using ivfflat (embedding vector_cosine_ops);
```

### 🟢 Storage bucket already in place
`documents` bucket exists. The upload pipeline in `DocumentsSection` is complete. The RAG embedding step can hook in after upload with minimal changes.

---

## Performance

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Callbacks not memoised | `EnhancedExerciseDistribution` | Medium — child re-renders | Wrap in `useCallback` |
| `MicrocyclePlanningPage` 10 `useEffect`s | Multiple state syncs | Low-Medium | Consolidate related effects |
| `buildSystemPrompt` rebuilds on every render | `WizardAIAssistant:79` | Low (string concat) | `useMemo` with deps on profile/wizardContext |
| No streaming on AI responses | `anthropicApi.ts` | UX — perceived latency | Add `sendMessageStream` |

---

## Recommended Fix Order

1. **Import `ExerciseDistribution` from types file in all 11 components** (🔴 M) — highest leverage, catches silent bugs immediately, unblocks clean circuit-field additions for RAG metadata
2. **Add circuit fields to canonical `ExerciseDistribution` type** (🔴 S) — must happen alongside #1
3. **Fix `anthropicApi.ts` default model** (🟡 S) — 2-line change, prevents accidental Opus billing
4. **Fix `upsertRow` → native `.upsert()`** (🟡 S) — 5-line change, safer Supabase pattern
5. **Type `ExtendedMesocycle.trainingMethods`** (🔴 M) — enables catching method-related bugs before RAG adds more method-aware logic
6. **Extract `useWizardStorage` util** (🟡 M) — needed before RAG adds more keys to the wizard state namespace
7. **Add `useCallback` to hot paths in `EnhancedExerciseDistribution`** (🟡 M) — prevents cascading re-renders during exercise drag operations
8. **Remove `console.log` calls from production pages** (🟢 S) — clean before shipping RAG
9. **Extract logic hooks from `MicrocyclePlanningPage`** (🟡 L) — do incrementally, start with `useSessionCopyPaste` and `useDayIntensity`
10. **Add `ragContext` prop to `WizardAIAssistant`** (🟡 S) — wire point for RAG, then implement the pgvector pipeline

Items 1–4 are quick wins (< 2 h total) and should be done before writing any RAG code.
