/**
 * xlsxExport.ts — Browser-side XLSX generation using SheetJS.
 *
 * Three focused exports, each matching one coach tab:
 *   exportMonitoringXLSX   → Wellness · Pain · Illness sheets
 *   exportPerformanceXLSX  → Body Metrics · Performance Params sheets
 *   exportExerciseXLSX     → Exercise e1RM sheet
 *   exportAnalysisXLSX     → Session Log · Weekly Summary sheets
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

// Monday-aligned week label, e.g. "2026-W23 (02 Jun)"
function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  const yy = mon.getFullYear();
  const wk = String(getISOWeek(mon)).padStart(2, '0');
  const dd = mon.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${yy}-W${wk} (${dd})`;
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return mon.toISOString().slice(0, 10);
}

function getISOWeek(d: Date): number {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  return Math.floor(diff / (7 * 86400000)) + 1;
}

// ── 1. Monitoring export ──────────────────────────────────────────────────────

export function exportMonitoringXLSX(checkins: AthleteCheckin[], athleteName: string): void {
  const wb = XLSX.utils.book_new();
  const stats = computeWellnessStats(checkins);

  // Sheet 1 — Wellness (one row per check-in, newest-first in UI but sorted asc here)
  const wellnessRows = [...checkins]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(c => {
      const composite = wellnessComposite(c);
      const z = composite !== null && stats ? zScore(composite, stats) : null;
      return {
        'Date':                   c.date,
        'Fatigue (1–5)':          c.wellnessFatigue  ?? '',
        'Sleep (1–5)':            c.wellnessSleep    ?? '',
        'Soreness (1–5)':         c.wellnessSoreness ?? '',
        'Stress (1–5)':           c.wellnessStress   ?? '',
        'Mood (1–5)':             c.wellnessMood     ?? '',
        'Composite':              composite !== null ? +composite.toFixed(2) : '',
        'Z-Score':                z        !== null ? +z.toFixed(2)        : '',
        'Notes':                  c.notes ?? '',
      };
    });

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(wellnessRows.length ? wellnessRows : [{ Note: 'No check-ins recorded' }]),
    'Wellness',
  );

  // Sheet 2 — Pain incidents (one row per body area per day)
  const painRows: Record<string, unknown>[] = [];
  for (const c of [...checkins].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!c.hasPain || !c.painAreas.length) continue;
    for (const pa of c.painAreas) {
      painRows.push({
        'Date':                   c.date,
        'Body Area':              pa.areaLabel,
        'Severity (NRS 0–10)':   pa.severity,
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
      'Date':                   c.date,
      'Symptoms':               [
        ...c.illnessSymptoms,
        ...(c.illnessSymptomOther ? [c.illnessSymptomOther] : []),
      ].join('; '),
      'Severity (NRS 0–10)':   c.illnessNrs ?? '',
    }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(illnessRows.length ? illnessRows : [{ Note: 'No illness episodes recorded' }]),
    'Illness',
  );

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
        'Metric':   def.name,
        'Unit':     def.unit ?? '',
        'Date':     v.recordedAt.slice(0, 10),
        'Value':    v.value,
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
        'Parameter':  param.name,
        'Category':   param.category ?? '',
        'Unit':       param.unit ?? '',
        'Date':       v.recordedAt.slice(0, 10),
        'Value':      v.value,
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

  // Determine if any exercise uses RIR (to decide whether to include the column)
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

  // Sort: exercise name asc, then date asc
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

// ── 4. Analysis export ────────────────────────────────────────────────────────

interface RawSessionLog {
  date: string;
  session_id:       string | null;
  session_name:     string | null;
  borg_rating:      number | null;
  duration_seconds: number | null;
  completed_at:     string | null;
}

interface RawScheduleRow {
  date:      string;
  sessions:  Array<{ id?: string; intensity?: string }> | null;
  intensity: string | null;
}

function getPlannedIntensity(log: RawSessionLog, schedule: RawScheduleRow[]): number | null {
  const row = schedule.find(r => r.date === log.date);
  if (!row) return null;
  if (row.sessions && log.session_id) {
    const match = row.sessions.find(s => s.id === log.session_id);
    if (match?.intensity) {
      const n = parseFloat(match.intensity);
      return isNaN(n) ? null : n;
    }
  }
  if (row.intensity) {
    const n = parseFloat(row.intensity);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function exportAnalysisXLSX(
  logs: RawSessionLog[],
  schedule: RawScheduleRow[],
  athleteName: string,
): void {
  const wb = XLSX.utils.book_new();

  const completed = logs.filter(l => l.completed_at !== null);

  // Sheet 1 — Session Log
  const sessionRows = [...completed]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const durMin = log.duration_seconds !== null ? Math.round(log.duration_seconds / 60) : null;
      const sRPE   = log.borg_rating;
      const au     = sRPE !== null && durMin !== null ? sRPE * durMin : null;
      const planned = getPlannedIntensity(log, schedule);
      const plannedAU = planned !== null && durMin !== null ? Math.round(planned * durMin) : null;
      return {
        'Date':                     log.date,
        'Session':                  log.session_name ?? '',
        'sRPE (Borg 0–10)':        sRPE  ?? '',
        'Duration (min)':           durMin ?? '',
        'Actual AU (sRPE × min)':  au     !== null ? +au.toFixed(0) : '',
        'Planned Intensity (0–10)': planned  ?? '',
        'Planned AU':              plannedAU ?? '',
      };
    });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(sessionRows.length ? sessionRows : [{ Note: 'No sessions logged yet' }]),
    'Session Log',
  );

  // Sheet 2 — Weekly Summary
  type WeekBucket = {
    label:              string;
    completedSessions:  number;
    totalAU:            number;
    meanSRPE:           number[];
    plannedIntensities: number[];
    plannedSessions:    number;
  };
  const weekMap = new Map<string, WeekBucket>();

  // Count planned sessions from schedule
  for (const row of schedule) {
    const k = weekKey(row.date);
    if (!weekMap.has(k)) weekMap.set(k, { label: weekLabel(row.date), completedSessions: 0, totalAU: 0, meanSRPE: [], plannedIntensities: [], plannedSessions: 0 });
    weekMap.get(k)!.plannedSessions += row.sessions?.length ?? 0;
    const pi = row.intensity ? parseFloat(row.intensity) : NaN;
    if (!isNaN(pi)) weekMap.get(k)!.plannedIntensities.push(pi);
  }

  // Accumulate completed data
  for (const log of completed) {
    const k = weekKey(log.date);
    if (!weekMap.has(k)) weekMap.set(k, { label: weekLabel(log.date), completedSessions: 0, totalAU: 0, meanSRPE: [], plannedIntensities: [], plannedSessions: 0 });
    const bucket = weekMap.get(k)!;
    bucket.completedSessions++;
    if (log.borg_rating !== null) bucket.meanSRPE.push(log.borg_rating);
    const durMin = log.duration_seconds !== null ? Math.round(log.duration_seconds / 60) : null;
    if (log.borg_rating !== null && durMin !== null) bucket.totalAU += log.borg_rating * durMin;
  }

  const weeklyRows = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, w]) => {
      const adherence = w.plannedSessions > 0
        ? Math.round((w.completedSessions / w.plannedSessions) * 100)
        : null;
      const meanSRPE = w.meanSRPE.length > 0
        ? +(w.meanSRPE.reduce((a, b) => a + b, 0) / w.meanSRPE.length).toFixed(2)
        : '';
      const plannedAvgInt = w.plannedIntensities.length > 0
        ? +(w.plannedIntensities.reduce((a, b) => a + b, 0) / w.plannedIntensities.length).toFixed(2)
        : '';
      return {
        'Week':                       w.label,
        'Planned Sessions':           w.plannedSessions || '',
        'Completed Sessions':         w.completedSessions,
        'Adherence (%)':              adherence ?? '',
        'Total AU (sRPE × min)':      +w.totalAU.toFixed(0) || '',
        'Mean sRPE':                  meanSRPE,
        'Planned Avg Intensity':      plannedAvgInt,
      };
    });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(weeklyRows.length ? weeklyRows : [{ Note: 'No data for weekly summary' }]),
    'Weekly Summary',
  );

  download(wb, `${slug(athleteName)}_Analysis_${today()}.xlsx`);
}
