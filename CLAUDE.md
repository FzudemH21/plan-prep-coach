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
        └── Microcycle(s)  (usually 1 week, configurable duration)
              └── Training Day(s)
                    └── Session(s)
                          └── Sections (Warm-up, Main, Cooldown)
                                └── Exercises (with Sets, Reps, Intensity etc.)
```

---

## Databases (Coach-configurable)
1. **Athlete Database** – Profiles with demographic data, parameter values, assigned plans, personal calendar
2. **Parameter Database** – Goals, sub-parameters, dependencies between parameters (positive/negative), rationales + research citations
3. **Training Methods Database** – Methods with parent/child categories, linked to parameters
4. **Exercise Database** – Exercises with video, description, category (e.g. "Lower Body Resistance Strength"), parameters. Bulk import via CSV/Excel (3-step flow). Dynamic detail modal (columns from database, no hardcoded fields, directly editable). Drag & drop column reordering.

---

## Implemented Features (Current State)

### Coach Profile
- Onboarding flow with AI conversation (basic structure), skip option, voice input
- Documents: local storage, folder structure, drag & drop, upload
- Resources panel (persistent, available in onboarding and wizard)
- AI conversation will be fully activated once Anthropic API integration is complete

### Athlete Calendar & Masterplanner
- Athlete calendar with copy/paste, clear day/week, session name sync
- Tests & events in calendar, synced with wizard via unified `calendarEvents` storage
- Masterplanner view with week-horizon selector
- Consistent color/icon scheme for tests and events across all views (Athlete Calendar, Macrocycle, Mesocycle, Microcycle Planning)

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

### Phase 1: Plan Setup
**Step 1:** Select athlete → values auto-loaded, plan name, date range, target parameters
**Step 2:** Parameters & sub-goals
**Step 3:** Select training methods

### Phase 2: Mesocycle Planning
**Step 1:** Configure mesocycles (count, duration, intensities per microcycle: `Off → Easy → Moderate → Hard → Extremely Hard`)
**Step 2:** Microcycle intensities (daily intensities within each microcycle)
**Step 3:** Methods per mesocycle (define which methods are active per mesocycle)
**Step 4:** Periodization Table ⭐ (core component) — frequency, sets, reps, intensity per method & microcycle; values flow automatically through all levels down to the final training calendar
**Step 5:** Exercise selection per mesocycle & method

### Phase 3: Microcycle Planning (Training Calendar)
**Step 1:** Assign exercises to days (calendar view with intensity labels, labels changeable consistently)
**Step 2:** Build session architecture (sections, supersets, drag & drop, copy sessions)

**Automatic data flow:**
- Load parameters from periodization table appear automatically on exercises
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

### Athlete App (Mobile-first, future)
- Lean view — only what's relevant for the athlete
- Personal calendar with assigned sessions
- Daily intensities visible
- Open sessions and view details (exercises, sets, reps, intensity etc.)
- No access to planning level

---

## Collaboration

### Workflow
- **Planning & prompts:** Claude Chat (browser)
- **Implementation:** Claude Code (desktop app, Code tab)
- **Version control:** GitHub, branch/PR workflow
- External collaborator has GitHub Collaborator access
- No direct pushes to `main` — always via Pull Request
- Felix reviews and merges all PRs

### For the External Collaborator
- Work in own feature branches (e.g. `feature/rag-supabase`)
- Open Pull Requests for review before merging
- Has access to Supabase project (Settings → Team)
- Current task: RAG via Supabase Vector DB (Supabase Auth + Cloud Storage already set up)

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
- After finishing any work: commit and push all changes so nothing is left only locally
- Never leave large amounts of uncommitted work sitting in the main directory — commit in logical chunks regularly
- Claude Code works in a worktree (`.claude/worktrees/<branch>/`). Changes are ONLY visible in the browser if the dev server runs from that worktree directory. The user's dev server runs from `C:\Users\Hanik\plan-prep-coach` (main project dir) → changes are only visible AFTER the PR is merged to `main` and the user hard-reloads
- **Always merge the PR and tell the user to open http://localhost:8080 and hard-reload (`Ctrl+Shift+R`) before declaring a task complete.** If they can't verify at that URL, the task is not done
- **Before every large sync commit (stash → pull → stash pop), always check the diff for accidental removals** — especially imports and component renders that were intentionally added in earlier commits. A sync commit must never silently delete features

### UI/UX Principles
- All UI text must be in English (labels, buttons, placeholders, hints, tab names, error messages)
- Only CLAUDE.md and FEATURES.md remain in German — but as of this update, both are in English
- Drag & drop wherever possible
- Intensity labels consistent throughout the entire app
- Desktop-first for coach view, mobile-first for athlete view (future)

### Code Quality
- TypeScript strict mode — no `any` types
- Keep components small and reusable
- Extract complex logic into custom hooks
- Always analyze existing code before making changes
- Scope-limited prompts: explicitly state which files may be touched
- After implementation: provide a summary flagging any deviations from the prompt

---

## Known Complexities
- Periodization table is the most complex component (deeply nested data)
- Dependencies between parameters must be correctly represented
- Automatic data flow from Meso → Micro → Session is critical
- PDF export must be structured and athlete-friendly
- `dangerouslyAllowBrowser: true` must be replaced with a backend proxy for SaaS
