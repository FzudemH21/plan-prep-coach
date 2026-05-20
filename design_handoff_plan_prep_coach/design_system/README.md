# Plan Prep Coach — Design System

A design system for **Plan Prep Coach**, a tool that helps strength & conditioning coaches build periodized training plans for individual athletes — and export them as branded PDFs the athlete actually wants to read.

This system is the source of truth for color, typography, spacing, components, and PDF/web layout patterns used across the product.

---

## Index

| File | What it is |
|---|---|
| `colors_and_type.css` | All design tokens — colors, type families, scale, radii, shadows, spacing |
| `pdf/index.html` | Live "Bold Sport" training-plan PDF, fully data-driven |
| `pdf/sample-data.js` | Reference data shape — coach, athlete, plan, mesocycles, goals, methods |
| `pdf/VariationB-BoldSport.jsx` | Reference PDF implementation (cover → goals → arc → mesocycle pages → why) |
| `preview/` | Design-system review cards (type, color, components, brand) |
| `ui-kit/` | Web-app component library mockup |
| `SKILL.md` | How another agent should use this design system |

---

## CONTENT FUNDAMENTALS

The product writes for **two audiences in one document**:
- The **athlete** (primary) — wants clarity, motivation, "what do I do today?"
- The **coach themselves / peers** — want the science, the rationale, the citations

The PDF must serve the athlete first while still respecting the coach's expertise. That tension drives every copy decision below.

### Voice

- **Direct, athletic, unpadded.** Never "we believe that potentially…". Always "this block builds X."
- **Active verbs** for action ("Squat", "Sprint", "Recover").
- **Evidence-based, not hype.** Cite real research, name the parameter being trained.
- **Coach is named, not anonymous.** Sign-off carries authority.
- Numbers are concrete: "5×3 @ 85%", not "heavy work".

### Naming conventions

| Concept | Naming pattern | Example |
|---|---|---|
| Mesocycle | Block name (capitalized noun) | "Accumulation", "Realization", "Taper" |
| Microcycle | "MC NN" or "Week NN", optional `· Deload` suffix | "MC 04 · Deload" |
| Day session | Body part + focus, em-dash separated | "Lower Body — Maximal Strength" |
| Exercise (PDF) | Just the lift / drill, no sets/reps | "Squat / RDL / Lunge" |
| Prescription (PDF) | Sets×reps @ %1RM | "5×3 @ 85–90%" |
| Method | Title-cased noun phrase | "Heavy Compound Strength (>85% 1RM)" |
| Parameter | Title-cased noun | "Maximal Strength", "Acceleration" |

### Hierarchy of information (PDF cover → why)

1. **Cover** — plan title, athlete name, dates, microcycle count, coach
2. **Goals** — main parameters → sub-goals (testable, with current/target)
3. **Arc** — every mesocycle in sequence, with intensity character
4. **Mesocycle pages** — one per block: description + microcycle progression chart + representative microcycle
5. **Why** — methods grouped by parameter they improve, with citations

### What we omit on purpose

- Per-day sets/reps prescriptions on the rep-week (those live in the coach's app, not the athlete handout)
- Decorative iconography (sport pictograms, motivational quotes)
- Stats slop (KPIs that aren't actionable)

---

## VISUAL FOUNDATIONS

The aesthetic is **clean athletic** — confident, current, unfussy. Closer to a pro-team document than a clinical report.

### Color

| Role | Token | Use |
|---|---|---|
| Background | `--bg`, `--bg-elev`, `--bg-muted` | Page, card, subtle surface |
| Ink (deep) | `--ink`, `--ink-fg` | Cover header, dark mesocycle headers, primary buttons |
| Foreground | `--fg`, `--fg-1…4` | 4-step text hierarchy |
| Border | `--border`, `--border-strong` | Card edges, dividers |
| **Brand accent** | `--accent` | Coach-configurable. Drives every accent in the PDF — eyebrows, watermark, hyperlinks, primary CTAs |
| Intensity scale | `--intensity-{key}` | 8 steps: off → deload → easy → easy-moderate → moderate → moderate-hard → hard → extremely-hard |

The **intensity scale is sacred** — it is meaning, not decoration. Off is neutral grey, deload is dark green (rest), and the heat-map climbs from green → yellow → orange → red → dark red. Never substitute these colors for branding. Match what's already in `src/index.css`.

The **accent is coach-owned**. Every coach configures their own (`samplePlan.coach.accent`). The PDF re-skins automatically. Never hard-code an accent in components — always read `var(--accent)`.

### Type

- **`var(--font-sans)` — Geist** for product UI and PDF body. Modern, neutral, slightly geometric, designed for product work.
- **`var(--font-display)` — Fraunces** for editorial PDF headlines (Variation A only). Soft, expressive serif.
- **`var(--font-mono)` — Geist Mono** for numerics, codes, dates, microcycle labels — anywhere tabular alignment matters.

Heaviest weights (`800`/`900`) carry the brand. Headlines are tight (`-0.02em` to `-0.045em`). Eyebrow caps are `0.18em–0.32em` tracking, lowercase converted via CSS — never hand-typed in caps.

### Spacing & rhythm

8pt-derived scale (`--space-1` through `--space-10`). Pages are A4 (794×1123 at 96dpi) with 48px margins. Section gaps are `24px / 36px / 48px` — never arbitrary numbers. Card padding is `16px–24px` depending on density.

### Radii

- `--radius-sm` (4px) — pills, badges, intensity blocks
- `--radius` (8px) — buttons, inputs
- `--radius-md` (10px) — cards in the PDF
- `--radius-lg` (14px) — feature cards in the web app
- `--radius-pill` (999px) — chips

### Shadows

`--shadow-print` is specifically tuned for the PDF preview (paper-on-grey effect). UI shadows (`--shadow-sm`, `--shadow`, `--shadow-lg`) are subtle and never colored.

---

## ICONOGRAPHY

The product is **deliberately icon-light**. Real coaches don't talk in icons; they talk in numbers and named exercises. Where icons are needed:

- Use **Lucide** (already in the codebase) — single-stroke, geometric, neutral.
- Stroke weight: 1.75–2px to match Geist's weight.
- Color: `currentColor`, never branded.
- Sized 16/20/24px on a 4px grid.
- **No emoji** in product UI or PDFs (unless a coach explicitly types one in their notes).
- **No sport pictograms** — they age badly and bias the document toward one discipline.

The only "branded" mark is the **coach's own logo**, surfaced via `samplePlan.coach.logo`. Currently scaffolded with `felyz` — a sample coach studio. Replace with the actual coach's mark at runtime.

---

## How to use this system

1. **Building UI for the web app** → start from `ui-kit/` and the tokens in `colors_and_type.css`.
2. **Building or modifying the PDF** → read `pdf/sample-data.js` (the data contract), then `pdf/VariationB-BoldSport.jsx` (the layout reference).
3. **Building something new** → read `SKILL.md` first.
