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
| 🟡 Soon | Outcome Annotation for completed plans (Plan Review dialog on athlete calendar: overall rating 1–5, goal achievement, load tolerance, coach notes — stored per assignment, feeds into AI memory) | ✅ Done – PlanReviewDialog on completed assignments, data stored in AthleteCalendarAssignment. Analysis tab in Athlete Profile now built (time-window based) — PlanReviewDialog can be removed in a future cleanup pass. |
| 🟠 Later | Accumulated Context (automatic comparison of AI suggestion vs. final plan, AI asks targeted follow-up questions on significant deviations — max. 1-2 per plan, skippable, answers fed back as rationale context) | ✅ Done |
| 🟡 Soon | Code Audit — systematic review of component structure, state management, data flow consistency, dead code, TypeScript strictness, and performance before scaling to RAG + AI features. | ✅ Done – ExerciseDistribution type consolidated across 10 files, upsertRow race condition fixed, API model default updated, trainingMethods typed, console.log cleanup, useCallback performance improvements. |
| 🟡 Soon | RAG via Supabase Vector DB — coach uploads sports science literature, training plans, and PDFs; AI chunks & embeds documents into pgvector; AI retrieves relevant passages on every query and responds based on real sources. | ✅ Done – pgvector table + RLS + ivfflat index, PDF/text extraction (pdfjs-dist), chunking (400 words, 50 overlap), OpenAI text-embedding-3-small, ingestDocument pipeline, useRAGRetrieval hook, wired into all 3 wizard pages (Macrocycle, Mesocycle, Microcycle). Auto-indexes on upload. |
| 🟠 Later | AI Semantic Extraction from Uploaded Documents | ✅ Superseded by RAG — chunking, embedding, and retrieval via pgvector covers this entirely. No separate implementation needed. |
| 🟠 Later | Inline Document Viewer (preview PDFs and other supported file types directly inside the app instead of opening a new browser tab) | ✅ Done – full-screen dialog (92vw×92vh) for PDFs and images; spinner while loading; open-in-new-tab + download toolbar; integrated in Coach Profile documents and Wizard Resources panel |
| 🟡 Soon | CSV Import / Export for databases — Exercise Library, Training Methods, and Parameter Database each get an Export to CSV button and an Import from CSV button. Import includes a "Download sample file" option that generates a correctly structured template the coach can fill in. Imports are validated and merged non-destructively (no overwrites without confirmation). | ✅ Done |
| 🟠 Later | **Athlete Profile — Analysis tab** — time-window driven training analysis dashboard. Replaces the Plan Review dialog (which is removed — coach notes move here). Tab sits alongside Profile / Performance / Calendar / Documents in the athlete profile. **Structure:** (1) Date range selector with quick presets (last week, last 4 weeks, last mesocycle, custom). (2) **Internal load panel** — weekly sRPE (Foster method, AU) bar chart; planned session intensity vs. athlete's actual post-session RPE per session as a timeline/scatter. (3) **Training stimulus panel** — configurable parameter aggregations: coach selects any parameters that were actually logged during the period (i.e. visible params the athlete recorded in-session), assigns an aggregation type per parameter (Sum / Mean / Range), and the system computes the value per week across the window. Examples: `Intensive Plyometrics → Ground Contacts (Sum)`, `Lower Body Strength → Tonnage (Sum)`, `Sprint → Distance (Sum)`. The coach is fully responsible for knowing what each aggregation means for a given parameter — if jumps were prescribed by distance rather than ground contacts, ground contacts simply won't be in the data. Selection saved as a per-athlete analysis config. (4) **Adherence panel** — sessions completed vs. planned, missed day markers. (5) **Performance markers** — test results from the athlete calendar plotted on the same timeline so the coach can correlate stimulus profile and RPE response with performance outcomes. (6) **Time-window notes** — free-text coach annotation attached to the selected date range (replaces Plan Review subjective fields). No Toolbox changes required — the parameter list is derived dynamically from what was actually logged. | 🚧 In Progress — Tab added to AthleteProfileView ✅. Date range selector (1W/4W/3M/Custom with calendar picker) ✅. Granularity toggle (day/week/month/year) ✅. Internal load panel (sRPE bar chart, completed sessions only, planned load overlay toggle) ✅. Adherence stat (X/Y sessions, %) ✅. Remaining open: training stimulus panel, performance markers, time-window notes. |
| 🟠 Later | AI Coaching Dialog in Analysis tab (AI reflects on the selected time window: load trends, RPE divergence, stimulus distribution, performance markers — suggests next-block adjustments. Powered by coach profile + RAG + session data.) | ⬜ Open |
| 🟠 Later | **Replace intensity scale with Borg CR10** — swap the 8-level scale (off → extremely-hard) for Borg CR10 (0–10, 11 levels) throughout the entire app. Applied at mesocycle, microcycle, daily, and session level in the wizard. Athlete uses the same scale for post-session self-report → direct planned vs. actual comparison. Requires updating all intensity selectors, storage values, display labels, color coding, and CLAUDE.md. | ✅ Done — `IntensityLevel` aliased to `BorgLevel = "0"\|…\|"10"`, single source of truth in `src/utils/intensityScale.ts`, legacy values auto-migrated via `migrateLegacyIntensity()`. CLAUDE.md updated. |
| 🟠 Later | Goal Management + test notifications | ⬜ Open |
| 🟠 Later | **Athlete Profile — Performance tab** — move current static parameter values out of the Profile tab into a dedicated "Performance" tab. Tab structure becomes: Profile / Performance / Calendar / Documents. Performance tab contains: body metrics (weight, height, body fat % over time with charts), performance parameters (Squat 1RM, Sprint 30m, VO2max etc. with history charts), per-session set-by-set log (once athlete app is live), auto-update when athlete logs a test remotely. | ✅ UI Done — Body Metrics / Performance / Exercise Metrics tabs built with search, table rows, chart + history. Athlete app wiring still open (see below). |
| 🟠 Later | **Athlete Profile — Settings tab** — per-athlete coach controls: units (kg/lb, km/miles), workout visibility range (how many weeks ahead athlete sees), feature toggles (Log Activities, Messages, Performance Metrics). Tab structure: Profile / Performance / Calendar / Documents / Settings. | ⬜ Open — UI + athlete app wiring both needed (see below). |
| 🟠 Later | **Wire Athlete Profile → Athlete App: Settings** — settings configured by the coach in the athlete profile Settings tab (units, visibility range, feature toggles) must be read and enforced in the athlete app in real time. Stored in Supabase per-athlete so the app can consume them on load. | ⬜ Open — requires athlete app to exist first. |
| 🟠 Later | **Wire Athlete Profile → Athlete App: Metrics sync** — (1) Body Metrics and Performance values entered by the coach appear in the athlete's Profile tab in the athlete app. (2) Values logged by the athlete in the app (test results, body weight etc.) automatically update the corresponding metric in the coach's athlete profile. (3) Exercise Metrics tab auto-populates from the athlete's workout logs (sets, reps, weight, tempo per exercise per session). Stored in Supabase `athlete_session_logs` / `athlete_metric_values`. | ⬜ Open — requires athlete app to exist first. |
| 🟠 Later | **Exercise parameter tracking in athlete profile** — Parse the set-by-set logs stored in `athlete_session_logs.sets_logged` (recorded by the athlete in-session) and display them in the coach's athlete profile → Performance tab → Exercise Metrics section. Shows: per-exercise history table (date, session name, Set #, logged reps/weight/intensity), trend chart for key parameters (e.g. Squat load over time), planned vs. actual comparison per set. The UI shell (Exercise Metrics tab with search, table, chart) is already built — this feature wires the real data from `athlete_session_logs` into it. Exercise-level planned vs. actual lives here (Performance tab); session/load-level planned vs. actual lives in the Analysis tab. | ⬜ Open |
| 🟠 Later | **Exercise Progressions & Regressions** — In the exercise database detail modal, coaches define an ordered progression/regression chain for each exercise. Each linked exercise gets a direction (Progression / Regression) and a level number (1 = one step harder/easier, 2 = two steps, etc.), plus an optional note. Stored in a dedicated `exercise_progressions` junction table (not JSONB) to allow reverse lookups and prevent dangling references on delete. Snapshotted into `athlete_schedule` at plan-assignment time so the athlete app works offline. In the athlete app, during an active session, each exercise card shows a "Need an adjustment?" affordance — tapping opens a sheet with the regression chain (easier options going down) and progression chain (harder options going up). Athlete picks a substitute → confirmation dialog ("Swap [Exercise A] with [Exercise B] for this session?") → exercise is replaced for the remainder of the session only; the coach's plan is never modified. The swap is logged in `athlete_session_logs` as `swapped_exercise_id` + `swap_direction` so the coach sees which adjustments were made and why (feeds Planned vs. Real and adherence tracking). Coach sees swaps surfaced in the Analysis tab (adherence panel + session detail). | ⬜ Open |
| 🔵 Future | **Athlete App** — see full breakdown below | ⬜ In Planning |
| 🔵 Future | Athlete Management System (standalone area: athlete profiles, progress tracking, communication, wearable data. Incl. AI analysis: correlations between completed training and athlete progress — coach can ask how effective a program was, which methods had the greatest effect, etc. Requires compliance tracking, test results, and Supabase.) | ⬜ Open |
| 🔵 Future | AI knowledge base + coach philosophy combined (AI has its own sports science knowledge base, coach profile supplements it, AI flags deviations from scientific consensus — learning effect for less experienced coaches) | ✅ Done |
| 🔵 Future | Wearable & app integrations (Oura, Whoop, Apple Fitness, VBT) | ⬜ Open |
| 🔵 Future | SaaS & monetization (login, packages, Stripe) | ⬜ Open |
| 🔵 Future | **Pre-publish security hardening** — must be completed before giving access to any external coach: (1) Replace `dangerouslyAllowBrowser: true` + direct Anthropic API calls in `src/utils/anthropicApi.ts` with a Supabase Edge Function proxy so the API key never reaches the browser; (2) Move `VITE_ANTHROPIC_API_KEY` from frontend `.env` to Supabase server-side secrets; (3) Add per-user rate limiting in the Edge Function; (4) Review all RLS policies on Supabase tables to ensure coaches can only access their own data. Estimated effort: ~2–3h. | ⬜ Open |
| 🔵 Future | Booking system (athletes book with coach) + coach calendar | ⬜ Open |
| 🔵 Future | Payment system Coach↔Athlete (marketplace model) | ⬜ Open |

---

## Athlete App — Full Feature Breakdown

> **Architecture:** PWA first (same React/Vite codebase, mobile-optimized routes), Capacitor wrapper later for App Store distribution.
>
> **Intensity scale:** Borg CR10 (0–10, 11 levels) — **migration complete.** Used at mesocycle, microcycle, daily, and session level by the coach during planning, and by the athlete for post-session self-assessment. Direct planned vs. actual comparison with no mapping required. Single source of truth: `src/utils/intensityScale.ts`.

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
| P0 | **Today tab** — personalized greeting, today's session card with planned daily intensity (Borg CR10, color-coded), completion ring, missed session banner | ✅ Done — greeting, today's session card(s), intensity badge, coming-up strip (next 5 consecutive days with colour-coded dots). Completion ring + missed session banner open. |
| P0 | **Session flow** — preview → section navigation → exercise cards with planned values (from periodization table) → set logging (actual weight/reps/intensity per set) → rest timer between sets | ✅ Done — overview with collapsible section cards, section intro screen, active workout screen with set-logging table (per-set inputs pre-filled with planned values, tap to confirm), rest timer (reads rest param from toolbox — both ad-hoc per-set format and periodization plain-key format), superset grouping, circuit round tracking, exercise detail sheet (YouTube thumbnail + description), elapsed workout timer, ⓘ icon for exercise details. |
| P0 | **Post-session** — completion screen, Borg CR10 rating (0–10), optional comment, summary (duration, sRPE load) | ✅ Done — Borg CR10 bottom sheet (vertical list, official labels 0–10), optional notes, duration_seconds recorded from elapsed timer, sRPE (Foster method: RPE × duration_min) displayed as AU. All saved to athlete_session_logs. |
| P0 | **Planned vs. actual storage** — athlete's logged sets saved to Supabase, visible to coach in the Analysis tab (feeds adherence panel + stimulus breakdown + RPE comparison) | ✅ Done — set-by-set values stored in athlete_session_logs.sets_logged (JSON), session completion + Borg RPE + duration + sRPE all stored. Session cards in Today and Plan tabs show "Completed · X min · RPE Y · sRPE Z AU". Completed sessions show inline results grid in overview. |
| P1 | **Plan tab** — shows assigned mesocycle name, current week/microcycle, week calendar strip with session dots | ✅ Done — arrow week navigation (← DD.MM. – DD.MM.YYYY →), Mon–Sun day list, intensity badges, session cards, today highlight, past days dimmed, coach-controlled weeks-ahead visibility limit. |
| P1 | **Activity history** — week strip calendar + timeline of past days, completed session cards (session name, planned vs perceived intensity, duration) | ✅ Partial — recent sessions visible in Profile tab. Dedicated history view open. |
| P1 | **Messages** — text chat with coach, timestamps, read receipts | ⬜ Open |
| P1 | **Profile tab** — avatar (initials fallback), settings, sessions completed + streak stats, parameter progress charts (from Parameter Database — Squat 1RM, Sprint 30m, VO2max etc.) | ✅ Done — initials avatar, name/email, sessions completed + day streak stats, recent session history (last 10 with date + RPE), sign out. Parameter progress charts open (requires metrics wiring). |

### Phase 2 — Enrichment

| Priority | Feature | Status |
|----------|---------|--------|
| P2 | Photo/video in messages | ⬜ Open |
| P2 | Exercise video playback in session (link to exercise database video) | ✅ Done — ⓘ icon + tappable exercise name opens a centered dialog with YouTube thumbnail (tappable → opens video) and description. Video URL + description snapshotted into athlete_schedule at plan-assignment time. |
| P2 | **Session copy bug — parameter + visibility data** — When copying a session in the athlete calendar (coach web app), parameter values and visible parameters are not copied correctly: for program-assigned exercises, planned param values copy but visibleParams does not; for manually added (ad-hoc) exercises, neither plannedParams nor visibleParams copy. Root is in the copy logic in WorkoutSessionSheet / AthleteCalendarView — the copy must deep-clone adhocPlannedParams, adhocVisibleParams, and the parameterVisibility localStorage key for the target date/session. Fix before session copy is considered reliable. | ⬜ Open |
| P2 | **Workout completion sync** — after an athlete completes and logs a session, the session is marked as completed in Today, Plan, and session overview: green card styling, checkmark icon, "Completed · X min · RPE Y · sRPE Z AU" line. Completed sessions show inline results grid (logged set values) in the overview. CTA changes to "Close". Data refreshed via refetchLogs() after save. | ✅ Done |
| P2 | **In-progress session state** — when athlete taps "Start Workout", an in-progress row is inserted to `athlete_session_logs` (`started_at` set, `completed_at` null). Coach calendar shows amber pulsing "In progress…" card with PlayCircle icon. On finish, that row is UPDATEd (not inserted). In-progress rows are excluded from `getSessionLog` so they never block the "Start Workout" button. | ✅ Done |
| P2 | **Locked sessions in coach calendar** — completed and in-progress sessions cannot be dragged, deleted, or cleared (clear day / clear week). Clicking a completed session opens the CompletedSessionSheet. In-progress sessions are non-clickable. | ✅ Done |
| P2 | **Athlete add/delete sets** — during an active session the athlete can add or remove sets per exercise via + / − buttons. Coach sees added sets highlighted in amber ("Added" badge) and removed/skipped sets in red with strikethrough ("Removed"/"Skipped" badge) in CompletedSessionSheet. Planned set count stored as `plannedSets`; planned param values stored as `plannedParams` (per-set and global key lookup) so removed set rows show the prescribed values crossed out in red. | ✅ Done |
| P2 | **Session structure in CompletedSessionSheet** — all exercises always visible (even if no sets logged — shows "Not done"). Sections with headers, supersets grouped with SUPERSET label. Correct sort order by `sectionOrder`/`exerciseOrder`. Backward-compatible with old logs (no `sectionId` = flat list). | ✅ Done |
| P2 | **"Each side" indicator in athlete session** — exercises that have the "Each side" flag set should display a clear indicator in the athlete's session logging view, so the athlete knows to perform the exercise unilaterally (important for single-leg, single-arm exercises). Show a badge or note next to the exercise name. | ⬜ Open |
| P2 | **Circuit details in CompletedSessionSheet** — when the coach reviews a completed session, circuit entries should display full circuit details: number of rounds, rest between rounds, rest between exercises, and the list of exercises with their reps/time/distance. Currently only shows rounds completed vs. total. | ⬜ Open |
| P2 | **New session on day with completed session** — bug: adding a new session to a day that already has a completed session can cause the new session to appear as completed in the athlete app. Root suspected in positional session IDs (`${date}-${index}`) drifting when the athlete_schedule is re-synced. Needs investigation with a reproducible test case. | ⬜ Open |
| P2 | **Rest parameter in coach views + athlete rest timer** — rest parameter now appears as a regular editable column in the coach's training calendar (wizard) and athlete calendar. Hidden from athlete's set-logging table (filtered in getParamColumns). Rest timer reads values from both per-set format (ad-hoc exercises) and plain-key format (periodization exercises). Unit locked to [s] in coach grid header. | ✅ Done |
| P2 | **Athlete load chart** — weekly sRPE (Foster method, AU) bar chart in the athlete's Profile tab. Shows accumulated training load per week (sum of sRPE across all completed sessions). Optionally overlaid with planned intensity (from daily/session intensity badges). Enables load monitoring and recovery planning. | ⬜ Open |
| P2 | **Planned vs. actual RPE / load comparison** — per-session and per-week view comparing: (1) planned session intensity (Borg CR10 set by coach in wizard) vs. athlete's post-session RPE rating; (2) planned weekly load (derived from planned intensities × planned durations) vs. actual accumulated sRPE (AU). Shown in athlete Profile tab (athlete's own view) and coach's Analysis tab (Athlete Profile). Enables identification of under/overload patterns. | ⬜ Open |
| P2 | **In-session exercise swap via Progressions & Regressions** — during an active session, each exercise card shows a "Need an adjustment?" affordance. Tapping opens a bottom sheet with the regression chain (easier, going down) and progression chain (harder, going up) as defined by the coach in the exercise database. Each option shows level number, exercise name, and optional coach note. Athlete selects a substitute → confirmation dialog ("Swap [A] with [B] for this session?") → exercise replaced for this session only; the plan is never modified. Swap is logged in `athlete_session_logs` (swapped_exercise_id + swap_direction). Coach sees swaps in Plan Review. Requires "Exercise Progressions & Regressions" feature (coach-side setup + snapshot at assignment). Gated by the "Allow athlete to add/replace exercises" setting in Athlete Profile → Settings. | ⬜ Open |
| P2 | Tests & events visible in Plan tab calendar (synced from plan assignment) | ✅ Done — events column added to athlete_schedule; tests show with amber card + Goal value + unit, events show with blue card; both appear above sessions in Today and Plan tabs. |
| P2 | Progress photos in profile | ⬜ Open |
| P3 | **Daily check-in** — shown once per day on first app open. Two sections: (1) Short wellbeing questionnaire (sleep quality, energy, mood, soreness — each on a simple 1–5 scale); (2) Adapted OSTRC-H questionnaire (Oslo Sports Trauma Research Centre Health questionnaire, overuse injury screening — 4 standardised questions per body region the athlete flags as relevant). Results stored in Supabase per athlete per day. Coach sees trends in athlete profile. Mid-future — implement after core session logging is stable. | ⬜ Open |
| P3 | Language selection on first open (German / English minimum) | ⬜ Open |
| P3 | Push notifications (session reminders, coach messages) | ⬜ Open |

### Data Flow (Athlete App → Coach App)
- Athlete logs sets → stored in Supabase (`athlete_session_logs` table)
- Coach sees adherence rate + planned vs. actual comparison in the Analysis tab (Athlete Profile)
- Borg CR10 post-session rating → stored alongside planned Borg CR10 target from wizard → coach sees planned vs. perceived load gap in the Analysis tab (RPE comparison panel)
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
| **Allow athlete to add/replace exercises** | Athlete can swap exercises in-session using the Progressions & Regressions chain defined by the coach in the exercise database. When disabled, the "Need an adjustment?" affordance is hidden in the athlete app. | 🟠 Phase 2 |
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
