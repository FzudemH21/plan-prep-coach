import { supabase } from '@/lib/supabase';
import type { TrainingProgram } from '@/hooks/useTrainingPrograms';

/**
 * Version history of training programs (table program_versions, see
 * supabase/migrations/20261101_program_versions.sql). Saving a program never waits for this and
 * never fails because of it — if the table is missing or a request fails, the program is saved
 * as always, only without a history entry.
 */

const TABLE = 'program_versions';
/** While a program is being edited, at most one version per hour */
const MIN_INTERVAL_MS = 60 * 60 * 1000;
/** Versions kept per program (oldest are removed) */
const KEEP_PER_PROGRAM = 15;

export type VersionReason = 'edit' | 'deleted' | 'before-restore';

export interface ProgramVersionSummary {
  id: string;
  program_id: string;
  program_name: string | null;
  reason: VersionReason;
  saved_at: string;
}

// Last stored version per program in this browser session (saves a request per auto-save)
const lastSnapshotAt = new Map<string, number>();
let warnedUnavailable = false;

function warnUnavailable(err: unknown) {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn('[programVersions] version history unavailable (run the program_versions migration?):', err);
}

async function latestSavedAt(userId: string, programId: string): Promise<number> {
  const known = lastSnapshotAt.get(programId);
  if (known !== undefined) return known;
  const { data, error } = await supabase
    .from(TABLE)
    .select('saved_at')
    .eq('coach_user_id', userId)
    .eq('program_id', programId)
    .order('saved_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const at = data?.saved_at ? new Date(data.saved_at).getTime() : 0;
  lastSnapshotAt.set(programId, at);
  return at;
}

async function pruneOldVersions(userId: string, programId: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('coach_user_id', userId)
    .eq('program_id', programId)
    .order('saved_at', { ascending: false })
    .range(KEEP_PER_PROGRAM, KEEP_PER_PROGRAM + 100);
  if (error || !data || data.length === 0) return;
  await supabase.from(TABLE).delete().in('id', data.map(row => row.id));
}

/**
 * Keeps a version of a program. 'edit' versions are throttled to one per hour per program;
 * 'deleted' and 'before-restore' are always kept. Never throws.
 */
export async function snapshotProgram(program: TrainingProgram, userId: string, reason: VersionReason = 'edit'): Promise<void> {
  try {
    if (reason === 'edit' && Date.now() - await latestSavedAt(userId, program.id) < MIN_INTERVAL_MS) return;
    const { error } = await supabase.from(TABLE).insert({
      coach_user_id: userId,
      program_id: program.id,
      program_name: program.name ?? null,
      reason,
      data: program,
    });
    if (error) throw error;
    lastSnapshotAt.set(program.id, Date.now());
    await pruneOldVersions(userId, program.id);
  } catch (err) {
    warnUnavailable(err);
  }
}

/** Versions of one program, newest first (without the program data) */
export async function listProgramVersions(userId: string, programId: string): Promise<ProgramVersionSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, program_id, program_name, reason, saved_at')
    .eq('coach_user_id', userId)
    .eq('program_id', programId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProgramVersionSummary[];
}

/** The newest version of every program that is no longer in the library (deleted or lost) */
export async function listDeletedPrograms(userId: string, currentIds: Set<string>): Promise<ProgramVersionSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, program_id, program_name, reason, saved_at')
    .eq('coach_user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  const newest = new Map<string, ProgramVersionSummary>();
  (data ?? []).forEach(row => {
    const version = row as ProgramVersionSummary;
    if (!currentIds.has(version.program_id) && !newest.has(version.program_id)) newest.set(version.program_id, version);
  });
  return [...newest.values()];
}

/** The program as stored in one version */
export async function getProgramVersion(versionId: string): Promise<TrainingProgram> {
  const { data, error } = await supabase.from(TABLE).select('data').eq('id', versionId).single();
  if (error) throw error;
  return data.data as TrainingProgram;
}
