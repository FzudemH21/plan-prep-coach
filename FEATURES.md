# Feature List – Plan Prep Coach

## Context
I am an athlete, coach, and sports scientist.
I'm developing Plan Prep Coach — a web app that streamlines the training planning process.
**Tech Stack:** React, TypeScript, Vite, Tailwind, shadcn-ui, Supabase
**GitHub:** https://github.com/FzudemH21/plan-prep-coach
I work with Claude Code in the terminal for code changes.
Claude Chat (browser) is my sparring partner for planning, discussion, and prompt formulation.

---

## Open & In Progress

| Priority | Feature | Status |
|---|---|---|
| 🟠 Later | **Squad / Group dashboard** — for each athlete in a group: traffic-light wellness from latest check-in, current-week load vs. SD baseline, compliance rate, flagged pain/illness alerts. Groups already exist in athlete DB. | ⬜ Open |
| 🟠 Later | **XLSX data export (per athlete)** — contextual export buttons placed where data lives: (1) Monitoring tab → daily wellness (all 5 items + composite + z-score), pain incidents, illness episodes; (2) Performance tab → performance metrics over time, body metrics, e1RM history per exercise; (3) Analysis tab → session log with sRPE, planned vs actual AU, adherence summary. Each export produces a focused XLSX (SheetJS, runs in browser). Physios get the monitoring sheet, sports directors get the performance sheet — no one-size-fits-all dump. | ⬜ Open |
| 🟠 Later | Goal Management + test notifications | ⬜ Open |
| 🔵 Future | **Invite flow** — coach sends invite link → athlete onboarding (language, name, birthday, photo) | ⬜ Open |
| 🔵 Future | Progress photos in athlete profile | ⬜ Open |
| 🔵 Future | Language selection on first open (German / English) | ⬜ Open |
| 🔵 Future | Push notifications (session reminders, coach messages) | ⬜ Open |
| 🔵 Future | Athlete Management System (standalone area: profiles, progress tracking, communication, wearable data, AI analysis) | ⬜ Open |
| 🔵 Future | **External data integrations** — GPS platforms (Catapult, STATSports), force plate systems (VALD), HRV apps (HRV4Training, Garmin), wearables (Oura, Whoop, Apple Fitness), VBT devices. Data ingested per session/day and surfaced in Analysis tab alongside internally logged load. | ⬜ Open |
| 🔵 Future | SaaS & monetization (login, packages, Stripe) | ⬜ Open |
| 🔵 Future | **Pre-publish security hardening** — replace `dangerouslyAllowBrowser`, move API key to Edge Function, rate limiting, full RLS audit | ⬜ Open |
| 🔵 Future | Booking system (athletes book with coach) + coach calendar | ⬜ Open |
| 🔵 Future | Payment system Coach↔Athlete (marketplace model) | ⬜ Open |
| 🔵 Future | **Coach Mobile App** — log workout for athlete (in-person PT), athlete overview, quick session edit, coach↔athlete chat | ⬜ Open |

---

## Athlete App — Full Feature Breakdown

> **Architecture:** PWA first (same React/Vite codebase, mobile-optimized routes), Capacitor wrapper later for App Store distribution.
>
> **Intensity scale:** Borg CR10 (0–10, 11 levels) — **migration complete.** Single source of truth: `src/utils/intensityScale.ts`.

### Navigation (4 bottom tabs)
| Tab | Description |
|-----|-------------|
| Today | Home screen — greeting, today's session card, daily intensity, missed session banner |
| Plan | Assigned plan overview — mesocycle/week structure, week calendar strip |
| Messages | Direct chat with coach — text, images, video, documents |
| Profile | Athlete stats, parameter progress charts, activity history |

---

## Athlete Profile — Coach-Side Enhancements

These features extend the existing Athlete Profile page in the coach web app.

### Settings tab (per-athlete coach controls)

| Setting | Description | Build? |
|---------|-------------|--------|
| **Units** | Weight (kg / lb), Distance (km / miles) — used in athlete app display | ✅ Yes |
| **Workout visibility range** | How far ahead athlete can see their plan | ✅ Yes |
| **Feature toggles** | Enable/disable per athlete: Training, Log Activities, Messages, Performance Metrics | ✅ Yes |
| **Allow athlete to add/replace exercises** | Athlete can swap exercises in-session using Progressions & Regressions chain | 🟠 Phase 2 |
| Food journal, Macros, Meal Plan, Tasks | Nutrition & task features | ❌ Out of scope |
| Team Permission | Multi-coach access to one athlete | 🔵 Future |

### Performance Metrics tab (coach view)

| Feature | Description | Build? |
|---------|-------------|--------|
| **Body Metrics tab** | Weight, height, body fat % over time — line chart + entry history | ✅ Yes |
| **Performance/Exercise Metrics tab** | Per-exercise or per-parameter progress chart over time | ✅ Yes |
| **Per-session history** | For each exercise: date, session name, set-by-set log | ✅ Yes |
| **1RM estimation** | Auto-calculate estimated 1RM from logged sets using Epley formula | 🟠 Phase 2 |
| **Auto-update from athlete app** | Athlete logs test result → auto-updates parameter value in coach profile | ✅ Yes |
| **Link to wizard tests** | Test days from wizard appear in metric history with a distinct marker | 🟠 Phase 2 |

---

## Data Flow (Athlete App → Coach App)
- Athlete logs sets → stored in Supabase (`athlete_session_logs` table)
- Coach sees adherence rate + planned vs. actual comparison in the Analysis tab
- Borg CR10 post-session rating → stored alongside planned target → coach sees planned vs. perceived load gap
- Athlete logs a test result → auto-updates the corresponding performance parameter in coach's athlete profile

---

## Workflow
- Claude Code (desktop app, Code tab) for all code changes
- Claude Chat (browser) as sparring partner for planning & prompts
- Felix works solo, pushes directly to `main`
- Context at 70%+ → `/clear` in Claude Code
- New chat session → CLAUDE.md + FEATURES.md are stored in the project root

---

## Done

| Feature | Notes |
|---|---|
| Code Audit Quick Fixes (1-4) | |
| Remove Athleticism DB v1 | |
| Session Card: remove exercise count | |
| Notes field Wizard + Sync | |
| Session Card overflow fix | |
| Notes field Athlete Profile | |
| Bulk Import Exercises (CSV/Excel) | 3-step flow, description optional, consistent storage |
| Dynamic Exercise Detail Modal | Columns from database, no hardcoded fields, directly editable |
| Coach Profile & Onboarding | AI conversation, profile extraction, voice input, skip option, Supabase-backed |
| Supabase migration | Auth, Coach Profile, Documents, Training Programs, Parameters DB, Toolbox, Templates, Athlete Database, Calendar Events, Custom Libraries |
| AI Autopilot in Wizard | Floating chat panel on all 3 wizard pages, proactive opener, voice input, full context |
| Voice input for coach | Athlete description via voice in athlete profile and wizard start |
| Masterplanner view – Athlete Calendar | Day 1, Day 2… per weekday |
| Tests & Events in Athlete Calendar + sync with Wizard | |
| Document upload + sharing with athletes | Upload, folders, drag & drop, Supabase Storage, inline viewer, AI analysis, per-document per-athlete sharing |
| Programming Templates | Templates per method, Load Template dialog with preview, save as new template |
| Column reordering in databases | Drag & drop |
| Circuit Builder | Library creation & editing, ↻ icon, drag & drop into sessions, editable in session card and exercise distribution, save & add to library, duplicate-name conflict resolution |
| Outcome Annotation for completed plans | PlanReviewDialog, stored per assignment, feeds Analysis tab |
| Accumulated Context | Automatic AI comparison of suggestion vs. final plan, targeted follow-up questions |
| Code Audit — systematic review | ExerciseDistribution type consolidated, upsertRow race fix, API model updated, TypeScript improvements |
| RAG via Supabase Vector DB | pgvector, PDF/text extraction, chunking, OpenAI embeddings, useRAGRetrieval hook, wired into all 3 wizard pages |
| AI Semantic Extraction | Superseded by RAG |
| Inline Document Viewer | Full-screen dialog for PDFs and images, open-in-new-tab + download toolbar |
| CSV Import / Export for databases | Exercise Library, Training Methods, Parameter Database |
| Replace intensity scale with Borg CR10 | Single source of truth in `intensityScale.ts`, legacy auto-migration |
| AI knowledge base + coach philosophy | AI has sports science knowledge base, coach profile supplements it |
| Athlete Profile — Performance tab | Body Metrics / Performance / Exercise Metrics tabs with search, table, chart + history |
| Today tab (athlete app) | Greeting, session cards, intensity badge, coming-up strip |
| Session flow (athlete app) | Overview, section navigation, active workout with set-logging, rest timer, superset grouping, circuit tracking, exercise detail sheet, elapsed timer |
| Post-session (athlete app) | Borg CR10 bottom sheet, optional notes, duration, sRPE, saved to athlete_session_logs |
| Planned vs. actual storage | Set-by-set values in sets_logged, session completion + RPE + duration + sRPE all stored |
| Plan tab (athlete app) | Week navigation, Mon–Sun day list, intensity badges, session cards, today highlight, coach-controlled visibility |
| Activity history (athlete app) | Recent sessions visible in Profile tab |
| Profile tab (athlete app) | Initials avatar, sessions completed + streak stats, recent session history, sign out |
| Exercise video playback in session | ⓘ icon opens YouTube thumbnail + description, snapshotted at assignment time |
| Workout completion sync | Green card styling, checkmark, completed stats, inline results grid, refetchLogs after save |
| In-progress session state | started_at set on "Start Workout", coach calendar shows amber pulsing "In progress…" card |
| Locked sessions in coach calendar | Completed and in-progress sessions cannot be dragged, deleted, or cleared |
| Athlete add/delete sets | + / − buttons in session, Added/Removed/Skipped badges in CompletedSessionSheet, planned values crossed out in red |
| Session structure in CompletedSessionSheet | All exercises visible (incl. skipped), sections with headers, supersets grouped, backward-compatible |
| "Each side" indicator in athlete session | "Perform on each side" badge in overview and active workout screens |
| Circuit details in CompletedSessionSheet | Rounds completed, rest between rounds, rest between exercises, coach comments, exercise list with reps/time/distance |
| Rest parameter in coach views + athlete rest timer | Editable rest column in coach grids, rest timer reads per-set and plain-key formats |
| Tests & events visible in Plan tab | Events column in athlete_schedule, test and event cards in Today and Plan tabs |
| Session completion bleed-through fix | Session IDs now include full assignment ID prefix — new sessions on a day with completed sessions no longer inherit old completion state |
| Session copy bug — parameter + visibility data | visibleParams and adhocPlannedParams now copy correctly when duplicating sessions in athlete calendar |
| Athlete load chart | Weekly sRPE bar chart in athlete Profile tab |
| "Each side" indicator in athlete session | "Perform on each side" badge shown in both overview and active workout screens |
| Exercise Progressions & Regressions — coach setup | Modal section built, Supabase table with RLS, useExerciseProgressions hook, drag & drop reorder with level sync, reverse-link automatic |
| Coach calendar exercise swap (Change Exercise) | "Change Exercise" button in athlete calendar session card opens progression/regression chain picker; custom z-[200/210] panel over session sheet, exercise names resolved from libraries context with silent DB back-fill, falls back to full ExerciseLibraryPopup browse |
| CompletedSessionSheet — no-param set display | Removed misleading "No set-by-set data logged" fallback; shows Status column (✓ Done / Skipped) when exercises have no planned parameter values |
| Single-select enforcement in ExerciseLibraryPopup | singleSelect prop enforces radio behavior (ticking a second exercise deselects the first) with explicit confirm button everywhere except wizard exercise selection (EnhancedExerciseDistribution / ExerciseSelectionCell). CircuitBuilderDialog retains multi-select. |
| In-session exercise swap (athlete app) | "⇅ Adjust" button on exercise card opens progression/regression chain bottom sheet; athlete picks substitute, optionally adds reason, exercise replaced for that session only. Swap logged in athlete_session_logs, visible to coach in CompletedSessionSheet. |
| Athlete Profile — Settings tab | Per-athlete coach controls: units (kg/lb, km/miles), workout visibility range, feature toggles (Training, Log Activities, Messages, Performance Metrics), allow exercise swap toggle. UI built on coach side. |
| Daily check-in (athlete app) | McLean 5-item wellness (auto-advance + confirm screen), body map pain selection with inline NRS rating (dot markers, severity colours), OSTRC-H illness symptom checklist (26 items) + overall NRS. Single centered Dialog — no re-animation between steps. Stored in `athlete_daily_checkins` (Supabase). Coach can enable/disable per athlete via Daily Monitoring toggle in Settings tab. |
| Athlete Profile — Monitoring tab | Second tab (opens by default) in athlete profile. 2×2 grid layout: Wellness score card (composite + z-score, expandable 5-item breakdown, ← → date navigator + calendar popover to step through past check-ins) · Illness card · Wellness Trend chart (z-score line + 7-day trailing MA, ±1 SD shaded band, date range picker + 7/14/28/90d quick buttons) · Pain card (full body map front+back with NRS dots, severity list). Transparent body map PNGs. All 4 cards reflect selected day. Coach-side data fetched via `athlete_connection_id`. |
| Exercise Metrics tab (coach view) | Performance tab → Exercise Metrics: left exercise list (search, session count, last date); right panel with estimated 1RM area chart (Epley formula: weight × (1 + (reps + RIR) / 30), time range selector) + collapsible per-session set tables (dynamic param columns, best set highlighted with Trophy icon). Coach tags weight/reps/RIR param roles per exercise via TagDialog; tags stored in localStorage per coach user ID. `useExerciseMetrics` hook parses `athlete_session_logs.sets_logged`, groups by exercise name, computes best e1RM per session. |
| Planned vs. actual RPE / load comparison | Per-session and per-week comparison of planned intensity vs. actual RPE — planned vs. actual sRPE bar chart with toggle in the Analysis tab internal load panel. |
| Wire Athlete Profile → Athlete App: Metrics sync | Body metrics and performance values entered by coach appear in athlete app; values logged by athlete auto-update coach profile. |
| **Wire Athlete Profile → Athlete App: Settings** | Coach-configured per-athlete settings flow to athlete app in real time: calendar visibility range (weeks ahead), session rearranging toggle, Messages tab enable/disable (stored in profile_data, read by athlete app from connection), daily monitoring enable/disable + check-in block configuration. Monitoring templates (save/load/delete, localStorage). Edit support for custom metric blocks. Units, timezone, and full feature-flag wiring deferred to future. |
| **Athlete Profile — Analysis tab** | Time-window driven training analysis dashboard. **Internal Load panel:** sRPE bar chart with 14-day trailing MA line, planned vs. actual sRPE toggle, independent date range + granularity controls. **Adherence stat.** **Stimulus & Performance panel:** small-multiples per-method mini line charts, Sets as synthetic parameter, performance outcomes row (merges coach-entered + athlete self-reported values from Supabase), dots only where test recorded, connectNulls across gaps, independent date range + granularity controls, auto-scaled Y-axis. **AI Analysis Assistant:** floating Bot button (fixed bottom-right), opens 620px wide persistent drawer — chat-first, no analyze button; athlete's 90-day data (load, methods, performance params, monitoring checkins) silently prepended to first API message; markdown rendered properly; conversation survives tab switches; separate displayMessages / apiMessages to avoid consecutive same-role issue. Sports-science system prompt: correct McLean 1–5 scale, connection drawing requires plausible mechanism, ACWR excluded. |
| **Chat (Messages) — text + media** | Real-time 1:1 coach↔athlete chat. Text messages with read receipts and unread badges. Exercise comment messages with tap-to-navigate reference. Media attachments: images (inline thumbnail), video (`<video>` player), documents (download card). Paperclip button + pending-file chips in all three chat surfaces (AthleteProfileView embed, CoachMessagesPage ThreadView, AthleteMessagesPage). Files stored in Supabase Storage `chat/{connectionId}/`, accessed via 7-day signed URLs. Realtime delivery via Supabase postgres_changes subscription. Unread count badge in coach top bar. |
| **Exercise comments & coach feedback** | Text comments from both coach and athlete sides, visible in CompletedSessionSheet. Media attachments (images, video, documents) added alongside text chat — same upload/render pipeline as Messages. |
| **Rest-day message (athlete app Today tab)** | Replaced minimal static card with rich `RestDayCard`: "Planned Rest Day" heading + recovery tagline; "Next session" row showing the first upcoming session name + smart date label (Tomorrow / weekday name / short date); optional "From your coach" section populated from the first calendar event with notes on that day. No schema change — coach notes reuse the existing events mechanism. |
| **Athlete progress visibility (athlete app)** | Profile tab gains Overview / Progress sub-tabs. Progress tab: three inner tabs (Body Metrics / Performance / Exercises) with search bar + list → inline detail drill-down (no Sheets). Detail views show large latest value, area chart, history list. e1RM tags migrated from localStorage to `exercise_param_tags` Supabase table with RLS. Metrics snapshot auto-pushed to `athlete_connections.profile_data` on every Performance tab open (not only on edits). `useAthleteExerciseMetrics` hook for athlete-side data fetching. Date range filter (3M · 6M · 1Y · All chips) in all three detail views — filters chart data points, history list, and session history; empty-state messages adapt to selected range. |
| **Athlete progress visibility — date range filter** | 3M · 6M · 1Y · All quick-select chips in Body Metrics, Performance, and Exercise detail views. Filters chart and history list; session history header shows "(N of M)" count when a range is active; global latest value in the header always reflects the true most-recent entry. |
