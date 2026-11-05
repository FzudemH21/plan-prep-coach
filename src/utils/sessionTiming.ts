/**
 * When a logged session happened: its day, finish time and duration — filled in automatically, and
 * editable at the end of a workout or on a logged session (a session logged afterwards).
 * A changed day moves the session in the athlete's calendar: logs are matched to it by date + session.
 */
import { supabase } from '@/lib/supabase';
import { SCHEDULE_PAST_DAYS, type SessionSummary } from '@/hooks/useAthleteApp';
import { dayIntensityFromSessions } from '@/utils/dayIntensity';

export interface SessionTimingValue {
  /** yyyy-MM-dd — the calendar day the session counts on */
  date: string;
  /** HH:mm, local */
  time: string;
  /** Whole minutes as typed; empty = no duration */
  minutes: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toIso = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

export const todayLocal = () => localDate(new Date());

/** The earliest day a session can be put on — the apps don't load logs further back */
export function earliestTimingDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - SCHEDULE_PAST_DAYS);
  return localDate(d);
}

export function initialTiming(date: string, completedAt: string | null, durationSeconds: number | null): SessionTimingValue {
  return {
    date,
    time: localTime(completedAt ? new Date(completedAt) : new Date()),
    minutes: durationSeconds && durationSeconds > 0 ? String(Math.round(durationSeconds / 60)) : '',
  };
}

/** "Today, 5:42 PM · 58 min" */
export function timingSummary(value: SessionTimingValue): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayLabel = value.date === todayLocal() ? 'Today'
    : value.date === localDate(yesterday) ? 'Yesterday'
    : value.date ? new Date(`${value.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';
  const time = value.date && value.time
    ? new Date(`${value.date}T${value.time}:00`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '';
  const minutes = Number(value.minutes);
  return [[dayLabel, time].filter(Boolean).join(', '), minutes > 0 ? `${minutes} min` : null].filter(Boolean).join(' · ');
}

/** What's wrong with the entered values (null = fine). Only what was changed is checked. */
export function timingError(initial: SessionTimingValue, value: SessionTimingValue): string | null {
  const minutes = value.minutes.trim();
  if (minutes !== '' && (!/^\d+$/.test(minutes) || Number(minutes) > 1440)) return 'Enter the duration in minutes.';
  if (value.date === initial.date && value.time === initial.time) return null;
  if (!value.date || !value.time) return 'Enter a date and a time.';
  if (value.date !== initial.date && value.date < earliestTimingDate()) return 'That date is too far back.';
  if (new Date(`${value.date}T${value.time}:00`).getTime() > Date.now()) return 'That is in the future.';
  return null;
}

const secondsOf = (minutes: string) => {
  const n = Number(minutes.trim());
  return n > 0 ? n * 60 : null;
};

/**
 * completed_at + duration_seconds of a workout being finished. Nothing edited: the timer's duration,
 * and now — or, for a session of an earlier day, that day (as the sheet shows it). The session stays
 * on its day unless the day was changed, also when it is finished ahead of its planned day.
 */
export function finishTimingPayload(initial: SessionTimingValue, value: SessionTimingValue, elapsedSeconds: number) {
  const edited = value.date !== initial.date || value.time !== initial.time;
  return {
    completed_at: edited || value.date < todayLocal() ? toIso(value.date, value.time) : new Date().toISOString(),
    duration_seconds: value.minutes !== initial.minutes
      ? secondsOf(value.minutes)
      : elapsedSeconds > 0 ? elapsedSeconds : null,
  };
}

const ALREADY_THERE = 'This session is already on that day.';

/**
 * Puts a logged session on another day: into that day's schedule, then the log, then out of the old
 * day — so a failure can never lose the session (nothing is removed until the rest worked).
 * Returns an error message, or null. Marked as moved, like a drag on mobile, so a plan re-sync keeps it.
 */
export async function moveLoggedSession(
  { connectionId, logId, sessionId, fromDate, toDate }:
  { connectionId: string; logId: string; sessionId: string; fromDate: string; toDate: string },
): Promise<string | null> {
  if (fromDate === toDate) return null;

  const setLogDate = async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from('athlete_session_logs').update({ date: toDate }).eq('id', logId).select('id');
    if (error) return error.message;
    return data && data.length > 0 ? null : 'The session could not be changed.';
  };

  const { data: rows, error: readError } = await supabase
    .from('athlete_schedule')
    .select('date, sessions, intensity')
    .eq('athlete_connection_id', connectionId)
    .in('date', [fromDate, toDate]);
  if (readError) return readError.message;

  type Row = { date: string; sessions: SessionSummary[] | null; intensity: string | null };
  const fromRow = ((rows ?? []) as Row[]).find(r => r.date === fromDate);
  const toRow = ((rows ?? []) as Row[]).find(r => r.date === toDate);
  const fromSessions = fromRow?.sessions ?? [];
  const toSessions = toRow?.sessions ?? [];

  if (toSessions.some(s => s.id === sessionId)) return ALREADY_THERE;
  const { data: logged, error: loggedError } = await supabase
    .from('athlete_session_logs')
    .select('id')
    .eq('athlete_connection_id', connectionId)
    .eq('date', toDate)
    .eq('session_id', sessionId)
    .not('completed_at', 'is', null)
    .limit(1);
  if (loggedError) return loggedError.message;
  if (logged && logged.length > 0) return ALREADY_THERE;

  // No longer in the calendar (e.g. removed from the plan): only the log has a date to change
  const session = fromSessions.find(s => s.id === sessionId);
  if (!session) return setLogDate();

  const fromIntensity = fromRow?.intensity ?? null;
  const toIntensity = toRow?.intensity ?? null;
  const backToOriginal = session.originalDate === toDate;
  const moved: SessionSummary = {
    ...session,
    order: toSessions.length,
    // Keeps its intensity — the day's, if it had none of its own
    intensity: session.intensity ?? fromIntensity ?? undefined,
    mobileRearranged: backToOriginal ? undefined : true,
    originalDate: backToOriginal ? undefined : session.originalDate ?? fromDate,
  };
  const newTo = [...toSessions, moved];
  const newFrom = fromSessions.filter(s => s.id !== sessionId).map((s, i) => ({ ...s, order: i }));
  // Day intensities follow the sessions; the receiving day never gets easier
  const newToIntensity = dayIntensityFromSessions([
    ...newTo.map(s => ({ intensity: s.intensity, dayFallback: toIntensity })),
    ...(toSessions.length > 0 && toIntensity ? [{ intensity: toIntensity }] : []),
  ], toIntensity);
  const newFromIntensity = dayIntensityFromSessions(
    newFrom.map(s => ({ intensity: s.intensity, dayFallback: fromIntensity })), fromIntensity);

  const updateDay = (date: string, patch: { sessions: SessionSummary[]; intensity: string | null }) => supabase
    .from('athlete_schedule').update(patch)
    .eq('athlete_connection_id', connectionId).eq('date', date).select('id');

  // 1. Onto the new day
  const patchTo = { sessions: newTo, intensity: newToIntensity };
  if (toRow) {
    const { data, error } = await updateDay(toDate, patchTo);
    if (error) return error.message;
    if (!data || data.length === 0) return 'The new day could not be changed.';
  } else {
    const { error } = await supabase.from('athlete_schedule').insert({
      athlete_connection_id: connectionId, date: toDate, events: [], ...patchTo,
    });
    if (error) {
      return (error as { code?: string }).code === '23505'
        ? 'That day was changed in the meantime. Please try again.'
        : error.message;
    }
  }

  // 2. The log follows — if it can't, the new day is put back
  const logError = await setLogDate();
  if (logError) {
    await updateDay(toDate, { sessions: toSessions, intensity: toIntensity });
    return logError;
  }

  // 3. Off the old day
  const { data: removed, error: removeError } = await updateDay(fromDate, { sessions: newFrom, intensity: newFromIntensity });
  if (removeError || !removed || removed.length === 0) {
    return 'The session moved, but is also still on its old day. Please remove it there.';
  }
  return null;
}

export interface LogTimingChange {
  date: string;
  completed_at?: string;
  duration_seconds?: number | null;
}

/** Saves the edit of a logged session. The day first: if the move isn't possible, nothing changes. */
export async function saveLoggedTiming(
  { connectionId, logId, sessionId, initial, value }:
  { connectionId: string; logId: string; sessionId: string | null; initial: SessionTimingValue; value: SessionTimingValue },
): Promise<{ error: string | null; moved: boolean; change: LogTimingChange }> {
  const moved = value.date !== initial.date;
  const patch: Omit<LogTimingChange, 'date'> = {};
  if (moved || value.time !== initial.time) patch.completed_at = toIso(value.date, value.time);
  if (value.minutes !== initial.minutes) patch.duration_seconds = secondsOf(value.minutes);

  if (moved) {
    const moveError = sessionId
      ? await moveLoggedSession({ connectionId, logId, sessionId, fromDate: initial.date, toDate: value.date })
      : (await supabase.from('athlete_session_logs').update({ date: value.date }).eq('id', logId)).error?.message ?? null;
    if (moveError) return { error: moveError, moved: false, change: { date: initial.date } };
  }
  if (Object.keys(patch).length > 0) {
    const { data, error } = await supabase.from('athlete_session_logs').update(patch).eq('id', logId).select('id');
    if (error) return { error: error.message, moved, change: { date: value.date } };
    if (!data || data.length === 0) return { error: 'The session could not be changed.', moved, change: { date: value.date } };
  }
  return { error: null, moved, change: { date: value.date, ...patch } };
}
