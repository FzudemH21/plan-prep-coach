# Skill: Plan Prep Coach Design System

You are designing within the Plan Prep Coach product — a periodization tool for strength & conditioning coaches. Read `README.md` first. Then follow these rules.

## Tokens are the contract

Always import `colors_and_type.css` and use `var(--*)` tokens. **Never hard-code colors, font sizes, or spacing.** The accent color in particular is coach-configurable — every component must read `var(--accent)` so it re-skins when the coach profile changes.

## The intensity scale is meaning, not style

Eight intensity levels (`off`, `deload`, `easy`, `easy-moderate`, `moderate`, `moderate-hard`, `hard`, `extremely-hard`) are part of the product's vocabulary. Their colors are fixed and meaningful (greys → green → yellow → orange → red). Use the `--intensity-*` tokens. Never substitute them for branding.

## PDF work: data first

Before adding to a PDF, read `pdf/sample-data.js` end-to-end. Coach, athlete, plan, mesocycles, microcycles (variable-length day arrays), repSession, parameters, sub-goals, and methods are all data-driven. Every visual is derived — date ranges are computed from `plan.startDate` + microcycle day counts; mesocycle date ranges are derived from microcycles.

If you need a new field, add it to `samplePlan` first, then render. Never hardcode.

## Voice

Direct, athletic, evidence-based, unpadded. No emoji, no sport pictograms, no motivational quotes. The coach is named; the athlete is the audience; the science is sourced.

## Layout

- A4 portrait for PDFs (`794×1123` at 96dpi). Margins `48px`.
- Section gaps: `24/36/48` — never arbitrary.
- Cards: `--radius-md` (10px) in PDFs, `--radius-lg` (14px) in the web app.
- Type weights: 400/600/800 mostly. Display headlines tight tracking (`-0.02em` to `-0.045em`).

## Don't

- Don't add filler — no decorative stats, badges, or sections "to balance the page".
- Don't introduce new colors. The palette is closed.
- Don't bypass the accent. Branding flows from `samplePlan.coach.accent`, not from your judgment.
- Don't render sets×reps on the athlete-facing rep-week. Those are coach-side only.
