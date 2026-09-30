/**
 * The latest measured value of a parameter as a number — e.g. the baseline of a SMART goal.
 *
 * Values are stored as typed ("40,7", "0,46", "1.234,5", "12.3 s"). parseFloat stops at a comma,
 * so "0,46" became 0 and "40,7" became 40 — German-style decimals must be read explicitly.
 */
import type { ParameterValue } from '@/types/athlete';

/** "40,7" → 40.7 · "0,46" → 0.46 · "1.234,5" → 1234.5 · "1,234.5" → 1234.5 · "12.3 s" → 12.3 · "" → null */
export function parseMeasuredNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (!raw) return null;
  let s = raw.trim().replace(/\s/g, '');
  const match = s.match(/^[+-]?[\d.,]+/);
  if (!match) return null;
  s = match[0];
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Both: the later one is the decimal separator, the other groups thousands
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function timeOf(recordedAt: string): number {
  // Date-only strings count as noon local (as everywhere in the app)
  const t = new Date(recordedAt.length === 10 ? `${recordedAt}T12:00:00` : recordedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** The most recent measurement with a number in it (null if there is none) */
export function latestNumericValue(values: Array<Pick<ParameterValue, 'value' | 'recordedAt'>>): number | null {
  const sorted = [...values].sort((a, b) => timeOf(b.recordedAt) - timeOf(a.recordedAt));
  for (const v of sorted) {
    const n = parseMeasuredNumber(v.value);
    if (n !== null) return n;
  }
  return null;
}
