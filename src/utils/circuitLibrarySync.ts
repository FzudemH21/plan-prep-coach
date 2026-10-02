import type { Circuit, CustomLibrary } from '@/contexts/CustomLibrariesContext';
import type { ExerciseDistribution } from '@/types/microcycle-planning';

/**
 * Circuits placed in a program are copies of a library circuit. They follow the library
 * ("auto-update unless edited"):
 * - `circuitLibraryBaseline` is a hash of the library version the placement was last taken from.
 * - Placement unchanged since then + library changed → updated automatically.
 * - Placement edited in the program + library changed → kept; flagged "Library version changed — update?".
 * - Placements without a baseline (older data) are never overwritten — only flagged when they differ.
 */

const s = (v: unknown) => (v == null ? '' : String(v));

type CircuitContent = {
  name: string;
  rounds: string;
  restBetweenRounds: string;
  restBetweenExercises: string;
  comments: string;
  exercises: Circuit['exercises'];
};

const signatureOf = (c: CircuitContent): string =>
  JSON.stringify([
    s(c.name).trim(),
    s(c.rounds),
    s(c.restBetweenRounds),
    s(c.restBetweenExercises),
    s(c.comments),
    [...(c.exercises ?? [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(e => [s(e.exerciseId), s(e.exerciseName), s(e.sets), s(e.reps), s(e.time), s(e.distance), (e.enabledParams ?? []).join(',')]),
  ]);

const librarySignature = (c: Circuit) =>
  signatureOf({
    name: c.name,
    rounds: s(c.rounds),
    restBetweenRounds: c.restBetweenRounds,
    restBetweenExercises: c.restBetweenExercises,
    comments: s(c.comments),
    exercises: c.exercises,
  });

/** Placements made before rounds were stored don't have them — compare with the library's rounds then */
const placementSignature = (p: ExerciseDistribution, libraryRounds?: string) =>
  signatureOf({
    name: p.exerciseName,
    rounds: p.circuitRounds ?? s(libraryRounds),
    restBetweenRounds: s(p.circuitRestBetweenRounds),
    restBetweenExercises: s(p.circuitRestBetweenExercises),
    comments: s(p.circuitComments),
    exercises: p.circuitExercises ?? [],
  });

/** Short stable hash (djb2) — the baseline only needs to tell versions apart */
const hash = (text: string): string => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export const libraryCircuitVersion = (c: Circuit) => hash(librarySignature(c));

/** The library circuit a placement comes from (its own library first, then any library) */
export function findLibraryCircuit(
  libraries: CustomLibrary[],
  circuitId: string | undefined,
  libraryId?: string,
): { circuit: Circuit; libraryId: string } | null {
  if (!circuitId) return null;
  const own = libraryId ? libraries.find(l => l.id === libraryId) : undefined;
  const inOwn = own?.circuits?.find(c => c.id === circuitId);
  if (own && inOwn) return { circuit: inOwn, libraryId: own.id };
  for (const lib of libraries) {
    const c = lib.circuits?.find(x => x.id === circuitId);
    if (c) return { circuit: c, libraryId: lib.id };
  }
  return null;
}

/** Placement with the library circuit's current content (and the new baseline) */
export function applyLibraryCircuit(p: ExerciseDistribution, circuit: Circuit, libraryId: string): ExerciseDistribution {
  return {
    ...p,
    isCircuit: true,
    circuitId: circuit.id,
    circuitLibraryId: libraryId,
    exerciseName: circuit.name,
    circuitExercises: circuit.exercises.map(e => ({ ...e })),
    circuitRounds: circuit.rounds,
    circuitRestBetweenRounds: circuit.restBetweenRounds,
    circuitRestBetweenExercises: circuit.restBetweenExercises,
    circuitComments: circuit.comments,
    circuitLibraryBaseline: libraryCircuitVersion(circuit),
  };
}

/** Edited in the program and the library has a newer version since */
export function isCircuitLibraryUpdateAvailable(p: ExerciseDistribution, libraries: CustomLibrary[]): boolean {
  if (!p.isCircuit) return false;
  const found = findLibraryCircuit(libraries, p.circuitId ?? p.exerciseId, p.circuitLibraryId);
  if (!found) return false;
  if (placementSignature(p, found.circuit.rounds) === librarySignature(found.circuit)) return false;
  return p.circuitLibraryBaseline !== libraryCircuitVersion(found.circuit);
}

/**
 * Bring placed circuits in line with the library. Returns the same array when nothing changed.
 * Also restores circuit data on placements of a circuit that were stored as a plain exercise
 * (placed from Exercise Selection or the inline picker) — they showed as empty exercises.
 */
export function syncCircuitPlacements(placements: ExerciseDistribution[], libraries: CustomLibrary[]): ExerciseDistribution[] {
  if (!libraries.some(l => (l.circuits?.length ?? 0) > 0)) return placements;
  let changed = false;
  const next = placements.map(p => {
    if (!p.isCircuit) {
      // A circuit stored without its data: the exerciseId is the circuit's id
      const found = findLibraryCircuit(libraries, p.circuitId ?? p.exerciseId, p.circuitLibraryId);
      if (!found) return p;
      changed = true;
      return applyLibraryCircuit(p, found.circuit, found.libraryId);
    }
    const found = findLibraryCircuit(libraries, p.circuitId ?? p.exerciseId, p.circuitLibraryId);
    if (!found) return p;
    const version = libraryCircuitVersion(found.circuit);
    const placementSig = placementSignature(p, found.circuit.rounds);
    if (placementSig === librarySignature(found.circuit)) {
      if (p.circuitLibraryBaseline === version) return p;
      changed = true;
      return { ...p, circuitLibraryBaseline: version, circuitRounds: p.circuitRounds ?? found.circuit.rounds };
    }
    // Unedited since taken from the library → follow the library
    if (p.circuitLibraryBaseline && hash(placementSig) === p.circuitLibraryBaseline) {
      changed = true;
      return applyLibraryCircuit(p, found.circuit, found.libraryId);
    }
    return p; // edited in the program (or older data) — never overwritten
  });
  return changed ? next : placements;
}
