/**
 * The data part of moving body metrics into the parameter database (see useBiometricsMigration):
 * - each body-metric definition → a parameter marked "Biometric" with the SAME id
 * - each athlete's body-metric values → performance-parameter values of that parameter (merged
 *   into an existing entry for the same athlete + parameter, without duplicating values)
 */
import type { AthleteBiometric, AthletePerformanceParameter, BiometricDefinition } from '@/types/athlete';
import type { ParameterV2 } from '@/types/parametersV2';

export function biometricDefinitionsAsParameters(definitions: BiometricDefinition[], now: string): ParameterV2[] {
  return definitions.map(def => ({
    id: def.id,
    name: def.name,
    unit: def.unit ?? undefined,
    category: 'Body Metrics',
    isBiometric: true,
    createdAt: def.createdAt ?? now,
  }));
}

export function mergeBiometricValues(
  performance: AthletePerformanceParameter[],
  athleteBiometrics: AthleteBiometric[],
): AthletePerformanceParameter[] {
  const result = [...performance];
  for (const ab of athleteBiometrics) {
    const paramId = ab.biometricDefinitionId || ab.parameterDefinitionId;
    if (!paramId) continue;
    const idx = result.findIndex(pp => pp.athleteId === ab.athleteId && pp.athleticismParameterId === paramId);
    if (idx >= 0) {
      const known = new Set(result[idx].values.map(v => v.id));
      result[idx] = { ...result[idx], values: [...result[idx].values, ...ab.values.filter(v => !known.has(v.id))] };
    } else {
      result.push({ id: ab.id, athleteId: ab.athleteId, athleticismParameterId: paramId, values: ab.values });
    }
  }
  return result;
}
