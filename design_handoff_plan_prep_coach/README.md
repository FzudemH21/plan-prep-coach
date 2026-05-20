# Handoff: Plan Prep Coach — Design System + Branded PDF Export

## Overview

This bundle contains a complete design system for **Plan Prep Coach** (a periodization tool for strength & conditioning coaches) and a polished, branded **training-plan PDF** that coaches export for their athletes.

The deliverable to ship into the codebase is two-fold:
1. **Adopt the design tokens, type system, and component patterns** across the web app so the whole product reads like one document.
2. **Implement the PDF export** so the export button in the existing app renders a real PDF that visually matches `pdf/index.html`.

---

## About the Design Files

The files in this bundle are **design references created in HTML/JSX** — high-fidelity prototypes showing intended look, layout, and behavior. They are **not production code to copy directly**.

The task is to **recreate these designs in the existing Plan Prep Coach codebase** (Vite + React + TypeScript + Tailwind + shadcn/ui, per the repo at the time of handoff), using the patterns already established there. Wherever a token, component, or pattern in this bundle conflicts with the existing codebase, **prefer extending the existing system** rather than introducing parallel infrastructure.

For the PDF specifically, the JSX in `pdf/VariationB-BoldSport.jsx` is a layout blueprint, not a runtime artifact — it uses inline Babel transpilation, plain `<div>` page boxes, and CSS variables. The production implementation should use a real PDF pipeline (see "PDF Implementation Strategy" below).

---

## Fidelity

**High-fidelity (hifi).** All colors, type, spacing, layout proportions, and typography are final. The intensity scale, accent token, mesocycle wheel, type ramp, and PDF layouts should be implemented pixel-faithfully. Sample copy and athlete data is illustrative — the real values come from the database.

---

## Files in This Bundle

```
design_handoff_plan_prep_coach/
├── README.md                        ← this file
├── design_system/
│   ├── README.md                    Full system docs: voice, color, type, spacing, iconography
│   ├── SKILL.md                     How another agent should use the system
│   ├── colors_and_type.css          THE token source of truth (CSS custom properties)
│   ├── assets/
│   │   ├── felyz-logo.png           Sample coach logo (placeholder; coaches upload their own)
│   │   └── felyz-logo-black.png
│   └── preview/                     Design-review cards (open each in a browser)
│       ├── type.html
│       ├── colors.html
│       ├── spacing.html
│       ├── components.html
│       └── brand.html
└── pdf/
    ├── index.html                   The PDF prototype — open in a browser, renders A4 pages
    ├── VariationB-BoldSport.jsx     Page layouts (cover, goals, arc, mesocycle, why)
    └── sample-data.js               THE data contract — read this carefully
```

**Recommended reading order for the implementer:**
1. `design_system/README.md` — voice, content rules, visual foundations
2. `design_system/colors_and_type.css` — every token
3. `pdf/sample-data.js` — the data shape the PDF expects
4. `pdf/VariationB-BoldSport.jsx` — page-by-page layout
5. `pdf/index.html` — open it in a browser to see the final output

---

## Design Tokens (canonical)

All values live in `design_system/colors_and_type.css`. Port them to the codebase as either CSS variables in `src/index.css` (preferred — extends what's already there) or as Tailwind theme extensions.

### Colors

#### Neutrals & ink
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#ffffff` | Page background |
| `--bg-elev` | `#fafaf9` | Elevated card / paper |
| `--bg-muted` | `#f4f4f3` | Subtle card surface |
| `--bg-inverse` | `#0c0a09` | Inverse panel |
| `--fg` | `#0c0a09` | Primary text |
| `--fg-1` | `#18181b` | Strong text |
| `--fg-2` | `#44403c` | Secondary text |
| `--fg-3` | `#78716c` | Tertiary / captions |
| `--fg-4` | `#a8a29e` | Placeholder |
| `--border` | `#e7e5e4` | Default border |
| `--border-strong` | `#d6d3d1` | Emphasized border |
| `--ink` | `#0c0a09` | Cover header, dark surface |
| `--ink-soft` | `#1c1917` | Slightly softer dark |
| `--ink-fg` | `#fafaf9` | Foreground on ink |

#### Brand accent (coach-configurable)
| Token | Default | Use |
|---|---|---|
| `--accent` | `#e2522b` | **Coach-owned.** Every coach sets their own. Used for eyebrows, links, primary CTAs, watermarks. |
| `--accent-hover` | `#c8431f` | Hover state |
| `--accent-soft` | `#fdebe2` | Tint for focus rings, soft chips |
| `--accent-fg` | `#ffffff` | Foreground on accent |

> **Critical:** Components must read `var(--accent)`, never hard-code the orange. The accent is a per-coach setting (see `samplePlan.coach.accent`) and re-skins the entire app + PDF.

#### Intensity scale (sacred — meaning, not decoration)
| Token | Hex | Meaning |
|---|---|---|
| `--intensity-off` | `#f2f2f2` | Rest day |
| `--intensity-deload` | `#2e7a2e` | Deload (dark green) |
| `--intensity-easy` | `#33cc33` | Easy |
| `--intensity-easy-moderate` | `#3d8df0` | Easy–moderate |
| `--intensity-moderate` | `#f7c512` | Moderate |
| `--intensity-moderate-hard` | `#f78d12` | Moderate–hard |
| `--intensity-hard` | `#e22424` | Hard |
| `--intensity-extremely-hard` | `#8f1f1f` | Peak / max effort |

Each has a `-soft` variant (24%-equivalent tint) for backgrounds that still carry text. **Never substitute these for brand color.** They mirror what's already in `src/index.css` HSL form — keep them consistent.

#### Mesocycle wheel (8 distinct hues)
`--meso-1` … `--meso-8`: `#2e6fcf, #1f9b6e, #8a3fcf, #e07a1f, #cf2e2e, #b3c526, #1f9bcf, #cf2e9b`. Used to differentiate mesocycles in the arc, headers, and accents.

#### Semantic
`--success #1f9b6e`, `--warning #f7c512`, `--danger #e22424`, `--info #3d8df0`.

### Typography

| Token | Family | Use |
|---|---|---|
| `--font-sans` | Geist (fallback Inter) | Product UI + PDF body |
| `--font-display` | Fraunces | Editorial PDF headlines (Variation A only — not currently used in shipped PDF) |
| `--font-mono` | Geist Mono | Numerics, dates, microcycle labels |

Geist and Fraunces are loaded from Google Fonts. In production, self-host or use `@fontsource/geist` for resilience.

#### Type scale (px-anchored, used for both screen and print)
`--text-xs 11`, `--text-sm 13`, `--text-base 15`, `--text-md 17`, `--text-lg 20`, `--text-xl 26`, `--text-2xl 34`, `--text-3xl 44`, `--text-4xl 60`, `--text-5xl 80`.

#### Line-height & tracking
`--leading-tight 1.05`, `--leading-snug 1.2`, `--leading-normal 1.45`, `--leading-relaxed 1.6`.
`--tracking-tight -0.02em`, `--tracking-wide 0.04em`, `--tracking-wider 0.12em` (eyebrow caps).

#### Semantic type roles (utility classes; see `colors_and_type.css`)
`.t-display, .t-h1, .t-h2, .t-h3, .t-h4, .t-eyebrow, .t-body, .t-body-sm, .t-caption, .t-quote, .t-mono, .t-num`. Use these for hierarchy rather than raw font/size combos.

### Spacing (8pt-derived)
`--space-1 4`, `--space-2 8`, `--space-3 12`, `--space-4 16`, `--space-5 20`, `--space-6 24`, `--space-7 32`, `--space-8 40`, `--space-9 56`, `--space-10 80`.

### Radii
`--radius-sm 4`, `--radius 8`, `--radius-md 10`, `--radius-lg 14`, `--radius-xl 20`, `--radius-pill 999`.

### Shadows
- `--shadow-xs`, `--shadow-sm`, `--shadow`, `--shadow-lg` — UI shadows, never colored.
- `--shadow-print` — `0 0 0 1px rgba(15,12,9,0.06), 0 18px 50px rgba(15,12,9,0.18)` — only for paper-on-grey PDF previews.

---

## Voice & Content Rules (full copy in `design_system/README.md`)

- **Direct, athletic, unpadded.** No hedging.
- **Active verbs**, named exercises, concrete numbers ("5×3 @ 85%", not "heavy work").
- **No emoji.** No sport pictograms. No decorative icons.
- **Coach is named** — sign-off carries authority.
- The PDF intentionally **omits per-day sets/reps prescriptions** on the rep-week (those live in the coach's app, not the athlete handout).

### Naming conventions
- **Mesocycle** — capitalized noun ("Accumulation", "Realization", "Taper")
- **Microcycle** — "MC 04" or "MC 04 · Deload"
- **Session** — body part + focus, em-dash ("Lower Body — Maximal Strength")
- **Exercise (PDF)** — just the lift, no sets/reps ("Squat / RDL / Lunge")
- **Method** — title-cased noun phrase ("Heavy Compound Strength (>85% 1RM)")

---

## Iconography

The product is **deliberately icon-light**.
- Use **Lucide** only (already in the codebase).
- Stroke weight: **1.75–2px** to match Geist.
- Color: `currentColor`. Never branded.
- Sized 16/20/24 on a 4px grid.
- **No emoji**, **no sport pictograms**.
- The only branded mark is the **coach's own logo**, supplied at runtime via `samplePlan.coach.logo`.

---

## PDF: Layout Spec (page by page)

A4 portrait, 794×1123 at 96dpi, 48px margins. The PDF is fully data-driven — page count adapts to `samplePlan.plan.mesocycles[]` and `samplePlan.methods[]`.

### Page 1 — Cover
- Full-bleed `--ink` background, white text.
- Coach logo top-left (white-inverted via `filter: invert(1)`).
- Plan title (`samplePlan.plan.title`) at `--text-5xl`, weight 800, tracking `-0.045em`.
- Athlete name + sport + team below, `--font-sans`, weight 700.
- Date strip: start date / end date / total days (mono, `--text-sm`, tracking `0.18em`, uppercase).
- Microcycle count badge: "12 Microcycles" (or whatever the count is — `samplePlan.plan.mesocycles.flatMap(m => m.microcycles).length`).
- Footer: `Created with plan-prep-coach`, eyebrow caps, `--fg-3`.

### Page 2 — Goals
- Header: "Goals" eyebrow + plan title repeat.
- Tree chart layout: each `samplePlan.plan.goals[]` is a parameter (top), with operationalization subtitle and 1–N sub-goals (current → target) connected by SVG lines.
- Adaptive grid: 1 column for ≤2 goals, 2 columns for 3–4, 3 for 5+.
- Each sub-goal: testable metric, current value, target value, unit. No icons.

### Page 3 — Mesocycle Arc
- Header: "The Arc"
- All mesocycles stacked vertically. Each is a card:
  - 6px-wide colored stripe (using the mesocycle's intensity color, **not** the `--meso-N` accent — the stripe communicates the dominant intensity character of the block)
  - Mesocycle ordinal ("01") in mono
  - Mesocycle name (`--text-2xl`, weight 800)
  - Intensity badge (using the same intensity color, white text)
  - Microcycle count + total days
  - Description (`--text-sm`, `--fg-2`, line-height 1.55)
- Paginates: max 4 per page. Overflow continues on page 3b.

### Page 4..N — Per-Mesocycle Detail (one mesocycle per page)
Each mesocycle gets a full page:
- **Header strip**: mesocycle ordinal + name (large, weight 800), intensity badge, MC count, total days.
- **Description block**: 14.5px body with a 6px-wide left accent bar in the mesocycle's intensity color.
- **Microcycle Intensity Progression** (column chart, height 200px):
  - One bar per microcycle in the mesocycle.
  - Bar height ∝ intensity ordinal (off=0 → extremely-hard=7).
  - Bar fill = intensity color.
  - Intensity name printed inside the bar in white when bar is tall enough; above the bar in `--fg-2` when too short.
  - Bar label below: "MC 04" + day-count.
  - Section header above: "Microcycle Intensity Progression", 12px ink-bold caps.
- **Representative Microcycle** (column chart, height 180px):
  - One bar per day (typically 7) in the *representative microcycle* (`meso.representativeMicrocycle` or first one).
  - Bar height + color = day intensity.
  - Day label below ("MON", "TUE"…) + focus subtitle + main exercises (no sets/reps).
  - Section header above: "Representative Microcycle", 12px ink-bold caps.
- 24px gap between description, intensity chart, rep-week. Rep-week pinned to bottom of page.
- Footer with page number.

### Final Pages — The "Why" (Method Rationales)
- Methods grouped by which parameter they improve.
- 3 methods per page (paginate).
- Each method block: name (weight 800), 2–4 sentence rationale (`--fg-1`, `--text-base`), citations as footnote-style numbered links.

---

## PDF Implementation Strategy

The HTML prototype uses inline Babel — **do not ship that.** Pick one of these production paths:

### Option A — Server-side print (Puppeteer / Playwright)
- Render a Vite/React route (e.g. `/plans/:id/pdf`) that consumes the same data shape as `pdf/sample-data.js`.
- Use `@page { size: A4; margin: 0; }` and `page-break-after: always` on each page block.
- A backend endpoint launches headless Chromium, navigates to the route with an auth token, calls `page.pdf({ format: 'A4', printBackground: true })`.
- ✅ Pixel-perfect with the prototype, easy to iterate, reuses React components.
- ❌ Needs a server with Chromium.

### Option B — `react-pdf/renderer` (client or server)
- Rebuild each page as `<Document><Page>` with `<View>`/`<Text>`/`<Svg>`.
- Tokens map to a JS object passed to styles.
- ✅ No browser needed, runs in Node or in the client.
- ❌ Layout primitives are limited — the column charts and SVG goal-tree need re-implementing.

### Option C — Print stylesheet (no export server)
- The "export" button just opens `/plans/:id/print` and prompts native print → "Save as PDF".
- ✅ Zero infra.
- ❌ Athlete-side experience is worse, fonts/headers depend on the user's browser.

**Recommended: Option A** for a coach-grade product. The existing Vite stack already has React; add a `/print/:planId` route, render exactly what's in `pdf/VariationB-BoldSport.jsx` with real data, and call Puppeteer from a small Node service. The HTML prototype literally becomes the production renderer with auth + data wiring.

---

## State, Data, and the Coach Branding Hook

The single most important runtime contract:

```ts
samplePlan = {
  coach: {
    name: string;
    logo: string;        // URL, white-on-transparent PNG ideally
    accent: string;      // hex, drives --accent
  },
  athlete: { name, sport, team, dob, ... },
  plan: {
    title: string;
    startDate, endDate;
    mesocycles: [{
      ordinal, name, color (intensity token), description,
      microcycles: [{ ordinal, name, intensity, days: [...] }],
      representativeMicrocycle: { days: [{ name, focus, intensity, mainExercises: string[] }] }
    }],
    goals: [{ parameter, operationalization, subGoals: [{ metric, current, target, unit }] }]
  },
  methods: [{ name, parameter, rationale, citations: [{ ref, url }] }]
}
```

Every coach uploads their own logo and chooses their own accent in the coach settings UI. The PDF reads these and re-skins. **No accent should ever be hard-coded.**

---

## Web App — Component Patterns

`design_system/preview/components.html` shows the component vocabulary. Map these to the existing shadcn/ui components in the codebase:

| Pattern | Existing component | Notes |
|---|---|---|
| Primary button | `<Button variant="default">` | Background = `--ink`, FG = `--ink-fg`. Weight 700. |
| Accent button | `<Button variant="default">` with `accent` class | Background = `--accent`, FG = `--accent-fg`. Used for "Export PDF" and brand-priority actions. |
| Ghost button | `<Button variant="outline">` | 1px `--border-strong`. |
| Chip / tag | New component | Pill, `--radius-pill`, weight 700, tracking `0.06em`, uppercase, 11px. |
| Intensity block | New component | `--radius-sm`, intensity background, white FG (or `--fg` on light intensities `off` and `easy`). |
| Card | shadcn `<Card>` | `--radius-md`, `1px --border`, padding 20–22px. |
| Eyebrow text | Span, `.t-eyebrow` class | 11px, weight 700, tracking `0.18em`, uppercase, `--fg-3`. |
| Section header | Existing or `.t-h2` | Weight 800, tracking `-0.02em`. |

Inputs should use `--radius`, `1px --border-strong`, and on focus draw a `3px var(--accent-soft)` ring + change border to `--accent`.

---

## Interactions & Behavior (web app)

These are referenced in the existing app and confirmed by the design system; no interactions are introduced by this handoff except the PDF export button.

- **Export PDF** — primary action on plan detail. Calls the chosen PDF backend, returns a blob, triggers download named `{athlete-slug}_{plan-slug}_{YYYY-MM-DD}.pdf`.
- **Coach branding settings** — form for coach to upload logo + pick accent color from a curated palette OR enter hex. Persists to `coach.accent` and `coach.logo`.
- **Hover/focus** — buttons darken to `--accent-hover` / `--ink-soft`. Inputs gain `3px --accent-soft` ring.

---

## Assets

- `design_system/assets/felyz-logo.png` — sample coach logo (white-on-transparent). **Replace at runtime per coach.**
- `design_system/assets/felyz-logo-black.png` — black variant.
- No other branded assets in this bundle. **No stock photography.** **No icon set beyond Lucide.**

---

## Validation Checklist

When implementing, confirm:
- [ ] All colors come from `colors_and_type.css` tokens. No hard-coded hex outside the CSS file.
- [ ] All accent uses read `var(--accent)` — re-skinning a coach to a new accent re-skins the whole app + PDF.
- [ ] All intensity uses come from `--intensity-{key}` — never substituted by brand colors.
- [ ] Type uses semantic classes (`.t-h1`, `.t-eyebrow`, etc.) or the equivalent Tailwind utilities, not raw font/size pairs.
- [ ] PDF page is exactly A4 (794×1123 @ 96dpi or `210mm × 297mm`).
- [ ] Coach logo handles both light and dark surfaces (use `filter: invert(1)` on dark cover).
- [ ] No emoji anywhere in product UI.
- [ ] No sport pictogram icons.
- [ ] Footer reads "Created with plan-prep-coach" on every PDF.
- [ ] PDF page count adapts to `mesocycles.length` and `methods.length`.
- [ ] Per-day rep-week shows focus + main exercises only — no sets/reps.

---

## Questions to Resolve Before Shipping

1. **PDF backend choice** — Option A/B/C above? Affects infra.
2. **Final coach-settings UI** for accent + logo — does the existing app already have it, or new work?
3. **Print pipeline auth** — if Option A, how does the headless Chromium authenticate to fetch the plan?
4. **Localization** — sample copy is English. Day names, dates, "Microcycles" word need an i18n strategy.
5. **Font self-hosting** — Google Fonts at runtime or `@fontsource`?
