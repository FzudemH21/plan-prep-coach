import { CellData, ExerciseDistribution } from '@/types/microcycle-planning';

/** Category names that are leftovers of old storage formats ("1", "meso2", …), not real categories */
const isValidCategoryName = (name: string | undefined): name is string => {
  if (!name) return false;
  if (name.length <= 2) return false;
  if (/^(meso|micro|main|undefined|null)\d*$/i.test(name)) return false;
  return true;
};

/** Base method + category of a placement or cell — older data may store "Method::Category" in methodId */
const methodKeyOf = (methodId: string, categoryName?: string): { base: string; category: string } => {
  const [base, catFromId] = (methodId ?? '').split('::');
  const category = isValidCategoryName(categoryName) ? categoryName : isValidCategoryName(catFromId) ? catFromId : '';
  return { base, category };
};

export interface MesocycleMethodContext {
  /** Exercise Selection (Mesocycle step 5) cells */
  cells: Record<string, CellData> | CellData[];
  /** The mesocycle and microcycle the exercises are copied into */
  mesocycleId: string;
  microcycleId?: string;
  /** Method (base name) → mesocycle ids it's assigned to. Empty = no assignment data, every method counts as assigned */
  methodAllocations: Record<string, string[]>;
}

export interface MethodRemapResult {
  exercises: ExerciseDistribution[];
  /** Placements moved to another method because their own isn't used for them in the target mesocycle */
  remapped: number;
  /** Names of placements left out because no method of the target mesocycle covers them */
  dropped: string[];
}

/**
 * Fit copied exercise placements to the method setup of the mesocycle they are copied into.
 * - The placement's method is selected for this exercise in the target mesocycle → kept as is.
 * - Another assigned method of the target mesocycle has the exercise in Exercise Selection →
 *   switched to that method (same base method with another category preferred), so it uses that
 *   method's periodization values.
 * - Otherwise kept only if its method is assigned to the target mesocycle at all; dropped if not.
 */
export function fitExercisesToMesocycleMethods(
  exercises: ExerciseDistribution[],
  ctx: MesocycleMethodContext,
): MethodRemapResult {
  const hasAllocations = Object.keys(ctx.methodAllocations).length > 0;
  const isAssigned = (methodId: string) =>
    !hasAllocations || (ctx.methodAllocations[methodId.split('::')[0]] ?? []).includes(ctx.mesocycleId);

  const cells = (Array.isArray(ctx.cells) ? ctx.cells : Object.values(ctx.cells)).filter(cell =>
    cell.mesocycleId === ctx.mesocycleId &&
    (!cell.microcycleId || !ctx.microcycleId || cell.microcycleId === ctx.microcycleId) &&
    isAssigned(cell.methodId)
  );

  let remapped = 0;
  const dropped: string[] = [];
  const result: ExerciseDistribution[] = [];

  exercises.forEach(ex => {
    // Not tied to a method (e.g. a circuit added from the library in Exercise Distribution) — always fits
    if (!ex.methodId) {
      result.push(ex);
      return;
    }
    const own = methodKeyOf(ex.methodId, ex.categoryName);
    const candidates = cells.filter(cell => cell.exercises.some(sel => sel.exerciseId === ex.exerciseId));
    const sameMethod = candidates.some(cell => {
      const key = methodKeyOf(cell.methodId, cell.categoryName);
      return key.base === own.base && key.category === own.category;
    });
    if (sameMethod) {
      result.push(ex);
      return;
    }
    if (candidates.length > 0) {
      const target = candidates.find(cell => methodKeyOf(cell.methodId).base === own.base) ?? candidates[0];
      const selection = target.exercises.find(sel => sel.exerciseId === ex.exerciseId);
      result.push({
        ...ex,
        methodId: target.methodId,
        categoryName: methodKeyOf(target.methodId, target.categoryName).category,
        subCategory: selection?.subCategory ?? ex.subCategory,
      });
      remapped++;
      return;
    }
    if (isAssigned(ex.methodId)) {
      result.push(ex);
      return;
    }
    dropped.push(ex.exerciseName);
  });

  return { exercises: result, remapped, dropped };
}

/** Toast text for a fit result, or null when nothing was changed */
export function describeMethodFit(fit: MethodRemapResult): string | null {
  const parts: string[] = [];
  if (fit.remapped > 0) parts.push(`${fit.remapped} exercise(s) switched to the method used in this mesocycle`);
  if (fit.dropped.length > 0) {
    const names = [...new Set(fit.dropped)];
    parts.push(`left out (method not assigned here): ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4} more` : ''}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
