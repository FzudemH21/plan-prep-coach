import type { ExerciseSummary } from '@/hooks/useAthleteApp';
import { parseMeasuredNumber } from '@/utils/latestParameterValue';

/** A planned rest value in seconds, using its unit. Without a unit (older data) small numbers
 *  (< 10) are read as minutes, anything else as seconds. */
export function restValueToSeconds(value: number, unit: unknown): number {
  const u = String(unit ?? '').trim().toLowerCase();
  if (/^(s|sec|secs|second|seconds|sek|sekunden)$/.test(u)) return value;
  if (/^(m|min|mins|minute|minutes|minuten)$/.test(u) || u.startsWith('min')) return value * 60;
  if (/^(h|hr|hrs|hour|hours|std)$/.test(u)) return value * 3600;
  return value < 10 ? value * 60 : value;
}

/**
 * Rest after a set (seconds). Regular exercises: the rest parameter flagged in the Training Toolbox
 * (per-set values first), in its unit. Circuits: the rest between rounds — 0 when none is set.
 */
export function getRestSeconds(ex: ExerciseSummary): number {
  if (ex.isCircuit) {
    const secs = parseMeasuredNumber(ex.circuitRestBetweenRounds ?? '');
    return secs !== null && secs > 0 ? secs : 0;
  }
  if (!ex.plannedParams) return 90;
  const params = ex.plannedParams;

  const parseRestValue = (key: string): number | null => {
    const unit = params[`${key}_unit`];
    // Per-set keys win over the plain key (edits per set); ad-hoc exercises only have per-set keys
    for (let i = 1; i <= 20; i++) {
      const sv = params[`${key}_set${i}`];
      if (sv === undefined) break;
      const n = parseMeasuredNumber(sv);
      if (n !== null && n > 0) return restValueToSeconds(n, unit);
    }
    const n = parseMeasuredNumber(params[key]);
    return n !== null && n > 0 ? restValueToSeconds(n, unit) : null;
  };

  // The rest parameter flagged in the Training Toolbox
  if (ex.restParamName) return parseRestValue(ex.restParamName) ?? 90;

  // Older data without a flagged rest parameter: a key named like rest
  const REST = /rest|pause|recovery/i;
  for (const key of Object.keys(params)) {
    if (/_set\d+$/.test(key) || key.endsWith('_unit')) continue;
    if (REST.test(key)) {
      const secs = parseRestValue(key);
      if (secs !== null) return secs;
    }
  }
  return 90;
}
