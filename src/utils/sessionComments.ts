/**
 * Session comments — they stay with the session, never as separate chat messages:
 * - Session feedback: athlete_session_logs.comment (the athlete in their app, or the coach typing in
 *   what the athlete said when logging with the coach app)
 * - Exercise comments: athlete_session_logs.exercise_comments (athlete app, during the workout)
 * - Coach remarks: coach_session_remarks (coach only — athletes can read their own session logs, so
 *   private remarks can't live there): a general remark + private notes on single exercises
 * The coach is notified through the bell; a reply goes into the one athlete chat, quoting the comment.
 * Needs supabase/migrations/20261011_session_comments.sql — without it these calls fail quietly.
 */
import { supabase } from '@/lib/supabase';

export interface ExerciseComment {
  id: string;
  exerciseName: string;
  sectionName?: string;
  text: string;
  /** ISO timestamp */
  createdAt: string;
  /** Who wrote it — the coach when logging with the coach app (no notification for those) */
  author?: 'athlete' | 'coach';
}

/** Normalise the stored value (column missing / null / malformed → []) */
export function parseExerciseComments(raw: unknown): ExerciseComment[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is ExerciseComment =>
    !!c && typeof c === 'object' && typeof (c as ExerciseComment).text === 'string' && typeof (c as ExerciseComment).exerciseName === 'string');
}

/** Append a comment to the session log's exercise comments. Returns the updated list, or null on failure. */
export async function addExerciseComment(
  sessionLogId: string,
  comment: Omit<ExerciseComment, 'id' | 'createdAt'>,
): Promise<ExerciseComment[] | null> {
  const { data, error } = await supabase
    .from('athlete_session_logs')
    .select('exercise_comments')
    .eq('id', sessionLogId)
    .maybeSingle();
  if (error || !data) return null;
  const next: ExerciseComment[] = [
    ...parseExerciseComments((data as { exercise_comments?: unknown }).exercise_comments),
    { ...comment, id: `exc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() },
  ];
  const { error: updateError } = await supabase
    .from('athlete_session_logs')
    .update({ exercise_comments: next })
    .eq('id', sessionLogId);
  return updateError ? null : next;
}

/** The exercise comments of one session log ([] when none or the column doesn't exist yet) */
export async function fetchExerciseComments(sessionLogId: string): Promise<ExerciseComment[]> {
  const { data, error } = await supabase
    .from('athlete_session_logs')
    .select('exercise_comments')
    .eq('id', sessionLogId)
    .maybeSingle();
  if (error || !data) return [];
  return parseExerciseComments((data as { exercise_comments?: unknown }).exercise_comments);
}

/** The coach's private remarks on a session: notes on single exercises + a general remark */
export interface CoachRemarks {
  remark: string;
  exerciseRemarks: ExerciseComment[];
}

export const EMPTY_REMARKS: CoachRemarks = { remark: '', exerciseRemarks: [] };

export function hasRemarks(r: CoachRemarks | undefined): boolean {
  return !!r && (r.remark.trim().length > 0 || r.exerciseRemarks.length > 0);
}

/** Remarks as plain text (athlete notes, AI context): one line per exercise note, then the remark */
export function remarksAsText(r: CoachRemarks): string {
  return [
    ...r.exerciseRemarks.map(e => `${e.exerciseName}: ${e.text}`),
    r.remark.trim(),
  ].filter(Boolean).join('\n');
}

type RemarkRow = { session_log_id?: string; remark?: string; exercise_remarks?: unknown };
const toRemarks = (row: RemarkRow | null | undefined): CoachRemarks => ({
  remark: row?.remark ?? '',
  exerciseRemarks: parseExerciseComments(row?.exercise_remarks),
});

/** select() with exercise_remarks, retried without it before that part of the migration is run */
async function selectRemarks(build: (columns: string) => PromiseLike<{ data: unknown; error: unknown }>) {
  const full = await build('session_log_id, remark, exercise_remarks');
  return full.error ? build('session_log_id, remark') : full;
}

/** The coach's remarks on one session log (empty when none / table missing) */
export async function fetchCoachRemark(sessionLogId: string): Promise<CoachRemarks> {
  const { data, error } = await selectRemarks(columns => supabase
    .from('coach_session_remarks')
    .select(columns)
    .eq('session_log_id', sessionLogId)
    .maybeSingle());
  if (error || !data) return EMPTY_REMARKS;
  return toRemarks(data as RemarkRow);
}

/** The coach's remarks for several session logs: session log id → remarks (only non-empty ones) */
export async function fetchCoachRemarks(sessionLogIds: string[]): Promise<Map<string, CoachRemarks>> {
  const map = new Map<string, CoachRemarks>();
  if (sessionLogIds.length === 0) return map;
  const { data, error } = await selectRemarks(columns => supabase
    .from('coach_session_remarks')
    .select(columns)
    .in('session_log_id', sessionLogIds));
  if (error || !Array.isArray(data)) return map;
  (data as RemarkRow[]).forEach(row => {
    const r = toRemarks(row);
    if (row.session_log_id && hasRemarks(r)) map.set(row.session_log_id, r);
  });
  return map;
}

/** Upsert only the given columns of the coach's remarks row (the others keep their values) */
async function upsertRemarks(sessionLogId: string, athleteConnectionId: string, fields: Record<string, unknown>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'Not signed in';
  const { error } = await supabase
    .from('coach_session_remarks')
    .upsert({
      coach_user_id: user.id,
      session_log_id: sessionLogId,
      athlete_connection_id: athleteConnectionId,
      ...fields,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_log_id' });
  return error ? error.message : null;
}

/** Save (or clear) the coach's general remark on a session. Returns an error message or null. */
export function saveCoachRemark(sessionLogId: string, athleteConnectionId: string, remark: string): Promise<string | null> {
  return upsertRemarks(sessionLogId, athleteConnectionId, { remark: remark.trim() });
}

/** Add a private note on an exercise. Returns the updated list, or null on failure. */
export async function addCoachExerciseRemark(
  sessionLogId: string,
  athleteConnectionId: string,
  note: Omit<ExerciseComment, 'id' | 'createdAt' | 'author'>,
): Promise<ExerciseComment[] | null> {
  const current = await fetchCoachRemark(sessionLogId);
  const next: ExerciseComment[] = [
    ...current.exerciseRemarks,
    { ...note, author: 'coach', id: `exr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() },
  ];
  const error = await upsertRemarks(sessionLogId, athleteConnectionId, { exercise_remarks: next });
  return error ? null : next;
}

/** Remove one of the coach's exercise notes. Returns the updated list, or null on failure. */
export async function removeCoachExerciseRemark(
  sessionLogId: string,
  athleteConnectionId: string,
  noteId: string,
): Promise<ExerciseComment[] | null> {
  const current = await fetchCoachRemark(sessionLogId);
  const next = current.exerciseRemarks.filter(e => e.id !== noteId);
  const error = await upsertRemarks(sessionLogId, athleteConnectionId, { exercise_remarks: next });
  return error ? null : next;
}

/** A comment as a one-line quote for notifications */
export function shortQuote(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * The coach's reply to a comment: a message in the one athlete chat, with the comment quoted
 * (reference.quote) and linked to its session / exercise. Inserted directly — a second useChat
 * instance would share the chat's realtime channel. Returns an error message or null.
 */
export async function sendCommentReply(
  connectionId: string,
  text: string,
  reference: { exerciseName?: string; sectionName?: string; sessionName?: string; date?: string; quote: string },
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'Not signed in';
  const { error } = await supabase.from('chat_messages').insert({
    connection_id: connectionId,
    sender_role: 'coach',
    sender_auth_user_id: user.id,
    content: text.trim(),
    // The table only allows 'text' and 'exercise_comment'; the reference chip shows for the latter
    message_type: 'exercise_comment',
    reference,
    attachments: null,
  });
  return error ? error.message : null;
}

type SelectResult = { data: unknown; error: { message?: string } | null };

/**
 * select() with optional columns from migrations that may not have been run yet: when the query
 * fails, only the column named in the error is dropped and the query retried (dropping all optional
 * columns at once lost e.g. the exercise comments whenever just paused_at was missing).
 */
export async function selectWithOptionalColumns(
  run: (columns: string) => PromiseLike<SelectResult>,
  baseColumns: string,
  optionalColumns: string[],
): Promise<SelectResult> {
  let optional = [...optionalColumns];
  for (;;) {
    const res = await run([baseColumns, ...optional].join(', '));
    if (!res.error || optional.length === 0) return res;
    const message = res.error.message ?? '';
    const missing = optional.find(c => message.includes(c));
    // Unknown cause: try without any optional column, then give up
    optional = missing ? optional.filter(c => c !== missing) : [];
  }
}
