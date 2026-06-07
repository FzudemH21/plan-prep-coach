/**
 * xlsxExport.ts — Browser-side XLSX generation using SheetJS.
 *
 *   exportMonitoringXLSX   → Wellness (5 items + composite + z-score + athlete notes) ·
 *                             Pain · Illness · one sheet per enabled custom metric block
 *   exportPerformanceXLSX  → Body Metrics · Performance Params (both include Note column)
 *   exportExerciseXLSX     → Exercise e1RM sheet
 *   exportAnalysisXLSX     → Internal Load (sRPE · duration · AU · session comment)
 */

import * as XLSX from 'xlsx';
import {
  type AthleteCheckin,
  wellnessComposite,
  computeWellnessStats,
  zScore,
} from '@/hooks/useAthleteCheckins';
import type { AthleteBiometric, AthletePerformanceParameter, BiometricDefinition } from '@/types/athlete';
import type { ParameterV2 } from '@/types/parametersV2';
import { epley1RM, type ExerciseEntry, type ExerciseSession, type ParamTags } from '@/hooks/useExerciseMetrics';

// ── Shared helpers ────────────────────────────────────────────────────────────

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function slug(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Truncate to Excel's 31-char sheet name limit, replacing illegal chars. */
function sheetName(raw: string): string {
  return raw.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
}

// ── 1. Monitoring export ──────────────────────────────────────────────────────

export interface CustomBlockExport {
  /** Display name shown as the sheet tab, e.g. "HRV", "Jump Height" */
  name: string;
  unit: string | null;
  rows: Array<{ date: string; value: string }>;
}

export function exportMonitoringXLSX(
  checkins: AthleteCheckin[],
  athleteName: string,
  /** One entry per enabled custom metric block configured by the coach */
  customBlocks: CustomBlockExport[] = [],
): void {
  const wb = XLSX.utils.book_new();
  const stats = computeWellnessStats(checkins);

  // Sheet 1 — Wellness
  // Athlete check-in notes are included as the last column.
  const wellnessRows = [...checkins]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(c => {
      const composite = wellnessComposite(c);
      const z = composite !== null && stats ? zScore(composite, stats) : null;
      return {
        'Date':             c.date,
        'Fatigue (1–5)':    c.wellnessFatigue  ?? '',
        'Sleep (1–5)':      c.wellnessSleep    ?? '',
        'Soreness (1–5)':   c.wellnessSoreness ?? '',
        'Stress (1–5)':     c.wellnessStress   ?? '',
        'Mood (1–5)':       c.wellnessMood     ?? '',
        'Composite':        composite !== null ? +composite.toFixed(2) : '',
        'Z-Score':          z         !== null ? +z.toFixed(2)        : '',
        'Comment':          c.notes ?? '',
      };
    });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(wellnessRows.length ? wellnessRows : [{ Note: 'No check-ins recorded' }]),
    'Wellness',
  );

  // Sheet 2 — Pain incidents
  const painRows: Record<string, unknown>[] = [];
  for (const c of [...checkins].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!c.hasPain || !c.painAreas.length) continue;
    for (const pa of c.painAreas) {
      painRows.push({
        'Date':               c.date,
        'Body Area':          pa.areaLabel,
        'Severity (NRS 0–10)': pa.severity,
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(painRows.length ? painRows : [{ Note: 'No pain incidents recorded' }]),
    'Pain',
  );

  // Sheet 3 — Illness episodes
  const illnessRows = [...checkins]
    .filter(c => c.hasIllness)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(c => ({
      'Date':                  c.date,
      'Symptoms':              [
        ...c.illnessSymptoms,
        ...(c.illnessSymptomOther ? [c.illnessSymptomOther] : []),
      ].join('; '),
      'Severity (NRS 0–10)':  c.illnessNrs ?? '',
    }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(illnessRows.length ? illnessRows : [{ Note: 'No illness episodes recorded' }]),
    'Illness',
  );

  // Sheets 4+ — One sheet per custom metric block added by coach
  for (const block of customBlocks) {
    const blockRows = [...block.rows]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({
        'Date':  r.date,
        'Value': r.value,
        ...(block.unit ? { 'Unit': block.unit } : {}),
      }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(blockRows.length ? blockRows : [{ Note: 'No data recorded for this metric' }]),
      sheetName(block.name),
    );
  }

  download(wb, `${slug(athleteName)}_Monitoring_${today()}.xlsx`);
}

// ── 2. Performance export (body metrics + performance parameters) ──────────────

export function exportPerformanceXLSX(
  athleteBiometrics: AthleteBiometric[],
  biometricDefinitions: BiometricDefinition[],
  athletePerformanceParams: AthletePerformanceParameter[],
  parameters: ParameterV2[],
  athleteName: string,
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Body Metrics (long format: one row per measurement)
  const bodyRows: Record<string, unknown>[] = [];
  for (const ab of athleteBiometrics) {
    const def = biometricDefinitions.find(d => d.id === ab.biometricDefinitionId);
    if (!def) continue;
    for (const v of [...ab.values].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))) {
      bodyRows.push({
        'Metric':  def.name,
        'Unit':    def.unit ?? '',
        'Date':    v.recordedAt.slice(0, 10),
        'Value':   v.value,
        'Note':    v.note ?? '',
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(bodyRows.length ? bodyRows : [{ Note: 'No body metrics recorded' }]),
    'Body Metrics',
  );

  // Sheet 2 — Performance Parameters (long format)
  const perfRows: Record<string, unknown>[] = [];
  for (const pp of athletePerformanceParams) {
    const param = parameters.find(p => p.id === pp.athleticismParameterId);
    if (!param) continue;
    for (const v of [...pp.values].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))) {
      perfRows.push({
        'Parameter': param.name,
        'Category':  param.category ?? '',
        'Unit':      param.unit ?? '',
        'Date':      v.recordedAt.slice(0, 10),
        'Value':     v.value,
        'Note':      v.note ?? '',
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(perfRows.length ? perfRows : [{ Note: 'No performance parameters recorded' }]),
    'Performance Params',
  );

  download(wb, `${slug(athleteName)}_Performance_${today()}.xlsx`);
}

// ── 3. Exercise e1RM export ───────────────────────────────────────────────────

export function exportExerciseXLSX(
  exercises: ExerciseEntry[],
  getExerciseHistory: (name: string) => ExerciseSession[],
  paramTags: Record<string, ParamTags>,
  athleteName: string,
): void {
  const wb = XLSX.utils.book_new();

  const anyRIR = Object.values(paramTags).some(t => !!t.rirParam);

  const rows: Record<string, unknown>[] = [];
  for (const ex of exercises) {
    const sessions = getExerciseHistory(ex.name);
    const tags = paramTags[ex.name] ?? null;
    for (const s of sessions) {
      let bestW = '';
      let bestR = '';
      let bestRIR = '';
      let bestE1rm: number | null = null;
      if (tags) {
        for (const set of s.sets) {
          if (!set.completed) continue;
          const w = parseFloat(set.values[tags.weightParam] ?? '');
          const r = parseFloat(set.values[tags.repsParam] ?? '');
          if (isNaN(w) || isNaN(r) || r <= 0) continue;
          const rir = tags.rirParam ? parseFloat(set.values[tags.rirParam] ?? '0') : 0;
          const est = epley1RM(w, r, isNaN(rir) ? 0 : rir);
          if (bestE1rm === null || est > bestE1rm) {
            bestE1rm = est;
            bestW   = String(w);
            bestR   = String(r);
            bestRIR = tags.rirParam ? String(isNaN(rir) ? 0 : rir) : '';
          }
        }
      }
      const row: Record<string, unknown> = {
        'Exercise':        ex.name,
        'Date':            s.date,
        'Session':         s.sessionName,
        'Est. 1RM':        bestE1rm !== null ? +bestE1rm.toFixed(1) : '',
        'Best Set Weight': bestW,
        'Best Set Reps':   bestR,
      };
      if (anyRIR) row['Best Set RIR'] = bestRIR;
      rows.push(row);
    }
  }

  rows.sort((a, b) => {
    const ex = String(a['Exercise']).localeCompare(String(b['Exercise']));
    return ex !== 0 ? ex : String(a['Date']).localeCompare(String(b['Date']));
  });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No exercise history recorded' }]),
    'Exercise e1RM',
  );

  download(wb, `${slug(athleteName)}_Exercise_Metrics_${today()}.xlsx`);
}

// ── 4. Analysis export — Internal Load only ───────────────────────────────────

export interface RawSessionLogForExport {
  date:             string;
  session_id:       string | null;
  session_name:     string | null;
  borg_rating:      number | null;
  duration_seconds: number | null;
  completed_at:     string | null;
  comment:          string | null;
}

export function exportAnalysisXLSX(
  logs: RawSessionLogForExport[],
  athleteName: string,
): void {
  const wb = XLSX.utils.book_new();

  const completed = logs.filter(l => l.completed_at !== null);

  // Single sheet — Internal Load
  const rows = [...completed]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const durMin = log.duration_seconds !== null ? Math.round(log.duration_seconds / 60) : null;
      const sRPE   = log.borg_rating;
      const au     = sRPE !== null && durMin !== null ? +(sRPE * durMin).toFixed(0) : null;
      return {
        'Date':            log.date,
        'Session':         log.session_name ?? '',
        'sRPE (Borg 0–10)': sRPE   ?? '',
        'Duration (min)':  durMin   ?? '',
        'AU (sRPE × min)': au       ?? '',
        'Comment':         log.comment ?? '',
      };
    });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No sessions logged yet' }]),
    'Internal Load',
  );

  download(wb, `${slug(athleteName)}_InternalLoad_${today()}.xlsx`);
}
