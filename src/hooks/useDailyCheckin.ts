import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PainArea {
  areaId: number;
  areaLabel: string;
  severity: number; // NRS 0–10
}

export type IllnessSeverity = 'mild' | 'moderate' | 'severe';
export type IllnessType = 'cold_flu' | 'stomach' | 'fever' | 'other';

export interface DailyCheckin {
  id: string;
  athleteId: string;
  date: string; // yyyy-MM-dd
  // McLean 5-item (1–5)
  wellnessFatigue: number | null;
  wellnessSleep: number | null;
  wellnessSoreness: number | null;
  wellnessStress: number | null;
  wellnessMood: number | null;
  // Pain
  hasPain: boolean;
  painAreas: PainArea[];
  // Illness
  hasIllness: boolean;
  illnessType: IllnessType | null;
  illnessTypeOther: string | null;
  illnessSeverity: IllnessSeverity | null;
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
  illnessType: IllnessType | null;
  illnessTypeOther: string | null;
  illnessSeverity: IllnessSeverity | null;
}

// ── DB row shape ──────────────────────────────────────────────────────────────

interface DbRow {
  id: string;
  athlete_id: string;
  date: string;
  wellness_fatigue: number | null;
  wellness_sleep: number | null;
  wellness_soreness: number | null;
  wellness_stress: number | null;
  wellness_mood: number | null;
  has_pain: boolean;
  pain_areas: PainArea[];
  has_illness: boolean;
  illness_type: IllnessType | null;
  illness_type_other: string | null;
  illness_severity: IllnessSeverity | null;
  created_at: string;
}

function fromDb(row: DbRow): DailyCheckin {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    date: row.date,
    wellnessFatigue: row.wellness_fatigue,
    wellnessSleep: row.wellness_sleep,
    wellnessSoreness: row.wellness_soreness,
    wellnessStress: row.wellness_stress,
    wellnessMood: row.wellness_mood,
    hasPain: row.has_pain,
    painAreas: row.pain_areas ?? [],
    hasIllness: row.has_illness,
    illnessType: row.illness_type,
    illnessTypeOther: row.illness_type_other,
    illnessSeverity: row.illness_severity,
    createdAt: row.created_at,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDailyCheckin(athleteId: string | null) {
  const { user } = useAuth();
  const [todayCheckin, setTodayCheckin] = useState<DailyCheckin | null | undefined>(undefined);
  // undefined = not yet loaded, null = loaded but none exists
  const [recentCheckins, setRecentCheckins] = useState<DailyCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!athleteId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Today's check-in
      const { data: todayRow } = await supabase
        .from('athlete_daily_checkins')
        .select('*')
        .eq('athlete_id', athleteId)
        .eq('date', today)
        .maybeSingle();

      setTodayCheckin(todayRow ? fromDb(todayRow as DbRow) : null);

      // Last 90 days for the analysis tab
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { data: recent } = await supabase
        .from('athlete_daily_checkins')
        .select('*')
        .eq('athlete_id', athleteId)
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
    const payload = {
      athlete_id: athleteId,
      date: input.date,
      wellness_fatigue: input.wellnessFatigue,
      wellness_sleep: input.wellnessSleep,
      wellness_soreness: input.wellnessSoreness,
      wellness_stress: input.wellnessStress,
      wellness_mood: input.wellnessMood,
      has_pain: input.hasPain,
      pain_areas: input.painAreas,
      has_illness: input.hasIllness,
      illness_type: input.illnessType,
      illness_type_other: input.illnessTypeOther,
      illness_severity: input.illnessSeverity,
    };
    const { data, error } = await supabase
      .from('athlete_daily_checkins')
      .upsert(payload, { onConflict: 'athlete_id,date' })
      .select()
      .single();
    if (error) { console.error('saveCheckin:', error); return false; }
    setTodayCheckin(fromDb(data as DbRow));
    await load();
    return true;
  }, [athleteId, user, load]);

  return { todayCheckin, recentCheckins, loading, saveCheckin, reload: load };
}
