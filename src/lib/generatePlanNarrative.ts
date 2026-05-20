/**
 * generatePlanNarrative.ts
 *
 * Uses the Anthropic API to generate athlete-facing narrative text for the
 * PDF export: an introduction, per-mesocycle explanation (optionally with
 * per-microcycle breakdowns), and a closing note.
 * All text is written directly to the athlete in plain, motivating language.
 */

import { sendMessage } from "@/utils/anthropicApi";
import { TrainingProgram } from "@/hooks/useTrainingPrograms";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MicrocycleNarrative {
  name: string;
  narrative: string;
}

export interface MesocycleNarrative {
  name: string;
  narrative: string;
  /** Only present when NarrativeOptions.includeMicrocycles is true */
  microcycles?: MicrocycleNarrative[];
}

export interface PlanNarrative {
  intro: string;
  mesocycles: MesocycleNarrative[];
  closing: string;
}

export interface NarrativeOptions {
  /** Generate per-microcycle breakdowns inside each mesocycle narrative */
  includeMicrocycles?: boolean;
  /** Only generate narratives for these mesocycle IDs (undefined = all) */
  selectedMesoIds?: string[];
}

// ─── AI system prompt ─────────────────────────────────────────────────────────

const SYSTEM = `You are a sports science coach writing an athlete briefing document.
Write directly to the athlete ("you", "your training"). Use clear, motivating, jargon-free language.
An athlete reading this should understand what they will be doing and why — without needing a sports science degree.
Keep each section concise. Return ONLY valid JSON, no markdown, no commentary outside the JSON.`;

// ─── Prompt builders ──────────────────────────────────────────────────────────

type RawMeso = {
  id?: string;
  name?: string;
  weeks?: number;
  intensity?: string;
  microcycles?: Array<{ id?: string; name?: string; intensity?: string; notes?: string }>;
  notes?: string;
};

function extractMesos(program: TrainingProgram, selectedIds?: string[]): RawMeso[] {
  const all = (
    (program.mesocycleData as { mesocycles?: unknown[] } | null)?.mesocycles ?? []
  ) as RawMeso[];
  if (!selectedIds || selectedIds.length === 0) return all;
  return all.filter((m, i) => selectedIds.includes(m.id ?? `meso_${i}`));
}

/** Extract any free-text coach notes scattered across the plan data */
function extractCoachNotes(program: TrainingProgram): string {
  const parts: string[] = [];

  // Top-level primary goal / notes
  if (program.primaryGoal) parts.push(`Primary goal: ${program.primaryGoal}`);

  // Smart goals with descriptions
  const smartGoals = program.macrocycleData?.smartGoals ?? [];
  smartGoals.forEach((g: { description?: string; rationale?: string }) => {
    if (g.description) parts.push(`Goal: ${g.description}`);
    if (g.rationale) parts.push(`Goal rationale: ${g.rationale}`);
  });

  // Sub-goals
  const subGoals = program.macrocycleData?.subGoals ?? [];
  subGoals.forEach((sg: { label?: string; description?: string; notes?: string }) => {
    if (sg.notes) parts.push(`Sub-goal note (${sg.label ?? ""}): ${sg.notes}`);
  });

  // Mesocycle-level notes
  const rawMesos = (
    (program.mesocycleData as { mesocycles?: unknown[] } | null)?.mesocycles ?? []
  ) as Array<{ name?: string; notes?: string; microcycles?: Array<{ name?: string; notes?: string }> }>;
  rawMesos.forEach((m) => {
    if (m.notes) parts.push(`Phase "${m.name ?? ""}" notes: ${m.notes}`);
    (m.microcycles ?? []).forEach((mc) => {
      if (mc.notes) parts.push(`Microcycle "${mc.name ?? ""}" notes: ${mc.notes}`);
    });
  });

  return parts.length > 0 ? parts.join("\n") : "";
}

function buildPrompt(program: TrainingProgram, mesos: RawMeso[], opts: NarrativeOptions): string {
  const macro = program.macrocycleData;

  const goals = macro?.smartGoals
    ?.map((g: { description?: string }) => g.description)
    .filter(Boolean)
    .join("; ") ?? program.primaryGoal ?? "Improve overall performance";

  const methods = [
    ...(macro?.selectedMethods ?? []),
    ...((macro?.manuallyAddedMethods ?? []).map(
      (m: { name?: string; method?: string }) => m.name ?? m.method ?? ""
    )),
  ].filter(Boolean).join(", ");

  const coachNotes = extractCoachNotes(program);

  const mesoList = mesos.map((m, i) => {
    const micros = m.microcycles ?? [];
    const intensityFlow = micros.map((mc) => mc.intensity ?? "").filter(Boolean).join(" → ");
    const microDetail = opts.includeMicrocycles && micros.length > 0
      ? `\n   Microcycles: ${micros.map((mc, mi) => `[${mi + 1}] ${mc.name ?? `Week ${mi + 1}`} (${mc.intensity ?? "?"})${mc.notes ? ` — note: ${mc.notes}` : ""}`).join(", ")}`
      : "";
    return `${i + 1}. ${m.name ?? `Phase ${i + 1}`}: ${m.weeks ?? "?"} weeks, overall load: ${m.intensity ?? "?"}, progression: ${intensityFlow || "n/a"}${m.notes ? `\n   Coach note: ${m.notes}` : ""}${microDetail}`;
  }).join("\n");

  // Build the expected JSON schema description
  const mesoSchema = mesos.map((m, i) => {
    const micros = m.microcycles ?? [];
    const microSchema = opts.includeMicrocycles && micros.length > 0
      ? `,\n      "microcycles": [${micros.map((mc, mi) => `\n        { "name": "${mc.name ?? `Week ${mi + 1}`}", "narrative": "<1–2 sentences on what this specific week focuses on and how the load feels>" }`).join(",")}
      ]`
      : "";
    return `    { "name": "${m.name ?? `Phase ${i + 1}`}", "narrative": "<2–3 sentences explaining what this phase focuses on and why it matters for the goals>"${microSchema} }`;
  });

  return `
Athlete: ${program.athleteName ?? "the athlete"}
Plan name: ${program.name ?? "Training Plan"}
Duration: ${program.duration?.weeks ?? "?"} weeks
Goals: ${goals}
Training methods: ${methods || "various methods"}
${coachNotes ? `\nCoach notes:\n${coachNotes}` : ""}

Training phases:
${mesoList}

Write a JSON object with exactly this structure:
{
  "intro": "<3–4 sentences introducing what this plan will achieve and how it's structured>",
  "mesocycles": [
${mesoSchema.join(",\n")}
  ],
  "closing": "<2–3 sentences of encouragement and what the athlete should keep in mind throughout the plan>"
}
`.trim();
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildFallback(mesos: RawMeso[], opts: NarrativeOptions): PlanNarrative {
  return {
    intro:
      "This training plan has been carefully designed to help you reach your goals through a structured, progressive approach. Each phase builds on the last, ensuring you develop the qualities needed for peak performance.",
    mesocycles: mesos.map((m, i) => ({
      name: m.name ?? `Phase ${i + 1}`,
      narrative:
        "This phase focuses on developing the key qualities for this stage of your preparation. Follow the prescribed loads and rest periods to get the most out of each session.",
      ...(opts.includeMicrocycles && (m.microcycles ?? []).length > 0
        ? {
            microcycles: (m.microcycles ?? []).map((mc, mi) => ({
              name: mc.name ?? `Week ${mi + 1}`,
              narrative: `Week ${mi + 1} builds on the previous session with a ${mc.intensity ?? "planned"} load. Focus on execution quality and recovery.`,
            })),
          }
        : {}),
    })),
    closing:
      "Stay consistent, trust the process, and communicate with your coach if anything feels off. Every session is a step toward your goal.",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generatePlanNarrative(
  program: TrainingProgram,
  opts: NarrativeOptions = {}
): Promise<PlanNarrative> {
  const mesos = extractMesos(program, opts.selectedMesoIds);
  const fallback = buildFallback(mesos, opts);

  try {
    const raw = await sendMessage(
      [{ role: "user", content: buildPrompt(program, mesos, opts) }],
      SYSTEM,
      "claude-haiku-4-5"
    );

    // Strip any accidental markdown fences before parsing
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as PlanNarrative;

    if (
      typeof parsed.intro !== "string" ||
      !Array.isArray(parsed.mesocycles) ||
      typeof parsed.closing !== "string"
    ) {
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
}
