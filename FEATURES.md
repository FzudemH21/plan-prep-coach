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
| 🔴 Now | **Coach app translation (German / English)** — i18n infrastructure done, language picker done, CoachProfilePage + AthleteAppLayout + Login/Signup/Home/SessionLibrary already translated. All coach mobile pages and most coach desktop pages still have hardcoded strings — need `useTranslation` + en/de key extraction. | 🚧 In Progress |
| 🔵 Future | **Coach mobile — Today tab** — New 4th bottom nav tab. `CoachMobileTrainingPage.tsx` already exists (orphaned, no nav link) with a working all-athletes today overview (training vs. rest day). Wire it into the nav as "Today", add group selector (matches desktop squad dashboard groups), add wellness flag chips on athlete rows (amber/red for illness or low composite score). | ⬜ Open |
| 🔵 Future | **Coach mobile — "Today" jump button in training calendar** — A persistent button (e.g. pill/fab) in the athlete training tab that scrolls/jumps the week navigator back to the current week so the coach always has a one-tap way to return to today after browsing past or future weeks. | ✅ Done |
| 🔵 Future | **Coach mobile — tests & events in athlete training calendar** — Display test and event entries in the per-day cards of the athlete training tab (matching the desktop calendar). Add/delete/edit tests and events inline from the mobile athlete profile: add from the day card action buttons, edit by tapping an existing entry, delete via swipe or long-press. | ⬜ Open |
| 🔵 Future | **Pre-publish security hardening** — replace `dangerouslyAllowBrowser`, move API key to Edge Function, rate limiting, full RLS audit | ⬜ Open |
| 🔵 Future | SaaS & monetization (login, packages, Stripe) | ⬜ Open |
| 🔵 Future | Booking system (athletes book with coach) + coach calendar | ⬜ Open |
| 🔵 Future | Payment system Coach↔Athlete (marketplace model) | ⬜ Open |
| 🔵 Future | **🚀 App Store / Play Store launch** — Capacitor wrapper for athlete app + coach mobile app, both published to iOS and Android stores simultaneously. This is the official product launch. | ⬜ Open |
| 🔵 Future | **Push notifications** — session reminders, coach messages, test-day alerts. Unblocked by App Store distribution (native push). | ⬜ Open |
| 🔵 Future | **PDF exports** — printable reports per athlete: monitoring summary, training plan overview, performance progress. | ⬜ Open |
| 🔵 Future | **Athlete Management System + external data integrations** — expanded AMS beyond what's already built: wearable data ingestion (Oura, Whoop, Apple Fitness, Garmin/HRV4Training), GPS platforms (Catapult, STATSports), force plate systems (VALD), VBT devices. Surfaced in Analysis tab. Elite/enterprise tier. | ⬜ Open |

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
| **XLSX data export (per athlete)** | Contextual export buttons in Monitoring, Performance, and Analysis tabs. SheetJS, runs in browser. Monitoring sheet (wellness 5-item + composite + z-score, pain, illness), Performance sheet (metrics over time, body metrics, e1RM history), Analysis sheet (session log, sRPE, planned vs actual AU, adherence). |
| **Squad / Group dashboard** | Card + list view for all athletes in a group. Traffic-light wellness (composite + z-score), pain/illness flags, custom monitoring columns, planned training sessions with Borg intensity pill, tests/events with overflow tooltip, week AU + avg, date navigator with calendar popover. Group switching via sidebar. |
| **Invite flow** | Coach creates athlete connection → invite code stored in `athlete_connections`. Athlete opens `/athlete/connect?code=…` → `AthleteConnectPage` validates code, creates Supabase auth account (or signs in if already registered), links connection row. Redirects to `AthleteOnboardingPage`: 3-step flow (name → birthday + sex → sport/team/activity level), skippable, saves to `profile_data`. Language selection and profile photo tracked separately as Future items. |
| **Session Library** | Reusable session library (`/templates/sessions`). `SessionLibraryEntry` stores name, method, sections, exercises, and coach-defined custom columns. `useSessionLibrary` hook with localStorage persistence (`ppc-session-library`). `SaveToLibraryDialog` (name + method dropdown + custom column fields). `SessionDetailModal` (sections → exercises with params, custom column badges). `SessionLibraryPage` (searchable/sortable table, add/remove custom columns with text/select/textarea types, duplicate, delete). Save-to-library button (`BookmarkPlus`) in `WorkoutSessionSheet` header (wizard session modal) and in `SessionColumnView` step-2 session cards. Nav link "Session Library" in sidebar. i18n keys in `en.json` / `de.json`. |
| **i18n Phase 2 — CoachProfilePage + AthleteAppLayout** | All hardcoded strings extracted from `CoachProfilePage.tsx` (BrandingCard, SettingsTab, ProfileTab, main tabs) and `AthleteAppLayout.tsx` (splash screen, nav labels, suspended/removed/sign-out screens) into `en.json` / `de.json` and replaced with `t()` calls. NAV_PATHS refactored to type-safe `labelKey` with `as const`. |
| **Language selection on first open** | `LanguagePickerModal` shown on very first app open (before `AppRoutes`). Stores choice in `localStorage` under `ppc-language`. `isFirstOpen()` utility in `src/i18n/index.ts`. Language picker also accessible from coach Profile page at any time. English and German supported. |
| **Coach Mobile App — athlete overview + session edit** | Mobile-first coach app at `/coach-mobile`. Athlete list with connection status. Per-athlete profile: training calendar (week navigator, session cards with intensity badge, completed-session green display matching athlete app: bg-green-50/border, "Completed · X min · RPE X · sRPE: X AU"). Session edit page: view/edit toggle, inline set table, parameter config sheet (filtered — no `_unit` params), add exercise from library, ⋮ menu per exercise (Details / Change Exercise / Duplicate / Delete), exercise name click → detail sheet (video + description), ExercisePickerSheet centered on desktop. Supabase-backed via `athlete_session_logs`. |
| **Coach Mobile App — in-person session logging** | `CoachMobileSessionLoggingPage` mirrors the athlete session flow: overview → section intro → active workout (set logging, superset grouping, rest timer) → done screen with Borg CR10 rating. Coach logs on behalf of an athlete — writes identical data to `athlete_session_logs` using the coach's auth but the athlete's `connection_id`. Supabase RLS policies added for coach INSERT/UPDATE/DELETE. Session appears as completed in both athlete app and coach mobile immediately after logging. |
| **Coach Mobile App — chat (Messages tab)** | Messages tab added to coach mobile bottom nav with live unread badge (15-second polling via `useUnreadCounts`). `CoachMobileMessagesPage`: inbox listing all connected athletes with per-athlete unread count badges and "Not yet connected" dimmed section. `CoachMobileAthleteThreadPage`: full real-time chat thread (`callerRole: 'coach'`), text + file attachments, day separators, read receipts, messaging-disabled notice. MessageCircle shortcut button in athlete profile header (only shown when athlete has connected). Uses existing `useChat` hook + `chat_messages` Supabase table. |
| **Athlete app — exercise detail on name click** | In `AthleteSessionPage`, exercise name is now a tappable button (overview + active phases) that opens the existing exercise detail sheet (video + description). Info icon removed. Circuit exercises remain non-tappable (name shown as plain text). |
| **Coach mobile — plan assignment on phone** | 2-step flow: pick program → pick start date + confirm. All mesocycles included, sessions date-shifted and synced via `syncAthleteSchedule`. "Assign Program" button in athlete Training tab. |
| **Coach mobile — "Today" jump button in training calendar** | Floating pill FAB in the athlete Training tab; only visible when not on the current week; tapping resets the week navigator to today. |
| **Coach Mobile App — notification bell** | Bell icon in the top bar between the business name and coach avatar. Red badge shows count of unseen activity items. `useCoachActivityFeed` hook fetches last 7 days of session completions + daily check-in submissions across all connected athletes from Supabase. Wellness/illness flags colour-coded (red for illness/low composite <2.5, amber for pain). Unseen count tracked via `ppc-coach-activity-seen-at` localStorage timestamp, reset to 0 when sheet opens. `CoachNotificationSheet` bottom sheet lists items chronologically: athlete name, description, time-ago, coloured icon; tapping navigates to that athlete's profile. |
