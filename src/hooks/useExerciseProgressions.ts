import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type ProgressionDirection = 'progression' | 'regression';

export interface ExerciseProgression {
  id: string;
  fromExerciseId: string;
  toExerciseId: string;
  toExerciseName: string;  // resolved client-side from library
  direction: ProgressionDirection;
  level: number;
  notes: string | null;
}

export function useExerciseProgressions(exerciseId: string | null) {
  const { user } = useAuth();
  const [progressions, setProgressions] = useState<ExerciseProgression[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!exerciseId || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('exercise_progressions')
      .select('*')
      .eq('from_exercise_id', exerciseId)
      .eq('coach_user_id', user.id)
      .order('direction')
      .order('level');
    if (!error && data) {
      setProgressions(data.map(row => ({
        id: row.id as string,
        fromExerciseId: row.from_exercise_id as string,
        toExerciseId: row.to_exercise_id as string,
        toExerciseName: '',   // caller resolves from library
        direction: row.direction as ProgressionDirection,
        level: row.level as number,
        notes: row.notes as string | null,
      })));
    }
    setLoading(false);
  }, [exerciseId, user]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (params: {
    toExerciseId: string;
    direction: ProgressionDirection;
    level: number;
    notes: string;
  }) => {
    if (!exerciseId || !user) return;
    const { data, error } = await supabase
      .from('exercise_progressions')
      .insert({
        coach_user_id: user.id,
        from_exercise_id: exerciseId,
        to_exercise_id: params.toExerciseId,
        direction: params.direction,
        level: params.level,
        notes: params.notes || null,
      })
      .select()
      .single();
    if (!error && data) {
      setProgressions(prev => [...prev, {
        id: data.id as string,
        fromExerciseId: data.from_exercise_id as string,
        toExerciseId: data.to_exercise_id as string,
        toExerciseName: '',
        direction: data.direction as ProgressionDirection,
        level: data.level as number,
        notes: data.notes as string | null,
      }].sort((a, b) => a.direction.localeCompare(b.direction) || a.level - b.level));
    }
    return error;
  }, [exerciseId, user]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('exercise_progressions')
      .delete()
      .eq('id', id);
    if (!error) {
      setProgressions(prev => prev.filter(p => p.id !== id));
    }
    return error;
  }, []);

  return { progressions, loading, add, remove, refetch: fetch };
}
