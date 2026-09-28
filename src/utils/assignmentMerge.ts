/**
 * assignmentMerge
 *
 * Assigning a program to an athlete who already has an active assignment merges the program into
 * it. Every program uses the same generic ids ("meso-1", "micro-1-1", …), so without this step the
 * merged program's periodization values overwrite the earlier program's (parameterValues is keyed
 * by mesocycle id) and its days can't be mapped to a mesocycle/week of the assignment (the
 * assignment only recorded the first program's mesocycles).
 *
 * namespaceProgramForMerge() gives the incoming program's mesocycles and microcycles ids of their
 * own ("meso-1~k3x9", "micro-1-1~k3x9"), rewrites its training days, daily intensities and
 * parameter values to them, and builds the AssignedMesocycle records (dates taken from the shifted
 * training days) to append to the assignment.
 */
import type { AssignedMesocycle } from '@/types/athlete';

interface DayWithIds {
  date: string;
  mesocycleId?: string;
  microcycleId?: string;
}

export interface NamespacedProgram<TDay extends DayWithIds, TIntensity> {
  trainingDays: TDay[];
  dailyIntensity: TIntensity[];
  parameterValues: Record<string, unknown>;
  mesocycles: AssignedMesocycle[];
}

export function namespaceProgramForMerge<TDay extends DayWithIds, TIntensity extends Partial<DayWithIds>>(input: {
  trainingDays: TDay[];
  dailyIntensity: TIntensity[];
  parameterValues: Record<string, unknown>;
  /** The program's mesocycles as recorded for this assignment (names, intensities, …) */
  programMesocycles: AssignedMesocycle[];
  /** Unique per merge, e.g. Date.now().toString(36) */
  tag: string;
}): NamespacedProgram<TDay, TIntensity> {
  const { tag } = input;
  const withTag = (id: string) => `${id}~${tag}`;
  const mesoId = (id?: string) => (id ? withTag(id) : id);
  const microId = (id?: string) => (id ? withTag(id) : id);

  const trainingDays = input.trainingDays.map(td => ({
    ...td,
    mesocycleId: mesoId(td.mesocycleId),
    microcycleId: microId(td.microcycleId),
  }));

  const dailyIntensity = input.dailyIntensity.map(di => ({
    ...di,
    ...(di.mesocycleId !== undefined ? { mesocycleId: mesoId(di.mesocycleId) } : {}),
    ...(di.microcycleId !== undefined ? { microcycleId: microId(di.microcycleId) } : {}),
  }));

  const parameterValues = Object.fromEntries(
    Object.entries(input.parameterValues ?? {}).map(([id, value]) => [withTag(id), value])
  );

  // Mesocycle records from the (shifted) training days: first/last date, microcycles in calendar
  // order with their day counts — the athlete calendar derives week boundaries from these.
  const byMeso = new Map<string, { originalId: string; dates: string[]; micro: Array<{ originalId: string; days: number }> }>();
  [...input.trainingDays]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(td => {
      if (!td.mesocycleId) return;
      const entry = byMeso.get(td.mesocycleId) ?? { originalId: td.mesocycleId, dates: [], micro: [] };
      entry.dates.push(td.date);
      if (td.microcycleId) {
        const last = entry.micro[entry.micro.length - 1];
        if (last && last.originalId === td.microcycleId) last.days += 1;
        else entry.micro.push({ originalId: td.microcycleId, days: 1 });
      }
      byMeso.set(td.mesocycleId, entry);
    });

  const mesocycles: AssignedMesocycle[] = [...byMeso.values()].map(({ originalId, dates, micro }) => {
    const original = input.programMesocycles.find(m => m.id === originalId);
    const number = originalId.match(/(\d+)$/)?.[1];
    return {
      sessionsPerWeek: 0,
      sessionLength: 0,
      intensity: '5',
      ...original,
      id: withTag(originalId),
      name: original?.name ?? (number ? `Mesocycle ${number}` : originalId),
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      duration: dates.length,
      weeks: Math.max(1, Math.ceil(dates.length / 7)),
      microcycles: micro.map(mc => {
        const originalMicro = original?.microcycles?.find(m => m.id === mc.originalId);
        const mcNumber = mc.originalId.match(/(\d+)$/)?.[1];
        return {
          intensity: originalMicro?.intensity ?? original?.intensity ?? '5',
          name: originalMicro?.name ?? (mcNumber ? `Microcycle ${mcNumber}` : mc.originalId),
          id: withTag(mc.originalId),
          duration: mc.days,
        };
      }),
    };
  });

  return { trainingDays, dailyIntensity, parameterValues, mesocycles };
}
