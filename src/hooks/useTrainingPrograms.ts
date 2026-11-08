import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from './useAuth';
import {
  ensureProgramsLoaded, getProgramStoreState, markProgramDeleted, putPrograms, resetProgramStore, subscribeProgramStore,
} from '@/lib/programStore';
import { savePlanMemory } from '@/lib/planMemory';
import { snapshotProgram } from '@/lib/programVersions';
import { bindTabToProgram, programSwitchedElsewhere, ProgramOpenElsewhereError } from '@/lib/wizardTabProgram';
import { isProgramChatId } from '@/contexts/AIChatContext';
import { PlanDuration, SmartGoal, SubGoal, Event, TrainableQuality, IntensityLevel } from '@/types/training';

// Interface for manually added methods
interface ManuallyAddedMethod {
  methodId: string;
  rationale?: string;
}

// Core training program interface
export interface TrainingProgram {
  id: string;
  name: string;
  athleteId: string | null;
  athleteName: string | null;
  primaryGoal: string;
  duration: {
    startDate: string;
    endDate: string;
    weeks: number;
  };
  createdAt: string;
  lastModifiedAt: string;
  status: 'draft' | 'active' | 'completed' | 'archived';

  // Persisted AI chat history keyed by chatId (wizard step label)
  aiConversations: Record<string, import('@/utils/anthropicApi').Message[]> | null;

  // Macrocycle data
  macrocycleData: {
    planName: string;
    selectedAthleteId: string | null;
    planDuration: PlanDuration | null;
    smartGoals: SmartGoal[];
    subGoals: SubGoal[];
    events: Event[];
    qualities: TrainableQuality[];
    qualitiesBySubGoal: Record<string, { label: string; list: string[] }>;
    methodsByQuality: Record<string, { subGoalLabel: string; qualityName: string; list: string[] }>;
    selectedTest: string | null;
    selectedEvent: string | null;
    selectedMethods: string[];
    manuallyAddedMethods: ManuallyAddedMethod[];
  } | null;

  // Mesocycle data
  mesocycleData: any | null;

  // Microcycle planning data
  trainingDays: any[] | null;
  exerciseDistribution: any[] | null;
  parameterValues: Record<string, any> | null;
  dailyIntensityData: any[] | null;
  daySplitStates: Record<string, number> | null;
  sessionSections: Record<string, any[]> | null;
  supersets: Record<string, Record<string, string>> | null;
  methodAllocations: Record<string, string[]> | null;

  /**
   * Raw localStorage values of the EXTRA_SESSION_KEYS below, keyed by storage key.
   * Optional: programs saved before 2026-09-25 don't have it.
   */
  extraSessionState?: Record<string, string> | null;
}

/**
 * Wizard state that belongs to one program but has no TrainingProgram field of its own.
 * These used to live only in global localStorage — never saved with the program and
 * never cleared — so they showed up in every other program (e.g. day→method assignments
 * appearing as ghost methods in a new program). Now saved, restored and cleared per program.
 */
const EXTRA_SESSION_KEYS = [
  'dayMethodAssignments',     // Microcycle step 1: which methods sit on which day
  'microcyclePlanningState',  // Microcycle planning table cell data
  'exerciseSelectionData',    // Mesocycle step 5: exercises per method × mesocycle
  'mesocycleNotes',           // Mesocycle descriptions
  'categorySplitStates',      // Methods split by exercise category in the periodization table
  'manuallyAddedMethods',     // Legacy Mesocycle-level manual methods
] as const;

/**
 * Settings that used to be one per browser (never stored in Supabase) and are now saved with the
 * program: which parameters each method shows in the periodization table, and the order of the
 * method categories. A program saved before this has none — it keeps the current settings (so
 * nothing set up disappears) and stores them with its next save. Never cleared.
 */
const CARRY_OVER_KEYS = ['methodParameterVisibility', 'methodCategoryOrder'] as const;

/**
 * Per-session keys ({prefix}{mesocycleId}_{yyyy-MM-dd}_{sessionIndex}): session comments +
 * parameter visibility, session intensities, the session sheet's saved sections. Saved with the
 * program inside extraSessionState, restored on load, cleared on switch.
 */
const SESSION_KEY_PREFIXES = ['workoutSessions_', 'sessionIntensity_', 'workoutSections_'] as const;
// Keys scoped to an athlete-calendar assignment ("{prefix}@{assignmentId}@…") are not the program's
const isSessionKey = (key: string) => SESSION_KEY_PREFIXES.some(p => key.startsWith(p) && !key.startsWith(`${p}@`));
// Legacy prefixes that are only ever cleared
const LEGACY_SESSION_KEY_PREFIXES = ['sessionIntensities_', 'sessionNames_', 'exercises_', 'sessionComments_'];

const readExtraSessionState = (): Record<string, string> => {
  const state: Record<string, string> = {};
  [...EXTRA_SESSION_KEYS, ...CARRY_OVER_KEYS].forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) state[key] = value;
  });

  // Per-session keys of this program only: its mesocycles and training days. These keys used to
  // survive program switches, so browser storage can still hold other programs' entries.
  let planDates: Set<string> | null = null;
  let mesoIds: Set<string> | null = null;
  try {
    const days = JSON.parse(localStorage.getItem('trainingDays') ?? '[]') as Array<{ date?: string }>;
    if (Array.isArray(days) && days.length > 0) planDates = new Set(days.map(d => d.date ?? ''));
    const meso = JSON.parse(localStorage.getItem('mesocycleData') ?? 'null') as { mesocycles?: Array<{ id?: string }> } | null;
    if (meso?.mesocycles?.length) mesoIds = new Set(meso.mesocycles.map(m => m.id ?? ''));
  } catch { /* keep all */ }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isSessionKey(key)) continue;
    const match = key.match(/^[A-Za-z]+_(.+)_(\d{4}-\d{2}-\d{2})_\d+$/);
    if (match) {
      if (mesoIds && !mesoIds.has(match[1])) continue;
      if (planDates && !planDates.has(match[2])) continue;
    }
    const value = localStorage.getItem(key);
    if (value !== null) state[key] = value;
  }
  return state;
};

const removeSessionKeys = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (isSessionKey(key) || LEGACY_SESSION_KEY_PREFIXES.some(p => key.startsWith(p)))) keys.push(key);
  }
  keys.forEach(key => localStorage.removeItem(key));
};

const removeExtraSessionKeys = () => {
  EXTRA_SESSION_KEYS.forEach(key => localStorage.removeItem(key));
  removeSessionKeys();
};

type ChatMap = Record<string, import('@/utils/anthropicApi').Message[]>;

const readChatsFromLS = (): ChatMap => {
  try { return JSON.parse(localStorage.getItem('aiConversations') ?? '{}') as ChatMap; } catch { return {}; }
};

/** Keep only program chats (isProgramChatId === keep) or only global chats (=== !keep). */
const filterChats = (chats: ChatMap | null | undefined, keepProgramChats: boolean): ChatMap =>
  Object.fromEntries(Object.entries(chats ?? {}).filter(([id]) => isProgramChatId(id) === keepProgramChats));

export interface TrainingProgramsData {
  version: number;
  programs: TrainingProgram[];
  /** Ids of programs deleted on purpose — the only way a program may leave the list */
  deletedProgramIds?: string[];
}

/** Of a recovered list, the programs a restore would add or replace (see restorePrograms) */
export function programsToRestore(recovered: TrainingProgramsData, current: TrainingProgramsData): TrainingProgram[] {
  const deleted = new Set(current.deletedProgramIds ?? []);
  const byId = new Map(current.programs.map(p => [p.id, p]));
  return (Array.isArray(recovered?.programs) ? recovered.programs : []).filter(p => {
    if (!p?.id || deleted.has(p.id)) return false;
    const stored = byId.get(p.id);
    return !stored || (p.lastModifiedAt ?? '') > (stored.lastModifiedAt ?? '');
  });
}

const generateId = () => `prog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function useTrainingPrograms() {
  const { user, loading: authLoading } = useAuth();
  // One row per program, shared by every component of this tab (see programStore.ts)
  const store = useSyncExternalStore(subscribeProgramStore, getProgramStoreState);
  useEffect(() => {
    if (user) void ensureProgramsLoaded(user.id);
    else if (!authLoading) resetProgramStore();
  }, [user, authLoading]);
  const ownStore = !!user && store.userId === user.id;
  const isLoading = user ? !ownStore || store.status === 'idle' || store.status === 'loading' : authLoading;
  const data = useMemo<TrainingProgramsData>(() => ({
    version: 1,
    programs: ownStore ? store.programs : [],
    deletedProgramIds: ownStore ? Object.keys(store.deleted) : [],
  }), [ownStore, store.programs, store.deleted]);

  // Get all programs
  const getPrograms = useCallback(() => {
    return data.programs;
  }, [data.programs]);

  // Get a single program by ID
  const getProgram = useCallback((id: string) => {
    return data.programs.find(p => p.id === id) || null;
  }, [data.programs]);

  // Save or update a program
  const saveProgram = useCallback(async (program: Partial<TrainingProgram> & { id?: string }): Promise<TrainingProgram> => {
    const now = new Date().toISOString();

    if (program.id) {
      // The newest stored version (not this render's copy, which can be a save behind)
      const existing = getProgramStoreState().programs.find(p => p.id === program.id);
      if (existing) {
        const updated: TrainingProgram = {
          ...existing,
          ...program,
          lastModifiedAt: now,
        };
        await putPrograms([updated]);
        // Persist summary to plan_memory in the background (non-blocking)
        if (user) savePlanMemory(updated, user.id).catch(() => {});
        // Version history in the background (at most one version per hour; never blocks the save)
        if (user) void snapshotProgram(updated, user.id);
        return updated;
      }
    }

    const newProgram: TrainingProgram = {
      id: generateId(),
      name: program.name || 'Untitled Program',
      athleteId: program.athleteId || null,
      athleteName: program.athleteName || null,
      primaryGoal: program.primaryGoal || '',
      duration: program.duration || { startDate: '', endDate: '', weeks: 0 },
      createdAt: now,
      lastModifiedAt: now,
      status: program.status || 'draft',
      macrocycleData: program.macrocycleData || null,
      mesocycleData: program.mesocycleData || null,
      trainingDays: program.trainingDays || null,
      exerciseDistribution: program.exerciseDistribution || null,
      parameterValues: program.parameterValues || null,
      dailyIntensityData: program.dailyIntensityData || null,
      daySplitStates: program.daySplitStates || null,
      sessionSections: program.sessionSections || null,
      supersets: program.supersets || null,
      methodAllocations: program.methodAllocations || null,
      aiConversations: program.aiConversations || null,
      extraSessionState: program.extraSessionState || null,
    };

    await putPrograms([newProgram]);
    // Persist summary to plan_memory in the background (non-blocking)
    if (user) savePlanMemory(newProgram, user.id).catch(() => {});
    if (user) void snapshotProgram(newProgram, user.id);
    return newProgram;
  }, [user]);

  // Copy a program
  const copyProgram = useCallback(async (id: string): Promise<TrainingProgram | null> => {
    const original = data.programs.find(p => p.id === id);
    if (!original) return null;

    const now = new Date().toISOString();
    const copy: TrainingProgram = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      createdAt: now,
      lastModifiedAt: now,
      status: 'draft',
    };

    await putPrograms([copy]);
    return copy;
  }, [data]);

  // Delete a program
  const deleteProgram = useCallback(async (id: string): Promise<boolean> => {
    const index = data.programs.findIndex(p => p.id === id);
    if (index < 0) return false;

    // Its last state stays in the version history (and in its row, marked deleted), so a deleted
    // program can be brought back
    if (user) void snapshotProgram(data.programs[index], user.id, 'deleted');
    await markProgramDeleted(id);
    return true;
  }, [data, user]);

  /**
   * Puts a program back to an earlier version (also a deleted one). The state it has now is kept
   * in the version history first, so the restore itself can be undone.
   */
  const restoreProgramVersion = useCallback(async (version: TrainingProgram): Promise<TrainingProgram> => {
    const current = data.programs.find(p => p.id === version.id);
    if (current && user) await snapshotProgram(current, user.id, 'before-restore');
    const restored: TrainingProgram = { ...version, lastModifiedAt: new Date().toISOString() };
    await putPrograms([restored]);
    return restored;
  }, [data, user]);

  /**
   * Before the session is replaced, write the open program's extra wizard state into it.
   * Normally auto-save already has it, but programs saved before extraSessionState existed
   * only get it on their next edit — without this, switching away first would lose it.
   * Skipped when nothing changed, so it doesn't bump lastModifiedAt needlessly.
   */
  const flushExtraStateToActiveProgram = useCallback((exceptId?: string) => {
    const activeId = localStorage.getItem('activeProgramId');
    if (!activeId || activeId === exceptId) return;
    const active = data.programs.find(p => p.id === activeId);
    if (!active) return;
    const snapshot = readExtraSessionState();
    if (JSON.stringify(active.extraSessionState ?? {}) === JSON.stringify(snapshot)) return;
    saveProgram({ id: activeId, extraSessionState: snapshot }).catch(() => {});
  }, [data.programs, saveProgram]);

  // Load program data into the active session (localStorage keys used by wizard)
  // `programOverride`: load this version instead of the stored one (a just-restored version — the
  // list in this render doesn't have it yet). It replaces the open plan, so nothing is flushed.
  const loadProgramIntoSession = useCallback((id: string, programOverride?: TrainingProgram): boolean => {
    const program = programOverride ?? data.programs.find(p => p.id === id);
    if (!program) return false;

    const reopeningActiveProgram = localStorage.getItem('activeProgramId') === id;
    if (!programOverride) flushExtraStateToActiveProgram(id);

    const keysToCheck = [
      'macrocycleData', 'mesocycleData', 'trainingDays', 'exerciseDistribution',
      'parameterValues', 'dailyIntensityData', 'daySplitStates', 'sessionSections',
      'supersets', 'methodAllocations', 'macrocycleStep', 'mesocycleStep', 'microcycleStep',
    ];
    keysToCheck.forEach(key => localStorage.removeItem(key));

    if (program.macrocycleData) localStorage.setItem('macrocycleData', JSON.stringify(program.macrocycleData));
    if (program.mesocycleData) localStorage.setItem('mesocycleData', JSON.stringify(program.mesocycleData));
    if (program.trainingDays) localStorage.setItem('trainingDays', JSON.stringify(program.trainingDays));
    if (program.exerciseDistribution) localStorage.setItem('exerciseDistribution', JSON.stringify(program.exerciseDistribution));
    if (program.parameterValues) localStorage.setItem('parameterValues', JSON.stringify(program.parameterValues));
    if (program.dailyIntensityData) localStorage.setItem('dailyIntensityData', JSON.stringify(program.dailyIntensityData));
    if (program.daySplitStates) localStorage.setItem('daySplitStates', JSON.stringify(program.daySplitStates));
    if (program.sessionSections) localStorage.setItem('sessionSections', JSON.stringify(program.sessionSections));
    if (program.supersets) localStorage.setItem('supersets', JSON.stringify(program.supersets));
    if (program.methodAllocations) localStorage.setItem('methodAllocations', JSON.stringify(program.methodAllocations));

    // Extra wizard state: restore this program's own copy. When reopening the program that
    // is already open, localStorage is the live (newest) state, so leave it untouched — unless a
    // restored version replaces it.
    if (!reopeningActiveProgram || programOverride) {
      const hasSavedSessionKeys = Object.keys(program.extraSessionState ?? {}).some(isSessionKey);
      if (hasSavedSessionKeys) {
        removeExtraSessionKeys();
      } else {
        // Migration: saved before per-session keys were stored with the program — keep the ones
        // on this program's dates (what it showed so far); its next save stores them
        EXTRA_SESSION_KEYS.forEach(key => localStorage.removeItem(key));
        const planDates = new Set((program.trainingDays ?? []).map((d: { date?: string }) => d.date ?? ''));
        const stale: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (LEGACY_SESSION_KEY_PREFIXES.some(pf => key.startsWith(pf))) { stale.push(key); continue; }
          if (!isSessionKey(key)) continue;
          const date = key.match(/_(\d{4}-\d{2}-\d{2})_\d+$/)?.[1];
          if (!date || !planDates.has(date)) stale.push(key);
        }
        stale.forEach(key => localStorage.removeItem(key));
      }
      Object.entries(program.extraSessionState ?? {}).forEach(([key, value]) => {
        if ((EXTRA_SESSION_KEYS as readonly string[]).includes(key) || (CARRY_OVER_KEYS as readonly string[]).includes(key) || isSessionKey(key)) localStorage.setItem(key, value);
      });
    }

    localStorage.setItem('activeProgramId', id);
    bindTabToProgram(id);

    // Restore this program's AI conversation so initChatsFromLocalStorage() picks it up.
    // Global chats (Parameter Database, Toolbox, …) stay as they are — older programs also
    // saved copies of those, which are ignored here.
    localStorage.setItem('aiConversations', JSON.stringify({
      ...filterChats(readChatsFromLS(), false),
      ...filterChats(program.aiConversations, true),
    }));

    return true;
  }, [data.programs, flushExtraStateToActiveProgram]);

  // Collect current session data to save as a program
  const collectSessionData = useCallback((): Partial<TrainingProgram> => {
    const get = (key: string) => {
      try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : null;
      } catch { return null; }
    };

    const macrocycleData = get('macrocycleData');
    const mesocycleData = get('mesocycleData');

    let name = 'Untitled Program';
    let athleteId: string | null = null;
    let athleteName: string | null = null;
    let primaryGoal = '';
    let duration = { startDate: '', endDate: '', weeks: 0 };

    if (macrocycleData) {
      name = macrocycleData.planName || 'Untitled Program';
      athleteId = macrocycleData.selectedAthleteId || null;
      if (macrocycleData.smartGoals?.length > 0) primaryGoal = macrocycleData.smartGoals[0].description || '';
      if (macrocycleData.planDuration) {
        const pd = macrocycleData.planDuration;
        duration = {
          startDate: pd.startDate ? new Date(pd.startDate).toISOString() : '',
          endDate: pd.endDate ? new Date(pd.endDate).toISOString() : '',
          weeks: pd.totalWeeks || 0,
        };
      }
    }

    return {
      name, athleteId, athleteName, primaryGoal, duration,
      macrocycleData,
      mesocycleData,
      trainingDays: get('trainingDays'),
      exerciseDistribution: get('exerciseDistribution'),
      parameterValues: get('parameterValues'),
      dailyIntensityData: get('dailyIntensityData'),
      daySplitStates: get('daySplitStates'),
      sessionSections: get('sessionSections'),
      supersets: get('supersets'),
      methodAllocations: get('methodAllocations'),
      aiConversations: filterChats(readChatsFromLS(), true),
      extraSessionState: readExtraSessionState(),
    };
  }, []);

  // Save current session as a new program or update existing
  const saveCurrentSession = useCallback(async (overrideData?: Partial<TrainingProgram>): Promise<TrainingProgram> => {
    // Another tab opened a different program: the wizard state in browser storage is now that
    // program's (mixed with this tab's), and saving would write it into the wrong program
    if (programSwitchedElsewhere()) throw new ProgramOpenElsewhereError();
    const activeProgramId = localStorage.getItem('activeProgramId');
    const sessionData = collectSessionData();

    const programData = {
      ...sessionData,
      ...overrideData,
      id: activeProgramId || undefined,
    };

    const saved = await saveProgram(programData);
    localStorage.setItem('activeProgramId', saved.id);
    bindTabToProgram(saved.id);
    return saved;
  }, [collectSessionData, saveProgram]);

  // Clear session and start fresh
  const clearSession = useCallback(() => {
    flushExtraStateToActiveProgram();
    removeExtraSessionKeys();

    const staticKeys = [
      'macrocycleData', 'mesocycleData', 'trainingDays', 'exerciseDistribution',
      'parameterValues', 'dailyIntensityData', 'daySplitStates', 'sessionSections',
      'supersets', 'methodAllocations', 'macrocycleStep', 'mesocycleStep', 'microcycleStep', 'activeProgramId',
    ];
    staticKeys.forEach(key => localStorage.removeItem(key));
    bindTabToProgram(null);
    // Drop the program's AI conversation but keep global chats (Parameter Database, Toolbox, …)
    localStorage.setItem('aiConversations', JSON.stringify(filterChats(readChatsFromLS(), false)));
  }, [flushExtraStateToActiveProgram]);

  // Update program status
  const updateProgramStatus = useCallback(async (id: string, status: TrainingProgram['status']): Promise<boolean> => {
    const program = data.programs.find(p => p.id === id);
    if (!program) return false;
    await saveProgram({ id, status });
    return true;
  }, [data.programs, saveProgram]);

  // Merge seed/demo programs into the store in a single atomic Supabase write.
  // Upserts by id: replaces existing entries, prepends new ones.
  const mergeSeedPrograms = useCallback(async (
    seedPrograms: Array<{ id: string; [key: string]: unknown }>,
  ): Promise<void> => {
    const now = new Date().toISOString();
    const changed = seedPrograms.map(seed => {
      const existing = data.programs.find(p => p.id === seed.id);
      return existing
        ? { ...existing, ...(seed as unknown as TrainingProgram), lastModifiedAt: now }
        : { ...(seed as unknown as TrainingProgram), createdAt: now, lastModifiedAt: now };
    });
    await putPrograms(changed);
  }, [data]);

  /** Restore programs from a saved/recovered program list: missing ones are added, and of a
   *  program in both, the newer version wins. Programs deleted on purpose stay deleted (they come
   *  back under "Deleted programs"). Returns how many changed. */
  const restorePrograms = useCallback(async (recovered: TrainingProgramsData): Promise<number> => {
    const changed = programsToRestore(recovered, data);
    await putPrograms(changed);
    return changed.length;
  }, [data]);

  // Get programs sorted by last modified
  const getRecentPrograms = useCallback((limit?: number) => {
    const sorted = [...data.programs].sort((a, b) =>
      new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }, [data.programs]);

  return {
    programs: data.programs,
    /** While loading: the library's columns of every program, to show meanwhile (not for saving) */
    programSummaries: ownStore && isLoading ? store.summaries : [],
    /** Programs deleted on purpose (kept, marked deleted) */
    deletedProgramIds: data.deletedProgramIds ?? [],
    isLoading,
    getPrograms,
    getProgram,
    saveProgram,
    copyProgram,
    deleteProgram,
    restorePrograms,
    restoreProgramVersion,
    loadProgramIntoSession,
    collectSessionData,
    saveCurrentSession,
    clearSession,
    updateProgramStatus,
    getRecentPrograms,
    mergeSeedPrograms,
  };
}
