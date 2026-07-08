import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type ProgressionDirection = 'progression' | 'regression';

export interface ExerciseProgression {
  id: string;
  fromExerciseId: string;
  toExerciseId: string;
  toExerciseName: string;
  direction: ProgressionDirection;
  level: number;
  notes: string | null;
}

type Row = {
  coach_user_id: string;
  from_exercise_id: string;
  to_exercise_id: string;
  to_exercise_name: string;
  direction: ProgressionDirection;
  level: number;
  notes: string | null;
};

// Insert rows best-effort: try as a batch; on conflict fall back to pair-by-pair so
// a single stale duplicate never blocks the whole set.
async function insertBestEffort(rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('exercise_progressions').insert(rows);
  if (error) {
    for (let i = 0; i < rows.length; i += 2) {
      await supabase
        .from('exercise_progressions')
        .insert(rows.slice(i, Math.min(i + 2, rows.length)));
    }
  }
}

// Build all pairwise cross-links for a single-direction member list and return the rows.
function buildCrossLinkRows(
  userId: string,
  members: ExerciseProgression[],
): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const relLevel = Math.abs(a.level - b.level);
      if (relLevel === 0) continue;
      const closer = a.level < b.level ? a : b;
      const further = a.level < b.level ? b : a;
      const reverseDir: ProgressionDirection =
        a.direction === 'progression' ? 'regression' : 'progression';
      rows.push(
        {
          coach_user_id: userId,
          from_exercise_id: closer.toExerciseId,
          to_exercise_id: further.toExerciseId,
          to_exercise_name: further.toExerciseName,
          direction: a.direction,
          level: relLevel,
          notes: null,
        },
        {
          coach_user_id: userId,
          from_exercise_id: further.toExerciseId,
          to_exercise_id: closer.toExerciseId,
          to_exercise_name: closer.toExerciseName,
          direction: reverseDir,
          level: relLevel,
          notes: null,
        },
      );
    }
  }
  return rows;
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
    toExerciseName: string;
    fromExerciseName: string;
    direction: ProgressionDirection;
    level: number;
    notes: string;
  }) => {
    if (!exerciseId || !user) return;
    const reverseDirection: ProgressionDirection =
      params.direction === 'progression' ? 'regression' : 'progression';

    // Fetch existing same-direction entries for sibling chain links
    const { data: existingChain } = await supabase
      .from('exercise_progressions')
      .select('to_exercise_id, to_exercise_name, level')
      .eq('from_exercise_id', exerciseId)
      .eq('coach_user_id', user.id)
      .eq('direction', params.direction)
      .neq('to_exercise_id', params.toExerciseId);

    // ── 1. Insert the direct pair — this MUST succeed ──────────────────────
    const { data, error } = await supabase
      .from('exercise_progressions')
      .insert([
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
      ])
      .select();

    if (error || !data) return error;

    // Update local state immediately so UI reflects the new entry
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

    // ── 2. Chain rows (best-effort, conflicts silently skipped) ─────────────
    const chainRows: Row[] = [];

    for (const item of (existingChain ?? [])) {
      const itemLevel = item.level as number;
      const itemId = item.to_exercise_id as string;
      const itemName = (item.to_exercise_name as string) || '';
      const relLevel = Math.abs(params.level - itemLevel);
      if (relLevel === 0) continue;

      if (params.level > itemLevel) {
        chainRows.push(
          { coach_user_id: user.id, from_exercise_id: itemId, to_exercise_id: params.toExerciseId, to_exercise_name: params.toExerciseName, direction: params.direction, level: relLevel, notes: null },
          { coach_user_id: user.id, from_exercise_id: params.toExerciseId, to_exercise_id: itemId, to_exercise_name: itemName, direction: reverseDirection, level: relLevel, notes: null },
        );
      } else {
        chainRows.push(
          { coach_user_id: user.id, from_exercise_id: params.toExerciseId, to_exercise_id: itemId, to_exercise_name: itemName, direction: params.direction, level: relLevel, notes: null },
          { coach_user_id: user.id, from_exercise_id: itemId, to_exercise_id: params.toExerciseId, to_exercise_name: params.toExerciseName, direction: reverseDirection, level: relLevel, notes: null },
        );
      }
    }

    // Traverse ancestors (upward chain) so new exercise links into the broader tree
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
        const ancestorCumLevel = (parent?.cumulativeLevel ?? 0) + (entry.level as number);
        const totalLevel = params.level + ancestorCumLevel;

        chainRows.push(
          { coach_user_id: user.id, from_exercise_id: ancestorId, to_exercise_id: params.toExerciseId, to_exercise_name: params.toExerciseName, direction: params.direction, level: totalLevel, notes: null },
          { coach_user_id: user.id, from_exercise_id: params.toExerciseId, to_exercise_id: ancestorId, to_exercise_name: (entry.to_exercise_name as string) || '', direction: reverseDirection, level: totalLevel, notes: null },
        );
        nextQueue.push({ id: ancestorId, cumulativeLevel: ancestorCumLevel });
      }

      ancestorQueue = nextQueue;
    }

    await insertBestEffort(chainRows);
    return null;
  }, [exerciseId, user]);

  const remove = useCallback(async (id: string) => {
    const entry = await supabase
      .from('exercise_progressions')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('exercise_progressions')
      .delete()
      .eq('id', id);

    if (!error && entry.data) {
      const removedExerciseId = entry.data.to_exercise_id as string;
      const removedDirection = entry.data.direction as ProgressionDirection;

      setProgressions(prev => prev.filter(p => p.id !== id));

      // Delete the reverse direct entry (removed → current)
      await supabase
        .from('exercise_progressions')
        .delete()
        .eq('coach_user_id', entry.data.coach_user_id)
        .eq('from_exercise_id', removedExerciseId)
        .eq('to_exercise_id', exerciseId);

      // Fetch remaining chain members in the same direction to clean up cross-links
      const { data: remaining } = await supabase
        .from('exercise_progressions')
        .select('to_exercise_id')
        .eq('from_exercise_id', exerciseId)
        .eq('coach_user_id', entry.data.coach_user_id)
        .eq('direction', removedDirection);

      const remainingIds = (remaining ?? []).map(r => r.to_exercise_id as string);

      if (remainingIds.length > 0) {
        // Delete all cross-links between removed exercise and remaining members
        await Promise.all([
          supabase.from('exercise_progressions').delete()
            .eq('coach_user_id', entry.data.coach_user_id)
            .eq('from_exercise_id', removedExerciseId)
            .in('to_exercise_id', remainingIds),
          supabase.from('exercise_progressions').delete()
            .eq('coach_user_id', entry.data.coach_user_id)
            .in('from_exercise_id', remainingIds)
            .eq('to_exercise_id', removedExerciseId),
        ]);
      }
    }
    return error;
  }, [exerciseId]);

  const updateLevels = useCallback(async (ordered: ExerciseProgression[]) => {
    if (!user) return;
    const updates = ordered.map((p, i) => ({ ...p, level: i + 1 }));

    // Optimistic update
    setProgressions(prev => {
      const ids = new Set(updates.map(u => u.id));
      return [
        ...prev.filter(p => !ids.has(p.id)),
        ...updates,
      ].sort((a, b) => a.direction.localeCompare(b.direction) || a.level - b.level);
    });

    // Persist new levels for the direct entries (exerciseId → each member)
    await Promise.all(updates.map(u =>
      supabase.from('exercise_progressions').update({ level: u.level }).eq('id', u.id)
    ));

    // Rebuild cross-links between members so relative levels stay correct
    const memberIds = updates.map(u => u.toExerciseId);
    if (memberIds.length >= 2) {
      // Delete existing cross-links between members
      await supabase.from('exercise_progressions').delete()
        .eq('coach_user_id', user.id)
        .in('from_exercise_id', memberIds)
        .in('to_exercise_id', memberIds);

      // Re-insert with correct relative levels
      await insertBestEffort(buildCrossLinkRows(user.id, updates));
    }

    // Also update the reverse entries (member → exerciseId) to match new levels
    await Promise.all(updates.map(u =>
      supabase.from('exercise_progressions').update({ level: u.level })
        .eq('coach_user_id', user.id)
        .eq('from_exercise_id', u.toExerciseId)
        .eq('to_exercise_id', exerciseId)
    ));
  }, [user, exerciseId]);

  return { progressions, loading, add, remove, updateLevels, refetch: fetch };
}
