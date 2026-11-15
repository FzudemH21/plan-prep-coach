/**
 * useCoachMemory
 *
 * Provides:
 *   - `coachMemoryContext` — pre-formatted string ready for injection into any
 *     wizard AI system prompt, auto-refreshed when currentMethods changes
 *   - `saveToMemory(program)` — call this after a plan is saved/completed
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchRelevantPlans,
  savePlanMemory,
  buildCoachMemoryContext,
  PlanMemorySummary,
} from '@/lib/planMemory';
import type { TrainingProgram } from '@/hooks/useTrainingPrograms';
import { useDataScope } from '@/hooks/useDataScope';

interface UseCoachMemoryOptions {
  /** Methods active in the current wizard session — used to prioritise relevant past plans */
  currentMethods?: string[];
  /** How many past plans to include in context (default: 5) */
  limit?: number;
}

export function useCoachMemory({
  currentMethods = [],
  limit = 20,
}: UseCoachMemoryOptions = {}) {
  // The organization's plans for members (lib/dataScope)
  const { dataId: programsId } = useDataScope('programs');
  const [plans, setPlans] = useState<PlanMemorySummary[]>([]);
  const [coachMemoryContext, setCoachMemoryContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch whenever the coach or current methods change
  useEffect(() => {
    if (!programsId) return;

    let cancelled = false;
    setIsLoading(true);

    fetchRelevantPlans(programsId, { currentMethods, limit })
      .then((results) => {
        if (cancelled) return;
        setPlans(results);
        setCoachMemoryContext(buildCoachMemoryContext(results));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
    // Stringify currentMethods so the effect only re-runs when the array content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programsId, currentMethods.join(','), limit]);

  /**
   * Persist a plan to `plan_memory` so future wizard sessions can reference it.
   * Call this whenever a plan is saved with status 'active' or 'completed'.
   */
  const saveToMemory = useCallback(
    async (program: TrainingProgram) => {
      if (!programsId) return;
      await savePlanMemory(program, programsId);
      // Refresh context after save
      const results = await fetchRelevantPlans(programsId, { currentMethods, limit });
      setPlans(results);
      setCoachMemoryContext(buildCoachMemoryContext(results));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programsId, currentMethods.join(','), limit],
  );

  return { plans, coachMemoryContext, isLoading, saveToMemory };
}
