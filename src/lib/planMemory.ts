/**
 * planMemory.ts
 *
 * Utilities for extracting structured summaries from completed training programs
 * and persisting them to the `plan_memory` Supabase table.
 *
 * Each saved plan produces one row in `plan_memory` per coach — this powers
 * the AI's ability to learn from a coach's own history across sessions.
 */

import { supabase } from '@/lib/supabase';
import type { TrainingProgram } from '@/hooks/useTrainingPrograms';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanMemoryRow {
  program_id: string;
  coach_id: string;
  plan_name: string | null;
  athlete_sport: string | null;
  athlete_team: string | null;
  athlete_level: string | null;
  goals: string[];
  methods_used: string[];
  mesocycle_count: number | null;
  total_weeks: number | null;
  intensity_progression: string[];
  summary_text: string;
}

/** Lightweight shape returned to callers for AI context injection */
export interface PlanMemorySummary {
  planName: string;
  createdAt: string;
  goals: string[];
  methodsUsed: string[];
  mesocycleCount: number | null;
  totalWeeks: number | null;
  intensityProgression: string[];
  summaryText: string;
  outcomeNotes: string | null;
  outcomeRating: number | null;
}

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Derives a structured `PlanMemoryRow` from a `TrainingProgram`.
 * Safe to call on partially-filled programs — missing data is gracefully omitted.
 */
export function extractPlanSummary(
  program: TrainingProgram,
  coachId: string,
  athleteSport: string | null = null,
  athleteTeam: string | null = null,
): PlanMemoryRow {
  const macro = program.macrocycleData;
  const meso = program.mesocycleData as { mesocycles?: unknown[] } | null;
  const mesocycles = (meso?.mesocycles ?? []) as Array<{
    name?: string;
    weeks?: number;
    intensity?: string;
    microcycles?: Array<{ intensity?: string }>;
    trainingMethods?: string[];
  }>;

  // ── Goals ─────────────────────────────────────────────────────────────────
  const goals: string[] =
    macro?.smartGoals
      ?.map((g: { description?: string }) => g.description ?? '')
      .filter(Boolean) ?? [];

  // ── Methods ───────────────────────────────────────────────────────────────
  const methodsFromMacro: string[] = macro?.selectedMethods ?? [];
  const methodsFromManual: string[] =
    (macro?.manuallyAddedMethods ?? []).map(
      (m: { name?: string; method?: string }) => m.name ?? m.method ?? '',
    ).filter(Boolean);
  const methods_used = [...new Set([...methodsFromMacro, ...methodsFromManual])];

  // ── Mesocycle structure ───────────────────────────────────────────────────
  const mesocycle_count = mesocycles.length || null;
  const total_weeks =
    program.duration?.weeks ||
    mesocycles.reduce((sum, m) => sum + (m.weeks ?? 0), 0) ||
    null;

  // Collect the top-level intensity of each mesocycle (e.g. "hard", "moderate")
  const intensity_progression = mesocycles
    .map((m) => m.intensity ?? '')
    .filter(Boolean);

  // ── Human-readable summary text (injected verbatim into AI context) ───────
  const lines: string[] = [];

  lines.push(`Plan: ${program.name ?? 'Untitled'}`);
  if (program.athleteName) lines.push(`Athlete: ${program.athleteName}`);
  if (athleteSport) lines.push(`Sport: ${athleteSport}`);
  if (athleteTeam) lines.push(`Team: ${athleteTeam}`);
  if (total_weeks) lines.push(`Duration: ${total_weeks} weeks`);
  if (goals.length) lines.push(`Goals: ${goals.join('; ')}`);
  if (methods_used.length) lines.push(`Methods: ${methods_used.join(', ')}`);

  if (mesocycles.length) {
    lines.push(`Mesocycles (${mesocycles.length}):`);
    mesocycles.forEach((m, i) => {
      const micros = m.microcycles ?? [];
      const microIntensities = micros
        .map((mc) => mc.intensity ?? '')
        .filter(Boolean)
        .join(' → ');
      const detail = [
        m.weeks ? `${m.weeks}w` : null,
        m.intensity ?? null,
        microIntensities ? `[${microIntensities}]` : null,
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(`  ${i + 1}. ${m.name ?? `Mesocycle ${i + 1}`}: ${detail}`);
    });
  }

  const summary_text = lines.join('\n');

  return {
    program_id: program.id,
    coach_id: coachId,
    plan_name: program.name ?? null,
    athlete_sport: athleteSport,
    athlete_team: athleteTeam,
    athlete_level: null,
    goals,
    methods_used,
    mesocycle_count,
    total_weeks,
    intensity_progression,
    summary_text,
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Upserts a plan summary into `plan_memory`.
 * Safe to call multiple times — identified by (coach_id, program_id).
 */
export async function savePlanMemory(
  program: TrainingProgram,
  coachId: string,
): Promise<void> {
  // Resolve athlete sport + team from the athlete_database store
  let athleteSport: string | null = null;
  let athleteTeam: string | null = null;
  const athleteId = program.macrocycleData?.selectedAthleteId ?? program.athleteId;
  if (athleteId) {
    try {
      const { data: athleteRow } = await supabase
        .from('athlete_database')
        .select('data')
        .eq('user_id', coachId)
        .maybeSingle();
      const athletes = (athleteRow?.data as { athletes?: Array<{ id: string; sport?: string | null; team?: string | null }> } | null)?.athletes ?? [];
      const athlete = athletes.find((a) => a.id === athleteId);
      if (athlete) {
        athleteSport = athlete.sport ?? null;
        athleteTeam = athlete.team ?? null;
      }
    } catch {
      // non-fatal — sport/team simply stay null
    }
  }

  const row = extractPlanSummary(program, coachId, athleteSport, athleteTeam);
  const { error } = await supabase.from('plan_memory').upsert(row, {
    onConflict: 'coach_id,program_id',
  });
  if (error) {
    console.error('[planMemory] save error:', error);
  }
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Fetches the most recent `plan_memory` rows for the current coach.
 *
 * Optionally filters to plans that share at least one method with
 * `currentMethods` — useful for "show me past triathlon plans" style context.
 *
 * Always returns results ordered newest-first so that the AI naturally
 * defers to more recent coaching decisions.
 */
export async function fetchRelevantPlans(
  coachId: string,
  opts: {
    currentMethods?: string[];
    limit?: number;
  } = {},
): Promise<PlanMemorySummary[]> {
  const limit = opts.limit ?? 5;

  let query = supabase
    .from('plan_memory')
    .select(
      'plan_name, created_at, goals, methods_used, mesocycle_count, total_weeks, intensity_progression, summary_text, outcome_notes, outcome_rating',
    )
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
    .limit(limit * 3); // fetch more, then filter + trim in JS

  const { data, error } = await query;

  if (error) {
    console.error('[planMemory] fetch error:', error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    plan_name: string | null;
    created_at: string;
    goals: string[];
    methods_used: string[];
    mesocycle_count: number | null;
    total_weeks: number | null;
    intensity_progression: string[];
    summary_text: string;
    outcome_notes: string | null;
    outcome_rating: number | null;
  }>;

  // Score by method overlap (higher = more relevant), preserve recency order
  const currentMethods = opts.currentMethods ?? [];
  const scored = rows.map((r) => {
    const overlap = currentMethods.filter((m) =>
      r.methods_used.some(
        (pm) => pm.toLowerCase() === m.toLowerCase(),
      ),
    ).length;
    return { ...r, _score: overlap };
  });

  // Sort: plans with method overlap first (desc), then by recency (already sorted)
  if (currentMethods.length > 0) {
    scored.sort((a, b) => b._score - a._score);
  }

  return scored.slice(0, limit).map((r) => ({
    planName: r.plan_name ?? 'Untitled',
    createdAt: r.created_at,
    goals: r.goals ?? [],
    methodsUsed: r.methods_used ?? [],
    mesocycleCount: r.mesocycle_count,
    totalWeeks: r.total_weeks,
    intensityProgression: r.intensity_progression ?? [],
    summaryText: r.summary_text,
    outcomeNotes: r.outcome_notes,
    outcomeRating: r.outcome_rating,
  }));
}

// ─── Uploaded plan context ────────────────────────────────────────────────────

export interface UploadedPlanContext {
  /** Document ID from useCoachDocuments — used as program_id prefix */
  docId: string;
  /** Human-readable plan name (usually the filename) */
  planName: string;
  /** e.g. "Track & field, sprinter, elite, 22y" */
  sportAndAthlete: string;
  /** e.g. "Championship prep, peaking for nationals in 12 weeks" */
  goalAndContext: string;
  /** e.g. "Block periodization, heavy speed-strength, 3 mesos" */
  methodsAndStructure: string;
  /** e.g. "PB at nationals, athlete handled high volume well" */
  outcomeAndNotes: string;
}

/**
 * Saves a manually-uploaded past training plan as an AI context entry.
 * Does NOT touch the coach profile — this is background knowledge only.
 * Identified by `uploaded_<docId>` so it never conflicts with wizard plans.
 */
export async function saveUploadedPlanMemory(
  context: UploadedPlanContext,
  coachId: string,
): Promise<void> {
  const program_id = `uploaded_${context.docId}`;

  // Build structured summary text for AI injection
  const lines: string[] = [
    `Plan: ${context.planName || 'Uploaded Plan'}`,
    'Source: Uploaded past plan',
  ];
  if (context.sportAndAthlete) lines.push(`Athlete / Sport: ${context.sportAndAthlete}`);
  if (context.goalAndContext)   lines.push(`Goal & Context: ${context.goalAndContext}`);
  if (context.methodsAndStructure) lines.push(`Methods & Structure: ${context.methodsAndStructure}`);
  if (context.outcomeAndNotes)  lines.push(`Outcome & Notes: ${context.outcomeAndNotes}`);

  // Parse a rough methods list for relevance filtering in fetchRelevantPlans
  const methods_used = context.methodsAndStructure
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 80);

  const athlete_sport = context.sportAndAthlete.split(',')[0]?.trim() || null;

  const row: PlanMemoryRow = {
    program_id,
    coach_id: coachId,
    plan_name: context.planName || 'Uploaded Plan',
    athlete_sport,
    athlete_team: null,
    athlete_level: null,
    goals: context.goalAndContext ? [context.goalAndContext] : [],
    methods_used,
    mesocycle_count: null,
    total_weeks: null,
    intensity_progression: [],
    summary_text: lines.join('\n'),
  };

  const { error } = await supabase.from('plan_memory').upsert(row, {
    onConflict: 'coach_id,program_id',
  });
  if (error) {
    console.error('[planMemory] saveUploadedPlanMemory error:', error);
    throw error;
  }
}

// ─── Context builder ──────────────────────────────────────────────────────────

/**
 * Formats retrieved past plans into a block of text ready for injection into
 * a wizard AI system prompt. Includes explicit recency framing so the AI
 * weights recent plans more heavily.
 */
export function buildCoachMemoryContext(plans: PlanMemorySummary[]): string {
  if (!plans.length) return '';

  const header = [
    `You have access to ${plans.length} of this coach's past training plan(s), ordered newest first.`,
    `These are individual examples of how the coach has approached specific athlete situations — they are NOT a definition of the coach's primary sport, specialty, or identity.`,
    `Do NOT infer the coach's primary coaching domain from these plans (e.g. do not conclude the coach works primarily with endurance athletes because one past plan was for a triathlete).`,
    `The coach's actual identity, philosophy, and primary specialty is described in the "Coach Style" section above — that is the authoritative source.`,
    `Use past plans only to understand: typical periodization structures, preferred methods, and how the coach has handled specific situations. More recent plans reflect more evolved thinking — defer to those when patterns conflict.`,
  ].join(' ');

  const planBlocks = plans.map((p, i) => {
    const age = formatAge(p.createdAt);
    const lines = [`[${i + 1}] ${p.planName} (${age})`];
    lines.push(p.summaryText);
    if (p.outcomeNotes) lines.push(`Coach notes: ${p.outcomeNotes}`);
    if (p.outcomeRating != null) lines.push(`Outcome rating: ${p.outcomeRating}/5`);
    return lines.join('\n');
  });

  return `--- Coach's Past Plans ---\n${header}\n\n${planBlocks.join('\n\n')}\n--- End Past Plans ---`;
}

/**
 * Appends a coach's Q&A rationale to an existing plan_memory row's summary_text.
 * Called after AccumulatedContextDialog collects answers.
 */
export async function saveRationaleNotes(
  programId: string,
  coachId: string,
  qAndA: Array<{ question: string; answer: string }>,
): Promise<void> {
  const nonEmpty = qAndA.filter((qa) => qa.answer.trim());
  if (nonEmpty.length === 0) return;

  const rationaleBlock =
    '\n\n## Coach\'s Rationale\n' +
    nonEmpty.map((qa) => `Q: ${qa.question}\nA: ${qa.answer.trim()}`).join('\n\n');

  // Fetch existing row
  const { data } = await supabase
    .from('plan_memory')
    .select('summary_text')
    .eq('program_id', programId)
    .eq('coach_id', coachId)
    .maybeSingle();

  const existing = (data as { summary_text?: string } | null)?.summary_text ?? '';

  const { error } = await supabase
    .from('plan_memory')
    .update({ summary_text: existing + rationaleBlock })
    .eq('program_id', programId)
    .eq('coach_id', coachId);

  if (error) {
    console.error('[planMemory] saveRationaleNotes error:', error);
    throw error;
  }
}

function formatAge(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? '' : 's'} ago`;
}
