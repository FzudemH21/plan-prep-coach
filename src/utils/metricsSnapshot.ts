/**
 * The athlete app's Progress tab can't read the coach's athlete data, so the coach side keeps a
 * copy of each connected athlete's body metrics and performance parameters in the connection
 * (profile_data.metricsSnapshot). Built here — the same lists the coach sees (parameters marked
 * "Biometric" under body metrics, the main measure's values) — and kept up to date by
 * AthleteProgressSync. The athlete's own test results are added by the athlete app itself.
 */
import type { MetricsSnapshot, MetricsSnapshotItem } from '@/hooks/useAthleteConnections';
import type { AthleteBiometric, BiometricDefinition } from '@/types/athlete';
import type { ParameterV2 } from '@/types/parametersV2';

interface SnapshotInput {
  biometrics: AthleteBiometric[];
  biometricDefinitions: BiometricDefinition[];
  /** The athlete's tracked parameters (values: the main measure's series) */
  performanceParams: Array<{ athleticismParameterId: string; values: Array<{ value: string; recordedAt: string }> }>;
  parameters: ParameterV2[];
}

export function buildMetricsSnapshot({ biometrics, biometricDefinitions, performanceParams, parameters }: SnapshotInput): MetricsSnapshot {
  const byId = new Map(parameters.map(p => [p.id, p]));
  const paramItem = (pp: SnapshotInput['performanceParams'][number]): MetricsSnapshotItem | null => {
    const param = byId.get(pp.athleticismParameterId);
    if (!param) return null;
    return {
      parameterId: pp.athleticismParameterId,
      name: param.name,
      unit: param.unit ?? null,
      category: param.category ?? undefined,
      values: pp.values.map(v => ({ value: v.value, recordedAt: v.recordedAt })),
    };
  };
  const isBiometric = (id: string) => !!byId.get(id)?.isBiometric;
  return {
    bodyMetrics: [
      ...biometrics
        .map((ab): MetricsSnapshotItem | null => {
          const def = biometricDefinitions.find(d => d.id === ab.biometricDefinitionId);
          return def ? { name: def.name, unit: def.unit ?? null, values: ab.values.map(v => ({ value: v.value, recordedAt: v.recordedAt })) } : null;
        })
        .filter((x): x is MetricsSnapshotItem => x !== null),
      ...performanceParams.filter(pp => isBiometric(pp.athleticismParameterId)).map(paramItem).filter((x): x is MetricsSnapshotItem => x !== null),
    ],
    performanceParams: performanceParams
      .filter(pp => !isBiometric(pp.athleticismParameterId))
      .map(paramItem)
      .filter((x): x is MetricsSnapshotItem => x !== null),
    updatedAt: new Date().toISOString(),
  };
}

/** JSON with sorted keys and without undefined — stored JSON comes back with its keys reordered */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort()
      .filter(k => (value as Record<string, unknown>)[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Same metrics and values (the time it was built doesn't count) */
export function sameMetricsSnapshot(a: MetricsSnapshot | null | undefined, b: MetricsSnapshot | null | undefined): boolean {
  if (!a || !b) return a === b;
  return stable({ body: a.bodyMetrics, perf: a.performanceParams }) === stable({ body: b.bodyMetrics, perf: b.performanceParams });
}
