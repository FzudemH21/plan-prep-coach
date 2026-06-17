# CLAUDE.md – Plan Prep Coach

## Project Overview
**Plan Prep Coach** is a web app for coaches, athletes, and sports scientists that streamlines the entire training planning process from the ground up. It replaces complex Excel workflows and manual data entry into external tools (e.g. Everfit, TrainHeroic) with a guided, intelligent wizard.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, shadcn-ui, Supabase
**GitHub:** https://github.com/FzudemH21/plan-prep-coach
**Dev Server:** `npm run dev` → localhost:8080 (PowerShell, path: `C:\Users\Hanik\plan-prep-coach`)

> **Critical — Worktree awareness:** Claude Code works in a git worktree under `.claude/worktrees/<branch>/`. Changes are ONLY visible in the browser if the dev server runs from that worktree directory, NOT from the main project root. Always confirm with the user which directory their dev server is running from before declaring a fix complete. If they're on the main dev server, changes won't appear until the branch is merged to `main`.

---

## Prompt Discipline (Critical!)
**Every Claude Code prompt must begin with:**
> Before making any changes, read both `CLAUDE.md` and `FEATURES.md` in the project root.

No prompt without this line. CLAUDE.md and FEATURES.md are the single source of truth.

---

## Core Philosophy
- Training planning is a chain of dependent decisions — the wizard guides the coach step by step through this chain
- Data is **entered once** and flows automatically through all levels (no double entry)
- The coach should focus on **thinking, not clicking**
- Every wizard step has an **AI chat** for discussion and advice

---

## Infrastructure

### Anthropic API
- SDK installed: `@anthropic-ai/sdk`
- Client wrapper: `src/lib/anthropic.ts`
- Key stored in `.env` as `VITE_ANTHROPIC_API_KEY` (never commit)
- `dangerouslyAllowBrowser: true` is set — acceptable for local coach tool, must be replaced with a backend proxy for SaaS
- Model in use: `claude-sonnet-4-5` with `max_tokens: 8192`

### Supabase
- SDK installed: `@supabase/supabase-js`
- Client wrapper: `src/lib/supabase.ts`
- Keys in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Cloud Storage: `src/lib/storage.ts` with `uploadFile`, `downloadFile`, `deleteFile`, `getPublicUrl`
- Storage bucket: `documents` (public: off) — for coach documents, training plans, literature
- RLS (Row Level Security) is enabled

---

## Training Plan Hierarchy
```
Macrocycle
  └── Mesocycle(s)
        └── Microcycle(s)  (any duration in days, variable within a mesocycle)
              └── Training Day(s)
                    └── Session(s)
                          └── Sections (Warm-up, Main, Cooldown)
                                └── Exercises (with Sets, Reps, Intensity etc.)
```

---

## Intensity Scale

**Current: Borg CR10 (0–10, 11 levels) — migration complete.**

The old 8-level string scale (`off` → `extremely-hard`) has been fully replaced. `IntensityLevel` is now aliased to `BorgLevel = "0" | "1" | ... | "10"` (string numerics). Single source of truth: `src/utils/intensityScale.ts`. Do not introduce any new code using the old string labels.

| Value | Display |
|-------|---------|
| `"0"` | 0 – Rest |
| `"1"` | 1 – Very, Very Easy |
| `"2"` | 2 – Easy |
| `"3"` | 3 – Moderate |
| `"4"` | 4 – Somewhat Hard |
| `"5"` | 5 – Hard |
| `"6"` | 6 – Hard+ |
| `"7"` | 7 – Very Hard |
| `"8"` | 8 – Very Hard+ |
| `"9"` | 9 – Extremely Hard |
| `"10"` | 10 – Maximal |

Applied at: mesocycle level, microcycle level, daily level, and session level. Used identically by coach (planned) and athlete (self-reported) — enabling direct planned vs. actual comparison. Legacy values in storage are auto-migrated via `migrateLegacyIntensity()` in `intensityScale.ts`.

---

## Databases (Coach-configurable)
1. **Athlete Database** – Profiles with demographic data, performance parameter values (tracked over time), assigned plans, personal calendar
2. **Parameter Database** – Performance parameters (e.g. Squat 1RM, Sprint 30m, VO2max) with categories, units, inter-parameter dependencies (positive/negative correlations), and research citations. Parameters are linked to training methods.
3. **Training Methods Database (Toolbox)** – Methods organized as `Category → SubCategory` (e.g. "Lower Body Resistance Training → Strength"). Each method has configurable parameters: Frequency, Sets, Reps, Intensity, rest durations, and qualitative fields (e.g. Organization, Contrast). Methods can be **split by exercise category** — internally stored as `"Method::Category"` (e.g. `"Lower Body Resistance Training - Strength::Squat"`).
4. **Exercise Database** – Exercises with video, description, category (e.g. "Lower Body Resistance Strength"), parameters. Bulk import via CSV/Excel (3-step flow). Dynamic detail modal (columns from database, no hardcoded fields, directly editable). Drag & drop column reordering.

---

## Implemented Features (Current State)

### Coach Profile
- Onboarding flow with AI conversation, skip option, voice input
- Documents: local storage, folder structure, drag & drop, upload
- Resources panel (persistent, available in onboarding and wizard)

### AI Assistant
- Available on every page and wizard step (`WizardAIAssistant` component)
- Powered by `claude-sonnet-4-5`
- Receives full wizard context (current step, athlete, plan state, toolbox, parameter database)
- Can apply structured actions directly into the wizard via `[[APPLY: {...}]]` blocks
- Available actions per phase — see Wizard Flow section below

### Athlete Calendar & Masterplanner
- Athlete calendar with copy/paste, clear day/week, session name sync
- Tests & events in calendar, synced with wizard via unified `calendarEvents` storage
- Masterplanner view with week-horizon selector
- Consistent color/icon scheme for tests and events across all views

### Microcycle Planning
- Method Distribution: drag & drop, methods filtered to current mesocycle's characterization selections, multiple methods per session allowed, full-name card display
- Exercise Distribution: hybrid drag & drop + inline "+", bidirectional sync
- Microcycle-specific frequency indicator with overage warnings
- Copy behavior skips unavailable methods with warnings

### Programming Templates
- Templates per method in Training Toolbox
- Load Template dialog in Wizard Step 4 with preview, editable before loading
- Save as new template, units displayed, works across mesocycles

### Plan Assignment
- Multi-step Assign Program dialog with mesocycle/microcycle filtering
- Plan-state tests/events only flow into `calendarEvents` upon plan assignment to an athlete

### Exercise Database
- Bulk import (multi-step flow), dynamic exercise detail modal
- Drag & drop column reordering

### Seed Data
- Seed data system via `src/utils/seedData.ts`

---

## Wizard – Full Flow

### Phase 1: Plan Setup (MacrocyclePage)
**Step 1:** Select athlete → values auto-loaded, plan name, date range, SMART goals (linked to parameters)
- AI actions: `set_plan_name`, `set_plan_duration`, `add_goal`, `schedule_tests`, `create_event`

**Step 2:** Sub-goals, test dates, events
- AI actions: `add_goal` (adds sub-goal), `schedule_tests`, `create_event`

**Step 3:** Select training methods (goal-linked methods are auto-suggested; additional methods can be added with a rationale)
- AI actions: `add_methods` (each with optional rationale)

### Phase 2: Mesocycle Planning (MesocyclePage)
**Step 1:** Configure mesocycle/microcycle structure
- Microcycles within a mesocycle **can have different durations** (e.g. 7+7+7+5 days)
- AI actions: `set_mesocycle_config` (uniform), `configure_mesocycles` (full control: variable durations, add/remove mesocycles or microcycles)

**Step 2:** Daily intensity planning (loading wave per microcycle)
- AI actions: `set_microcycle_intensities`

**Step 3:** Allocate methods to specific mesocycles (not all methods need to be active in every mesocycle)
- AI actions: `allocate_methods`

**Step 4:** Periodization Table ⭐ (core component) — frequency, sets, reps, intensity + all method-specific parameters per method & microcycle; values flow automatically through all levels down to the final training calendar
- AI actions: `set_periodization` (with `extraParams` for qualitative/additional parameters)

**Step 5:** Exercise selection per mesocycle & method
- AI actions: `assign_exercises`

### Phase 3: Microcycle Planning (MicrocyclePlanningPage)
**Step 1:** Assign methods to training days (drag & drop calendar view)
- AI actions: `assign_methods_to_days`

**Step 2:** Build session architecture (sections, supersets, drag & drop, copy sessions)

**Automatic data flow:**
- Parameter values from Periodization Table appear automatically on exercises
- Sets as rows, parameters as columns
- Displayed parameters configurable (in parameter database)

### Final Output & Plan Assignment
- **Training calendar** fully populated with all sessions & parameters
- **Assignment to athlete profile:**
  - A finished plan can be assigned to any athlete
  - Assignment is **date-independent** — a plan created on May 1st can be assigned starting April 24th 2027; start date is reset at assignment, all sessions shift accordingly
  - In the athlete calendar only relevant info is visible: sessions & daily intensities
- **PDF export** with full training plan, method rationales, research citations, AI-formulated "Why" text
- Future: sessions appear in athlete app (mobile)

---

## Two-App Architecture

### Coach App (Desktop-first)
- Full access to programming wizard
- Athlete, parameter, methods, and exercise databases
- Create, manage, and assign training plans to athletes
- AI chat available everywhere

### Athlete App (Mobile-first — phones are the primary target)
- Lean view — only what's relevant for the athlete
- Personal calendar with assigned sessions
- Daily intensities visible
- Open sessions and view details (exercises, sets, reps, intensity etc.)
- No access to planning level

> **Critical — Athlete App Layout Rules (apply to every component under `src/pages/athlete/` and `src/components/athlete-app/`):**
> - **Design for a 390px wide phone screen first.** Everything must be usable on a small phone without horizontal scrolling.
> - The `AthleteAppLayout` shell constrains content to `max-w-[480px] mx-auto` on desktop — never assume more width than that.
> - Use large tap targets (minimum 44×44 px) for all interactive elements.
> - Bottom sheets, modals, and overlays that use a Portal (shadcn `Sheet`, `Dialog`, etc.) escape the shell container and render at body level. They must be explicitly constrained: add `sm:w-[480px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2` (or equivalent) so they match the phone shell width on desktop.
> - Scrollable lists must use `ScrollArea` or `overflow-y-auto` with a bounded height — never let a list push the bottom action bar off screen.
> - Fixed bottom bars (action buttons, nav) must use `shrink-0` and sit outside any scroll container.
> - Font sizes: body text `text-sm` (14px), labels `text-xs` (12px) — never smaller.
> - Avoid hover-only interactions; always pair with `active:` states for touch feedback.

---

## Collaboration

### Workflow
- **Planning & prompts:** Claude Chat (browser)
- **Implementation:** Claude Code (desktop app, Code tab)
- **Version control:** GitHub — Felix works solo, pushes directly to `main`
- No external collaborator — all work is done by Felix + Claude Code

### When Debugging Gets Stuck (Critical!)
If a UI/layout/CSS bug cannot be solved after 2 failed attempts from code reading alone, **proactively offer to take over the computer**:
> "I'm going in circles reading code. Let me use the browser tools and inspect the live page directly — I can take a screenshot, run JavaScript to get computed styles and actual DOM dimensions, and click through the UI myself. Want me to do that?"

This is always faster than guessing from static code. The computer-use + Chrome MCP tools can:
- Take a screenshot of the running app
- Run `getBoundingClientRect()` and `getComputedStyle()` on any element
- Click through the UI to reproduce the bug
- Navigate to specific pages without needing login workarounds

**Do not wait for Felix to suggest this.** If the bug isn't solved by the second attempt, offer it immediately.

---

## Development Rules

### Data Flow (Critical!)
- Parameter values flow top-down: Periodization Table → Exercises → Calendar
- Changes at a higher level must propagate consistently downward
- Never store data redundantly across multiple levels
- Plan-state tests/events only flow into `calendarEvents` upon plan assignment

### State Management
- Wizard state must be preserved across all steps
- Bidirectional sync — entire wizard state is always consistent
- No isolated local state per step — always use central shared state
- Going back must never lose data

### Storage Changes
- Always include a migration fallback for existing localStorage data
- Never assume data is in the latest format

### Git / Local Sync (Critical!)
- Local files in `C:\Users\Hanik\plan-prep-coach` and `main` branch on GitHub must always stay in sync
- Before starting any new work: `git pull` to ensure local is up to date
- After finishing any work: commit and push all changes so nothing is left only locally — `git add <files> && git commit && git push origin main`
- Never leave large amounts of uncommitted work sitting in the main directory — commit in logical chunks regularly
- Claude Code works in a worktree (`.claude/worktrees/<branch>/`). Changes are ONLY visible in the browser if the dev server runs from that worktree directory. The user's dev server runs from `C:\Users\Hanik\plan-prep-coach` (main project dir) → **after pushing, always run `git pull` in the main dir and tell the user to restart the dev server** (`Ctrl+C` → `npm run dev`) and reload http://localhost:8080. A hard-reload alone (`Ctrl+Shift+R`) is NOT sufficient.
- **Before every large sync commit (stash → pull → stash pop), always check the diff for accidental removals** — especially imports and component renders that were intentionally added in earlier commits. A sync commit must never silently delete features

### Scrolling in Bounded Layouts (Critical — recurrent bug!)
Pages like `AthleteDatabase` use a `h-full flex flex-col` root + `overflow-hidden` content wrapper to create a fixed-height panel layout. Inside such layouts, tabs must scroll correctly. **The reliable pattern:**

- `TabsContent` must have `flex-1 min-h-0 overflow-y-auto` — the `overflow-y-auto` goes directly on the flex item that receives the bounded height from the flex algorithm. Flex-allocated sizes are always definite, so `overflow-y-auto` creates a proper scroll context.
- **Do NOT** use `<ScrollArea className="h-full">` as a block child of `TabsContent flex-1`. CSS `height: 100%` inheritance through flex items is browser-inconsistent when an ancestor has `overflow: auto` or `overflow: hidden`. The ScrollArea gets `height: auto` in some browsers, grows to content size, and the content is then clipped by the `overflow-hidden` ancestor — making content invisible and non-scrollable.
- Exception: tabs that manage their own internal flex-based scroll (like `AthletePerformanceTab` with `flex-1 min-h-0` root and internal `ScrollArea flex-1`) should use `TabsContent flex-1 min-h-0 flex flex-col` (add `flex flex-col`) so the child's `flex-1` resolves against the tab content height.
- `<ScrollArea className="flex-1">` (not `h-full`) works correctly inside a `flex` parent — use it in components that need a custom scrollbar and are inside a flex container.

### UI/UX Principles
- All UI text must be in English (labels, buttons, placeholders, hints, tab names, error messages)
- Drag & drop wherever possible
- Intensity labels consistent throughout the entire app (always use Borg CR10 — `"0"`–`"10"` string numerics via `intensityScale.ts`)
- Desktop-first for coach view, mobile-first for athlete view (future)

### FEATURES.md (Critical!)
- **Whenever a feature from FEATURES.md is implemented — fully or partially — update its status row immediately.** Mark it ✅ Done (with a brief description of what was built) or ✅ Partial / 🚧 In Progress if only part of it is done. Never leave a completed feature marked ⬜ Open.
- This applies to every implementation session, including incremental additions to existing features.
- FEATURES.md and CLAUDE.md are the single source of truth — keep them accurate at all times.

### Code Quality
- TypeScript strict mode — no `any` types
- Keep components small and reusable
- Extract complex logic into custom hooks
- Always analyze existing code before making changes
- Scope-limited prompts: explicitly state which files may be touched
- After implementation: provide a summary flagging any deviations from the prompt

---

## Known Complexities
- Periodization table is the most complex component (deeply nested data: `parameterValues[mesoId][mcIdx][methodKey][sessionIdx][paramName]`)
- Split methods use `"Method::Category"` key format internally; base method name must be stripped for toolbox/parameter lookups
- Dependencies between parameters must be correctly represented
- Automatic data flow from Meso → Micro → Session is critical
- Date handling: always store dates as `yyyy-MM-dd` strings; parse with `T12:00:00` (noon local) for display to avoid UTC midnight → previous day offset in non-UTC timezones
- PDF export must be structured and athlete-friendly
- `dangerouslyAllowBrowser: true` must be replaced with a backend proxy for SaaS
