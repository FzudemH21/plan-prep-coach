/**
 * Session comments — they stay with the session, never as separate chat messages:
 * - Session feedback: athlete_session_logs.comment (the athlete in their app, or the coach typing in
 *   what the athlete said when logging with the coach app)
 * - Exercise comments: athlete_session_logs.exercise_comments (athlete app, during the workout)
 * - Coach remarks: coach_session_remarks (coach only — athletes can read their own session logs, so
 *   private remarks can't live there)
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

/** Coach remark of a session log ('' when none / table missing) */
export async function fetchCoachRemark(sessionLogId: string): Promise<string> {
  const { data, error } = await supabase
    .from('coach_session_remarks')
    .select('remark')
    .eq('session_log_id', sessionLogId)
    .maybeSingle();
  if (error || !data) return '';
  return (data as { remark?: string }).remark ?? '';
}

/** Coach remarks for several session logs: session log id → remark */
export async function fetchCoachRemarks(sessionLogIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (sessionLogIds.length === 0) return map;
  const { data, error } = await supabase
    .from('coach_session_remarks')
    .select('session_log_id, remark')
    .in('session_log_id', sessionLogIds);
  if (error || !data) return map;
  (data as Array<{ session_log_id: string; remark: string }>).forEach(r => {
    if (r.remark?.trim()) map.set(r.session_log_id, r.remark);
  });
  return map;
}

/** Save (or clear) the coach's remark on a session. Returns an error message or null. */
export async function saveCoachRemark(sessionLogId: string, athleteConnectionId: string, remark: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'Not signed in';
  const { error } = await supabase
    .from('coach_session_remarks')
    .upsert({
      coach_user_id: user.id,
      session_log_id: sessionLogId,
      athlete_connection_id: athleteConnectionId,
      remark: remark.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_log_id' });
  return error ? error.message : null;
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
