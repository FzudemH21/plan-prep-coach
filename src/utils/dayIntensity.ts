import { migrateLegacyIntensity } from '@/utils/intensityScale';

/**
 * Day intensity after sessions were moved between days (athlete app, coach mobile):
 * no session left → "0" (rest); otherwise the hardest session's intensity (highest Borg value) —
 * the day's load and recovery need follow its hardest session. A session without its own intensity
 * counts with the intensity of the day it was on (dayFallback). Nothing known → `keep`.
 * The day a session is moved TO also keeps its previous day intensity if that is higher (callers
 * add it as one more entry) — adding a session never makes a day easier.
 */
export function dayIntensityFromSessions(
  sessions: Array<{ intensity?: string | null; dayFallback?: string | null }>,
  keep: string | null,
): string | null {
  if (sessions.length === 0) return '0';
  const values = sessions
    .map(s => s.intensity ?? s.dayFallback)
    .filter((v): v is string => !!v)
    .map(v => Number(migrateLegacyIntensity(v)));
  return values.length > 0 ? String(Math.max(...values)) : keep;
}
