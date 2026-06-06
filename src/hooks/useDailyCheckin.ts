import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PainArea {
  regionKey: string;  // e.g. "5-L", "5-R", "16-R", "1"
  areaLabel: string;  // e.g. "Left Elbow", "Right Knee", "Head / Face"
  severity: number;   // NRS 0–10
}

export interface DailyCheckin {
  id: string;
  athleteId: string;
  date: string; // yyyy-MM-dd
  // McLean 5-item (1–5, higher = better)
  wellnessFatigue: number | null;
  wellnessSleep: number | null;
  wellnessSoreness: number | null;
  wellnessStress: number | null;
  wellnessMood: number | null;
  // Pain
  hasPain: boolean;
  painAreas: PainArea[];
  // Illness — OSTRC-H symptom checklist
  hasIllness: boolean;
  illnessSymptoms: string[];    // array of symptom IDs
  illnessSymptomOther: string;  // free text for 'other'
  illnessNrs: number | null;    // overall illness severity NRS 0–10
  // Free-text notes (always collected, regardless of which blocks are active)
  notes: string | null;
  // Custom metric values: parameterId → numeric value (saved also to athlete_test_results)
  customMetricValues: Record<string, number> | null;
  createdAt: string;
}

export interface DailyCheckinInput {
  date: string;
  wellnessFatigue: number | null;
  wellnessSleep: number | null;
  wellnessSoreness: number | null;
  wellnessStress: number | null;
  wellnessMood: number | null;
  hasPain: boolean;
  painAreas: PainArea[];
  hasIllness: boolean;
  illnessSymptoms: string[];
  illnessSymptomOther: string;
  illnessNrs: number | null;
  notes?: string;
  customMetricValues?: Record<string, number>;
}

// ── DB row ────────────────────────────────────────────────────────────────────

interface DbRow {
  id: string;
  athlete_connection_id: string;
  date: string;
  wellness_fatigue: number | null;
  wellness_sleep: number | null;
  wellness_soreness: number | null;
  wellness_stress: number | null;
  wellness_mood: number | null;
  has_pain: boolean;
  pain_areas: PainArea[];
  has_illness: boolean;
  illness_symptoms: string[];
  illness_symptom_other: string;
  illness_nrs: number | null;
  // Added via migration: ALTER TABLE athlete_daily_checkins ADD COLUMN IF NOT EXISTS notes TEXT;
  notes: string | null;
  created_at: string;
}

function fromDb(row: DbRow): DailyCheckin {
  return {
    id: row.id,
    athleteId: row.athlete_connection_id,
    date: row.date,
    wellnessFatigue: row.wellness_fatigue,
    wellnessSleep: row.wellness_sleep,
    wellnessSoreness: row.wellness_soreness,
    wellnessStress: row.wellness_stress,
    wellnessMood: row.wellness_mood,
    hasPain: row.has_pain,
    painAreas: row.pain_areas ?? [],
    hasIllness: row.has_illness,
    illnessSymptoms: row.illness_symptoms ?? [],
    illnessSymptomOther: row.illness_symptom_other ?? '',
    illnessNrs: row.illness_nrs,
    notes: row.notes ?? null,
    customMetricValues: null, // saved to athlete_test_results, not fetched back here
    createdAt: row.created_at,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDailyCheckin(connectionId: string | null) {
  const athleteId = connectionId; // alias for internal use
  const { user } = useAuth();
  const [todayCheckin, setTodayCheckin] = useState<DailyCheckin | null | undefined>(undefined);
  const [recentCheckins, setRecentCheckins] = useState<DailyCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!athleteId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: todayRow } = await supabase
        .from('athlete_daily_checkins')
        .select('*')
        .eq('athlete_connection_id', athleteId)
        .eq('date', today)
        .maybeSingle();

      setTodayCheckin(todayRow ? fromDb(todayRow as DbRow) : null);

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { data: recent } = await supabase
        .from('athlete_daily_checkins')
        .select('*')
        .eq('athlete_connection_id', athleteId)
        .gte('date', ninetyDaysAgo.toISOString().slice(0, 10))
        .order('date', { ascending: false });

      setRecentCheckins((recent ?? []).map((r) => fromDb(r as DbRow)));
    } finally {
      setLoading(false);
    }
  }, [athleteId, today]);

  useEffect(() => { load(); }, [load]);

  const saveCheckin = useCallback(async (input: DailyCheckinInput): Promise<boolean> => {
    if (!athleteId || !user) return false;
    const payload: Record<string, unknown> = {
      athlete_connection_id: athleteId,
      date: input.date,
      wellness_fatigue: input.wellnessFatigue,
      wellness_sleep: input.wellnessSleep,
      wellness_soreness: input.wellnessSoreness,
      wellness_stress: input.wellnessStress,
      wellness_mood: input.wellnessMood,
      has_pain: input.hasPain,
      pain_areas: input.painAreas,
      has_illness: input.hasIllness,
      illness_symptoms: input.illnessSymptoms,
      illness_symptom_other: input.illnessSymptomOther,
      illness_nrs: input.illnessNrs,
      // Requires: ALTER TABLE athlete_daily_checkins ADD COLUMN IF NOT EXISTS notes TEXT;
      notes: input.notes ?? null,
    };
    const { data, error } = await supabase
      .from('athlete_daily_checkins')
      .upsert(payload, { onConflict: 'athlete_connection_id,date' })
      .select()
      .single();
    if (error) {
      console.error('saveCheckin:', error);
      // If notes column missing (column not yet added via migration), retry without it
      if (error.code === '42703') {
        delete payload.notes;
        const { data: data2, error: error2 } = await supabase
          .from('athlete_daily_checkins')
          .upsert(payload, { onConflict: 'athlete_connection_id,date' })
          .select()
          .single();
        if (error2) { console.error('saveCheckin (retry):', error2); return false; }
        setTodayCheckin(fromDb(data2 as DbRow));
      } else {
        return false;
      }
    } else {
      setTodayCheckin(fromDb(data as DbRow));
    }

    // Save custom metric values as athlete_test_results entries
    const metricValues = input.customMetricValues ?? {};
    for (const [parameterId, value] of Object.entries(metricValues)) {
      await supabase
        .from('athlete_test_results')
        .insert({
          athlete_connection_id: athleteId,
          parameter_id: parameterId,
          value: String(value),
          recorded_at: new Date().toISOString(),
        })
        .then(({ error: e }) => {
          if (e) console.warn('Failed to save custom metric value:', e);
        });
    }

    await load();
    return true;
  }, [athleteId, user, load]);

  return { todayCheckin, recentCheckins, loading, saveCheckin, reload: load };
}
