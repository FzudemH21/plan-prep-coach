# Feature List – Plan Prep Coach

## Context
I am an athlete, coach, and sports scientist.
I'm developing Plan Prep Coach — a web app that streamlines the training planning process.
**Tech Stack:** React, TypeScript, Vite, Tailwind, shadcn-ui, Supabase
**GitHub:** https://github.com/FzudemH21/plan-prep-coach
I work with Claude Code in the terminal for code changes.
Claude Chat (browser) is my sparring partner for planning, discussion, and prompt formulation.

---

## Feature List

| Priority | Feature | Status |
|---|---|---|
| 🔴 Now | Code Audit Quick Fixes (1-4) | ✅ Done |
| 🔴 Now | Remove Athleticism DB v1 | ✅ Done |
| 🔴 Now | Session Card: remove exercise count | ✅ Done |
| 🔴 Now | Notes field Wizard + Sync | ✅ Done |
| 🔴 Now | Session Card overflow fix | ✅ Done |
| 🔴 Now | Notes field Athlete Profile | ✅ Done |
| 🔴 Now | Bulk Import Exercises (CSV/Excel) | ✅ Done |
| 🔴 Now | Bulk Import fixes (3-step flow, description optional, consistent storage) | ✅ Done |
| 🔴 Now | Dynamic Exercise Detail Modal (columns from database, no hardcoded fields, directly editable) | ✅ Done |
| 🟡 Soon | Coach Profile & Onboarding (AI conversation to learn coaching philosophy, AI asks follow-up questions, result saved as coach profile and reviewable) | ✅ Done – onboarding flow, AI conversation, profile extraction, voice input, skip option, Supabase-backed. Anthropic API key ✅. |
| 🟡 Soon | Supabase migration – remaining localStorage data | ✅ Done – Auth ✅, Coach Profile ✅, Documents ✅, Training Programs ✅, Parameters DB ✅, Toolbox/Methods DB ✅, Templates ✅, Athlete Database ✅, Calendar Events ✅, Custom Libraries ✅. Wizard session state (macrocycleData etc.) intentionally stays in localStorage as ephemeral working state. |
| 🟡 Soon | AI Autopilot in Wizard (suggestions & pre-filling of intensities, methods, exercises based on coach profile) | ✅ Done – Floating Bot button + slide-in chat panel on all 3 wizard pages (Macrocycle, Mesocycle, Microcycle). Proactive opener on first open (claude-haiku-4-5), reactive chat with coach profile + wizard state context, voice input. Context includes athlete, plan, goals, methods, mesocycles. |
| 🟡 Soon | Voice input for coach (athlete description via voice in athlete profile and wizard start, Web Speech API + Anthropic API) | ✅ Done |
| 🟡 Soon | Masterplanner view – Athlete Calendar (Day 1, Day 2... per weekday) | ✅ Done |
| 🟡 Soon | Tests & Events in Athlete Calendar + sync with Wizard | ✅ Done |
| 🟡 Soon | Document upload + sharing with athletes | ✅ Done – upload, folders, drag & drop, Supabase Storage backend, inline viewer (PDF + images), AI analysis (coach profile enrichment), share with athletes (per-document, per-athlete; shared docs visible in athlete profile with inline view/download). Optional future: Obsidian integration |
| 🟡 Soon | Programming Templates for training methods | ✅ Done – templates per method in Training Toolbox, Load Template dialog in Wizard Step 4 with preview, editable before loading, save as new template, units displayed, works across mesocycles |
| 🟡 Soon | Column reordering in databases (drag & drop) | ✅ Done |
| 🟡 Soon | Circuit Builder — create reusable circuit blocks in any Exercise Library. Circuits appear with a distinct loop icon (↻) in the library list. Parameters per exercise: Sets, Reps. Circuit-level parameters: Rest between rounds, Rest between exercises. Circuits loadable into sessions in the wizard. | ✅ Done – Circuit library creation & editing ✅, distinct ↻ icon ✅, drag & drop into sessions ✅, editable in Workout Session Card (rest times, reps, sets, name) ✅, editable in Step 2 Exercise Distribution by clicking circuit name ✅, "Save & Add to Library" with library picker ✅, duplicate-name conflict resolution (overwrite or rename) ✅, dark backdrop when stacked ✅. |
| 🟡 Soon | Outcome Annotation for completed plans (Plan Review dialog on athlete calendar: overall rating 1–5, goal achievement, load tolerance, coach notes — stored per assignment, feeds into AI memory) | ✅ Done – PlanReviewDialog on completed assignments, data stored in AthleteCalendarAssignment. Placeholders for: Adherence (auto-fill from athlete app), Planned vs. Real (athlete app), AI coaching dialog. |
| 🟠 Later | Accumulated Context (automatic comparison of AI suggestion vs. final plan, AI asks targeted follow-up questions on significant deviations — max. 1-2 per plan, skippable, answers fed back as rationale context) | ⬜ Open |
| 🟡 Soon | Code Audit — systematic review of component structure, state management, data flow consistency, dead code, TypeScript strictness, and performance before scaling to RAG + AI features. | ✅ Done – ExerciseDistribution type consolidated across 10 files, upsertRow race condition fixed, API model default updated, trainingMethods typed, console.log cleanup, useCallback performance improvements. |
| 🟡 Soon | RAG via Supabase Vector DB — coach uploads sports science literature, training plans, and PDFs; AI chunks & embeds documents into pgvector; AI retrieves relevant passages on every query and responds based on real sources. | ✅ Done – pgvector table + RLS + ivfflat index, PDF/text extraction (pdfjs-dist), chunking (400 words, 50 overlap), OpenAI text-embedding-3-small, ingestDocument pipeline, useRAGRetrieval hook, wired into all 3 wizard pages (Macrocycle, Mesocycle, Microcycle). Auto-indexes on upload. |
| 🟠 Later | AI Semantic Extraction from Uploaded Documents | ✅ Superseded by RAG — chunking, embedding, and retrieval via pgvector covers this entirely. No separate implementation needed. |
| 🟠 Later | Inline Document Viewer (preview PDFs and other supported file types directly inside the app instead of opening a new browser tab) | ✅ Done – full-screen dialog (92vw×92vh) for PDFs and images; spinner while loading; open-in-new-tab + download toolbar; integrated in Coach Profile documents and Wizard Resources panel |
| 🟡 Soon | CSV Import / Export for databases — Exercise Library, Training Methods, and Parameter Database each get an Export to CSV button and an Import from CSV button. Import includes a "Download sample file" option that generates a correctly structured template the coach can fill in. Imports are validated and merged non-destructively (no overwrites without confirmation). | ⬜ Open |
| 🟠 Later | Adherence tracking (auto-filled from athlete app workout logs — session completion rate, missed days) | ⬜ Open – placeholder UI exists in Plan Review dialog |
| 🟠 Later | Planned vs. Real comparison (volume, intensity, load: planned vs. actually performed — requires athlete app session data) | ⬜ Open – placeholder UI exists in Plan Review dialog |
| 🟠 Later | AI Coaching Dialog in Plan Review (AI reflects on outcome data, identifies patterns, suggests next-cycle adjustments — powered by plan_memory + outcome annotation) | ⬜ Open – placeholder UI exists in Plan Review dialog |
| 🟠 Later | **Replace intensity scale with Borg CR10** — swap the 8-level scale (off → extremely-hard) for Borg CR10 (0–10, 11 levels) throughout the entire app. Applied at mesocycle, microcycle, daily, and session level in the wizard. Athlete uses the same scale for post-session self-report → direct planned vs. actual comparison. Requires updating all intensity selectors, storage values, display labels, color coding, and CLAUDE.md. | ⬜ Open |
| 🟠 Later | Goal Management + test notifications | ⬜ Open |
| 🔵 Future | **Athlete App** — see full breakdown below | ⬜ In Planning |
| 🔵 Future | Athlete Management System (standalone area: athlete profiles, progress tracking, communication, wearable data. Incl. AI analysis: correlations between completed training and athlete progress — coach can ask how effective a program was, which methods had the greatest effect, etc. Requires compliance tracking, test results, and Supabase.) | ⬜ Open |
| 🔵 Future | AI knowledge base + coach philosophy combined (AI has its own sports science knowledge base, coach profile supplements it, AI flags deviations from scientific consensus — learning effect for less experienced coaches) | ⬜ Open |
| 🔵 Future | Wearable & app integrations (Oura, Whoop, Apple Fitness, VBT) | ⬜ Open |
| 🔵 Future | SaaS & monetization (login, packages, Stripe) | ⬜ Open |
| 🔵 Future | **Pre-publish security hardening** — must be completed before giving access to any external coach: (1) Replace `dangerouslyAllowBrowser: true` + direct Anthropic API calls in `src/utils/anthropicApi.ts` with a Supabase Edge Function proxy so the API key never reaches the browser; (2) Move `VITE_ANTHROPIC_API_KEY` from frontend `.env` to Supabase server-side secrets; (3) Add per-user rate limiting in the Edge Function; (4) Review all RLS policies on Supabase tables to ensure coaches can only access their own data. Estimated effort: ~2–3h. | ⬜ Open |
| 🔵 Future | Booking system (athletes book with coach) + coach calendar | ⬜ Open |
| 🔵 Future | Payment system Coach↔Athlete (marketplace model) | ⬜ Open |
| 🔵 Future | RAG Phase 2 — AI knowledge base with sports science consensus layer: AI flags deviations from scientific consensus, learning effect for less experienced coaches. Builds on RAG Phase 1 (🟡 Soon). | ⬜ Open |

---

## Athlete App — Full Feature Breakdown

> **Architecture:** PWA first (same React/Vite codebase, mobile-optimized routes), Capacitor wrapper later for App Store distribution.
>
> **Intensity scale:** The 8-level scale (off → extremely-hard) will be replaced by the **Borg CR10 scale (0–10, 11 levels)** throughout the entire app — coach side and athlete side. The same scale is used at mesocycle, microcycle, daily, and session level by the coach during planning, and by the athlete for post-session self-assessment. This makes planned vs. actual a direct, apples-to-apples comparison with no mapping required. See the "Replace intensity scale with Borg CR10" feature in the main table.

### Navigation (4 bottom tabs)
| Tab | Description |
|-----|-------------|
| Today | Home screen — greeting, today's session card, daily intensity, missed session banner |
| Plan | Assigned plan overview — mesocycle/week structure, week calendar strip |
| Messages | Direct text chat with coach (Phase 1: text only; Phase 2: photo/video) |
| Profile | Athlete stats, parameter progress charts, activity history |

### Phase 1 — Core (MVP)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | **Invite flow** — coach sends invite link → athlete opens app → language selection → name/birthday/photo onboarding | ⬜ Open |
| P0 | **Today tab** — personalized greeting, today's session card with planned daily intensity (Borg CR10, color-coded), completion ring, missed session banner | ⬜ Open |
| P0 | **Session flow** — preview → section navigation (swipe, dot indicators) → exercise cards with planned values (from periodization table) → set logging (actual weight/reps) → rest timer | ⬜ Open |
| P0 | **Post-session** — completion screen, Borg CR10 rating (0–10), optional comment, summary (duration, exercises logged) | ⬜ Open |
| P0 | **Planned vs. actual storage** — athlete's logged sets saved to Supabase, visible to coach in Plan Review dialog (feeds Adherence + Planned vs. Real placeholders) | ⬜ Open |
| P1 | **Plan tab** — shows assigned mesocycle name, current week/microcycle, week calendar strip with session dots | ⬜ Open |
| P1 | **Activity history** — week strip calendar + timeline of past days, completed session cards (session name, planned vs perceived intensity, duration) | ⬜ Open |
| P1 | **Messages** — text chat with coach, timestamps, read receipts | ⬜ Open |
| P1 | **Profile tab** — avatar (initials fallback), settings, sessions completed + streak stats, parameter progress charts (from Parameter Database — Squat 1RM, Sprint 30m, VO2max etc.) | ⬜ Open |

### Phase 2 — Enrichment

| Priority | Feature | Status |
|----------|---------|--------|
| P2 | Photo/video in messages | ⬜ Open |
| P2 | Exercise video playback in session (link to exercise database video) | ⬜ Open |
| P2 | In-session exercise swap (alternative exercise dropdown) | ⬜ Open |
| P2 | Tests & events visible in Plan tab calendar (synced from plan assignment) | ⬜ Open |
| P2 | Progress photos in profile | ⬜ Open |
| P3 | Language selection on first open (German / English minimum) | ⬜ Open |
| P3 | Push notifications (session reminders, coach messages) | ⬜ Open |

### Data Flow (Athlete App → Coach App)
- Athlete logs sets → stored in Supabase (`athlete_session_logs` table)
- Coach sees adherence rate + planned vs. actual comparison in Plan Review dialog (already has placeholder UI)
- Borg CR10 post-session rating → stored alongside planned Borg CR10 target from wizard → coach sees planned vs. perceived load gap in Plan Review
- Athlete logs a test result in app → auto-updates the corresponding performance parameter value in the coach's athlete profile

---

## Athlete Profile — Coach-Side Enhancements

These features extend the existing Athlete Profile page in the coach web app. They are unlocked once the athlete app exists and athletes are connected.

### New Tab: Settings (per-athlete coach controls)

Inspired by EverFit's per-athlete settings. Coach controls what the athlete can see and do.

| Setting | Description | Build? |
|---------|-------------|--------|
| **Units** | Weight (kg / lb), Distance (km / miles) — used in athlete app display | ✅ Yes |
| **Workout visibility range** | How far ahead athlete can see their plan: Previous / Current / Next / +2 / +3 / +4 weeks | ✅ Yes |
| **Features toggles** | Enable/disable per athlete: Training (always on), Log Activities (athlete adds own sessions), Messages, Performance Metrics | ✅ Yes |
| **Allow athlete to add/replace exercises** | Athlete can swap exercises in-session from coach's library | 🟠 Phase 2 |
| Food journal, Macros, Meal Plan, Tasks | Nutrition & task delivery features | ❌ Out of scope |
| Team Permission | Multi-coach access to one athlete | 🔵 Future |

### New Tab: Performance Metrics (coach view)

Replaces / extends the current static parameter values in the athlete profile with a full history view.

| Feature | Description | Build? |
|---------|-------------|--------|
| **Body Metrics tab** | Weight, height, body fat % over time — line chart + entry history | ✅ Yes |
| **Performance/Exercise Metrics tab** | Per-exercise or per-parameter progress chart over time (e.g. Squat 1RM trend from Mar–May) | ✅ Yes |
| **Per-session history** | For each exercise/parameter: date, session name, set-by-set log (Set #, Reps, RIR/Intensity, Weight) | ✅ Yes |
| **1RM estimation** | Auto-calculate estimated 1RM from logged sets using Epley formula | 🟠 Phase 2 |
| **Auto-update from athlete app** | When athlete logs a test result in the app (e.g. Sprint 30m: 4.2s) → automatically updates the parameter value in coach's athlete profile. Critical for remote athletes where coach isn't present at the test. | ✅ Yes |
| **Link to wizard tests** | Test days scheduled in the wizard (e.g. "Test Week") appear in the metric history with a distinct marker | 🟠 Phase 2 |

---

## Coach Mobile App (Future)

EverFit has a dedicated coach app (separate from the athlete app) that allows coaches to:
- View all athletes and their upcoming sessions
- Log workouts on behalf of an athlete (essential for in-person PT sessions — coach enters sets/reps/weight live)
- Make small edits to sessions on the go
- Send messages to athletes

**Our approach:** Not a separate codebase. A mobile-optimized coach view within the same PWA, behind a "Coach" role check. Capacitor wrapper allows App Store distribution alongside the athlete app.

| Feature | Description | Priority |
|---------|-------------|---------|
| **Log workout for athlete** | Coach selects athlete → open today's session → logs sets live (in-person PT) | P1 |
| **Athlete overview** | List of all athletes, today's sessions at a glance, missed session flags | P1 |
| **Quick session edit** | Adjust sets/reps/intensity for a single session directly from mobile | P2 |
| **Send message** | Coach ↔ athlete chat from mobile | P2 |

---

## Workflow
- Claude Code (desktop app, Code tab) for all code changes
- Claude Chat (browser) as sparring partner for planning & prompts
- After each milestone: `git add . && git commit -m "..."`
- Context at 70%+ → `/clear` in Claude Code
- New chat session → CLAUDE.md + FEATURES.md are stored in the project root
- External collaborator works in feature branches, opens PRs, Felix reviews and merges
