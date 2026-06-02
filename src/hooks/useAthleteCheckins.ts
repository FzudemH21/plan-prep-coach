// Coach-side hook — reads daily check-ins for a given athlete

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CheckinPainArea {
  regionKey?: string;  // new format
  areaId?: number;     // legacy
  areaLabel: string;
  severity: number;
}

export interface AthleteCheckin {
  id: string;
  date: string; // yyyy-MM-dd
  wellnessFatigue:  number | null;
  wellnessSleep:    number | null;
  wellnessSoreness: number | null;
  wellnessStress:   number | null;
  wellnessMood:     number | null;
  hasPain: boolean;
  painAreas: CheckinPainArea[];
  hasIllness: boolean;
  illnessSymptoms: string[];
  illnessSymptomOther: string;
  illnessNrs: number | null;
  createdAt: string;
}

function fromRow(r: Record<string, unknown>): AthleteCheckin {
  return {
    id:               r.id as string,
    date:             r.date as string,
    wellnessFatigue:  (r.wellness_fatigue  as number) ?? null,
    wellnessSleep:    (r.wellness_sleep    as number) ?? null,
    wellnessSoreness: (r.wellness_soreness as number) ?? null,
    wellnessStress:   (r.wellness_stress   as number) ?? null,
    wellnessMood:     (r.wellness_mood     as number) ?? null,
    hasPain:          (r.has_pain  as boolean) ?? false,
    painAreas:        (r.pain_areas  as CheckinPainArea[]) ?? [],
    hasIllness:       (r.has_illness as boolean) ?? false,
    illnessSymptoms:  (r.illness_symptoms  as string[]) ?? [],
    illnessSymptomOther: (r.illness_symptom_other as string) ?? '',
    illnessNrs:       (r.illness_nrs as number) ?? null,
    createdAt:        r.created_at as string,
  };
}

// ── Stats helpers (exported for use in the UI) ────────────────────────────────

export function wellnessComposite(c: AthleteCheckin): number | null {
  const vals = [c.wellnessFatigue, c.wellnessSleep, c.wellnessSoreness, c.wellnessStress, c.wellnessMood]
    .filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export interface WellnessStats { mean: number; sd: number; n: number }

export function computeWellnessStats(checkins: AthleteCheckin[]): WellnessStats | null {
  const composites = checkins.map(wellnessComposite).filter((v): v is number => v !== null);
  if (composites.length < 5) return null; // need at least 5 data points
  const mean = composites.reduce((a, b) => a + b, 0) / composites.length;
  const sd   = Math.sqrt(composites.reduce((a, b) => a + (b - mean) ** 2, 0) / composites.length);
  return { mean, sd, n: composites.length };
}

export function zScore(composite: number, stats: WellnessStats): number | null {
  if (stats.sd < 0.05) return null;
  return (composite - stats.mean) / stats.sd;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAthleteCheckins(athleteId: string | null, days = 90) {
  const [checkins, setCheckins] = useState<AthleteCheckin[]>([]);
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    if (!athleteId) { setCheckins([]); return; }
    setLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - days);
    const { data, error } = await supabase
      .from('athlete_daily_checkins')
      .select('*')
      .eq('athlete_id', athleteId)
      .gte('date', from.toISOString().slice(0, 10))
      .order('date', { ascending: false });
    if (!error && data) setCheckins(data.map(r => fromRow(r as Record<string, unknown>)));
    setLoading(false);
  }, [athleteId, days]);

  useEffect(() => { load(); }, [load]);

  return { checkins, loading, reload: load };
}
