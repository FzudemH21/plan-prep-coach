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
        toExerciseName: (row.to_exercise_name as string) || '',
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
    toExerciseName: string;   // name of the exercise being linked
    fromExerciseName: string; // name of the current exercise (for the reverse entry)
    direction: ProgressionDirection;
    level: number;
    notes: string;
  }) => {
    if (!exerciseId || !user) return;
    const reverseDirection: ProgressionDirection =
      params.direction === 'progression' ? 'regression' : 'progression';

    // Fetch existing entries in the same direction so we can build chain links
    const { data: existingChain } = await supabase
      .from('exercise_progressions')
      .select('to_exercise_id, to_exercise_name, level')
      .eq('from_exercise_id', exerciseId)
      .eq('coach_user_id', user.id)
      .eq('direction', params.direction)
      .neq('to_exercise_id', params.toExerciseId);

    // Build all rows: direct pair + one pair per existing chain member
    type Row = {
      coach_user_id: string;
      from_exercise_id: string;
      to_exercise_id: string;
      to_exercise_name: string;
      direction: ProgressionDirection;
      level: number;
      notes: string | null;
    };

    const rows: Row[] = [
      {
        coach_user_id: user.id,
        from_exercise_id: exerciseId,
        to_exercise_id: params.toExerciseId,
        to_exercise_name: params.toExerciseName,
        direction: params.direction,
        level: params.level,
        notes: params.notes || null,
      },
      {
        coach_user_id: user.id,
        from_exercise_id: params.toExerciseId,
        to_exercise_id: exerciseId,
        to_exercise_name: params.fromExerciseName,
        direction: reverseDirection,
        level: params.level,
        notes: params.notes || null,
      },
    ];

    for (const item of (existingChain ?? [])) {
      const itemLevel = item.level as number;
      const itemExerciseId = item.to_exercise_id as string;
      const itemExerciseName = (item.to_exercise_name as string) || '';
      const relLevel = Math.abs(params.level - itemLevel);
      if (relLevel === 0) continue;

      if (params.level > itemLevel) {
        // New exercise is further along the chain than this item.
        // item → new: same direction (item is closer, new is further)
        // new → item: reverse direction
        rows.push(
          {
            coach_user_id: user.id,
            from_exercise_id: itemExerciseId,
            to_exercise_id: params.toExerciseId,
            to_exercise_name: params.toExerciseName,
            direction: params.direction,
            level: relLevel,
            notes: null,
          },
          {
            coach_user_id: user.id,
            from_exercise_id: params.toExerciseId,
            to_exercise_id: itemExerciseId,
            to_exercise_name: itemExerciseName,
            direction: reverseDirection,
            level: relLevel,
            notes: null,
          },
        );
      } else {
        // New exercise is closer to anchor than this item.
        // new → item: same direction
        // item → new: reverse direction
        rows.push(
          {
            coach_user_id: user.id,
            from_exercise_id: params.toExerciseId,
            to_exercise_id: itemExerciseId,
            to_exercise_name: itemExerciseName,
            direction: params.direction,
            level: relLevel,
            notes: null,
          },
          {
            coach_user_id: user.id,
            from_exercise_id: itemExerciseId,
            to_exercise_id: params.toExerciseId,
            to_exercise_name: params.toExerciseName,
            direction: reverseDirection,
            level: relLevel,
            notes: null,
          },
        );
      }
    }

    // Traverse ancestors of A (exercises "above" A in the opposite direction)
    // so the new exercise is also linked into the broader chain.
    // E.g. if Calf Dribbles → Ankle Dribbles(1) already exists and we add
    // 3-Position Leg Cycle as regression(1) of Ankle Dribbles, Calf Dribbles
    // should automatically get 3-Position Leg Cycle as regression(2).
    const visited = new Set<string>([exerciseId, params.toExerciseId]);
    for (const item of (existingChain ?? [])) visited.add(item.to_exercise_id as string);

    let ancestorQueue: Array<{ id: string; cumulativeLevel: number }> = [
      { id: exerciseId, cumulativeLevel: 0 },
    ];

    while (ancestorQueue.length > 0) {
      const batchIds = ancestorQueue.map(q => q.id);
      const { data: ancestorEntries } = await supabase
        .from('exercise_progressions')
        .select('from_exercise_id, to_exercise_id, to_exercise_name, level')
        .in('from_exercise_id', batchIds)
        .eq('coach_user_id', user.id)
        .eq('direction', reverseDirection);

      const nextQueue: Array<{ id: string; cumulativeLevel: number }> = [];

      for (const entry of (ancestorEntries ?? [])) {
        const ancestorId = entry.to_exercise_id as string;
        if (visited.has(ancestorId)) continue;
        visited.add(ancestorId);

        const parent = ancestorQueue.find(q => q.id === (entry.from_exercise_id as string));
        const parentCumLevel = parent?.cumulativeLevel ?? 0;
        const ancestorCumLevel = parentCumLevel + (entry.level as number);
        const totalLevel = params.level + ancestorCumLevel;

        // ancestor → new exercise: same direction as what we're adding
        // new exercise → ancestor: reverse direction
        rows.push(
          {
            coach_user_id: user.id,
            from_exercise_id: ancestorId,
            to_exercise_id: params.toExerciseId,
            to_exercise_name: params.toExerciseName,
            direction: params.direction,
            level: totalLevel,
            notes: null,
          },
          {
            coach_user_id: user.id,
            from_exercise_id: params.toExerciseId,
            to_exercise_id: ancestorId,
            to_exercise_name: (entry.to_exercise_name as string) || '',
            direction: reverseDirection,
            level: totalLevel,
            notes: null,
          },
        );

        nextQueue.push({ id: ancestorId, cumulativeLevel: ancestorCumLevel });
      }

      ancestorQueue = nextQueue;
    }

    const { data, error } = await supabase
      .from('exercise_progressions')
      .insert(rows)
      .select();

    if (!error && data) {
      const forward = data.find(
        (r: Record<string, unknown>) =>
          r.from_exercise_id === exerciseId && r.to_exercise_id === params.toExerciseId
      );
      if (forward) {
        setProgressions(prev => [...prev, {
          id: forward.id as string,
          fromExerciseId: forward.from_exercise_id as string,
          toExerciseId: forward.to_exercise_id as string,
          toExerciseName: (forward.to_exercise_name as string) || params.toExerciseName,
          direction: forward.direction as ProgressionDirection,
          level: forward.level as number,
          notes: forward.notes as string | null,
        }].sort((a, b) => a.direction.localeCompare(b.direction) || a.level - b.level));
      }
    }
    return error;
  }, [exerciseId, user]);

  const remove = useCallback(async (id: string) => {
    // Find the entry so we can also delete its reverse
    const entry = await supabase
      .from('exercise_progressions')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('exercise_progressions')
      .delete()
      .eq('id', id);

    if (!error) {
      setProgressions(prev => prev.filter(p => p.id !== id));
      // Delete reverse entry (from_exercise_id and to_exercise_id swapped)
      if (entry.data) {
        await supabase
          .from('exercise_progressions')
          .delete()
          .eq('coach_user_id', entry.data.coach_user_id)
          .eq('from_exercise_id', entry.data.to_exercise_id)
          .eq('to_exercise_id', entry.data.from_exercise_id);
      }
    }
    return error;
  }, []);

  // Reorder one direction's list and persist new level numbers.
  // `ordered` is the new ordered array (already reordered by the caller).
  // Level is assigned by position: index 0 = level 1 (closest), etc.
  // For progressions the visual list is reversed (level 1 at bottom), but
  // the caller passes the array in closest-first order regardless.
  const updateLevels = useCallback(async (ordered: ExerciseProgression[]) => {
    const updates = ordered.map((p, i) => ({ ...p, level: i + 1 }));
    // Optimistic update
    setProgressions(prev => {
      const ids = new Set(updates.map(u => u.id));
      return [
        ...prev.filter(p => !ids.has(p.id)),
        ...updates,
      ].sort((a, b) => a.direction.localeCompare(b.direction) || a.level - b.level);
    });
    // Persist
    await Promise.all(updates.map(u =>
      supabase.from('exercise_progressions').update({ level: u.level }).eq('id', u.id)
    ));
  }, []);

  return { progressions, loading, add, remove, updateLevels, refetch: fetch };
}
