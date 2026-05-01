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
| 🟡 Soon | Coach Profile & Onboarding (AI conversation to learn coaching philosophy, AI asks follow-up questions, result saved as coach profile and reviewable) | 🔄 In Progress – onboarding flow, skip with data save, coach profile page (editable), voice input all working. Supabase-backed (useCoachProfile migrated). Missing: Anthropic API key valid for AI conversation. |
| 🟡 Soon | Supabase migration – remaining localStorage data | ✅ Done – Auth ✅, Coach Profile ✅, Documents ✅, Training Programs ✅, Parameters DB ✅, Toolbox/Methods DB ✅, Templates ✅, Athlete Database ✅, Calendar Events ✅, Custom Libraries ✅. Wizard session state (macrocycleData etc.) intentionally stays in localStorage as ephemeral working state. |
| 🟡 Soon | Plan uploads for Coach Profile (Excel, PDF, Word and other files uploadable, coach provides context, AI extracts patterns and enriches coach profile) | ⬜ Open |
| 🟡 Soon | AI Autopilot in Wizard (suggestions & pre-filling of intensities, methods, exercises based on coach profile) | ⬜ Open |
| 🟡 Soon | Accumulated Context (automatic comparison of AI suggestion vs. final plan, AI asks targeted follow-up questions on significant deviations — max. 1-2 per plan, skippable, answers fed back as rationale context) | ⬜ Open |
| 🟡 Soon | Voice input for coach (athlete description via voice in athlete profile and wizard start, Web Speech API + Anthropic API) | ✅ Done |
| 🟡 Soon | Masterplanner view – Athlete Calendar (Day 1, Day 2... per weekday) | ✅ Done |
| 🟡 Soon | Tests & Events in Athlete Calendar + sync with Wizard | ✅ Done |
| 🟡 Soon | Document upload + sharing with athletes | 🔄 In Progress – upload, folders, drag & drop working; Supabase Storage backend ✅. Missing: (1) AI analysis of documents (API key needed), (2) sharing with athletes, (3) Obsidian integration (optional future) |
| 🟡 Soon | Programming Templates for training methods | ✅ Done – templates per method in Training Toolbox, Load Template dialog in Wizard Step 4 with preview, editable before loading, save as new template, units displayed, works across mesocycles |
| 🟡 Soon | Column reordering in databases (drag & drop) | ✅ Done |
| 🟠 Later | Goal Management + test notifications | ⬜ Open |
| 🟠 Later | Date-independent plan (template mode) | ⬜ Open |
| 🟠 Later | Inline Document Viewer (preview PDFs and other supported file types directly inside the app instead of opening a new browser tab) | ⬜ Open |
| 🔵 Future | Athlete App (mobile, separate) | ⬜ Open |
| 🔵 Future | Athlete Management System (standalone area: athlete profiles, progress tracking, communication, wearable data. Incl. AI analysis: correlations between completed training and athlete progress — coach can ask how effective a program was, which methods had the greatest effect, etc. Requires compliance tracking, test results, and Supabase.) | ⬜ Open |
| 🔵 Future | AI knowledge base + coach philosophy combined (AI has its own sports science knowledge base, coach profile supplements it, AI flags deviations from scientific consensus — learning effect for less experienced coaches) | ⬜ Open |
| 🔵 Future | Wearable & app integrations (Oura, Whoop, Apple Fitness, VBT) | ⬜ Open |
| 🔵 Future | SaaS & monetization (login, packages, Stripe) | ⬜ Open |
| 🔵 Future | Booking system (athletes book with coach) + coach calendar | ⬜ Open |
| 🔵 Future | Payment system Coach↔Athlete (marketplace model) | ⬜ Open |
| 🔵 Future | RAG (Retrieval Augmented Generation) – sports science knowledge base via Supabase Vector DB: coach uploads literature/papers, AI retrieves relevant passages on queries and responds based on real academic sources. Requires Supabase Auth + Cloud Storage (both already set up). | ⬜ Open |

---

## Workflow
- Claude Code (desktop app, Code tab) for all code changes
- Claude Chat (browser) as sparring partner for planning & prompts
- After each milestone: `git add . && git commit -m "..."`
- Context at 70%+ → `/clear` in Claude Code
- New chat session → CLAUDE.md + FEATURES.md are stored in the project root
- External collaborator works in feature branches, opens PRs, Felix reviews and merges
