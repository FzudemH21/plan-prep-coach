/**
 * Who may change which program (organizations: every coach builds their own programs and changes
 * only those; "edit all" (Programs right) and owners change every program — see programStore).
 */
import { useCallback, useSyncExternalStore } from 'react';
import {
  canEditProgram, getProgramStoreState, mayChangeProgram, programAccess, programAuthorId, subscribeProgramStore,
} from '@/lib/programStore';

export function useProgramAccess() {
  const state = useSyncExternalStore(subscribeProgramStore, getProgramStoreState);
  // (state in the dependencies: the answers change when the store does)
  const canEdit = useCallback((id: string | null | undefined) => canEditProgram(id), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const authorOf = useCallback((id: string) => programAuthorId(id), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return { canEdit, authorOf, ...programAccess() };
}

function activeProgramId(): string | null {
  try { return localStorage.getItem('activeProgramId'); } catch { return null; }
}

/**
 * The program open in the planner, and whether it's another coach's (then the planner is read-only:
 * only navigation works — see PlannerGate). A program that isn't saved yet is always one's own.
 */
export function usePlannerProgram(): {
  /** Can't be changed now: another coach's program, or another coach is editing it (edit lock) */
  readOnly: boolean;
  /** May change it by their rights (own program, "edit all", owner) */
  mayChange: boolean;
  programId: string | null; authorId: string | null; name: string; athleteName: string | null;
  lastModifiedAt: string | null;
} {
  const state = useSyncExternalStore(subscribeProgramStore, getProgramStoreState);
  const id = activeProgramId();
  const program = id ? state.programs.find(p => p.id === id) : undefined;
  return {
    readOnly: !!program && !canEditProgram(program.id),
    mayChange: !program || mayChangeProgram(program.id),
    lastModifiedAt: program?.lastModifiedAt ?? null,
    programId: program?.id ?? null,
    authorId: program ? programAuthorId(program.id) : null,
    name: program?.name ?? '',
    // Stored with the program — for athletes the viewer doesn't reach
    athleteName: program?.athleteName ?? null,
  };
}
