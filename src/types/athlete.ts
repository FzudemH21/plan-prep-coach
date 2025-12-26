// Athlete Database Types

export type Sex = 'male' | 'female' | 'other';

export type DailyActivityLevel = 
  | 'sedentary' 
  | 'lightly_active' 
  | 'moderately_active' 
  | 'very_active' 
  | 'extremely_active';

export type ParameterType = 'text' | 'quantitative';

export interface AthleteGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface Athlete {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthday: string | null;
  sex: Sex | null;
  sport: string | null;
  occupation: string | null;
  dailyActivityLevel: DailyActivityLevel | null;
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Helper to get display name
export const getAthleteDisplayName = (athlete: Athlete): string => {
  const parts = [athlete.firstName, athlete.middleName, athlete.lastName].filter(Boolean);
  return parts.join(' ') || 'Unnamed Athlete';
};

// ============ BIOMETRICS (Health Metrics) ============
// For trackable health metrics like Height, Weight, Resting HR, etc.

export interface BiometricDefinition {
  id: string;
  name: string;
  type: ParameterType;
  unit: string | null; // Only for quantitative
  createdAt: string;
}

export interface ParameterValue {
  id: string;
  value: string;
  recordedAt: string;
}

export interface AthleteBiometric {
  id: string;
  athleteId: string;
  biometricDefinitionId: string;
  /** @deprecated Use biometricDefinitionId instead */
  parameterDefinitionId?: string; // Legacy alias for backward compatibility
  values: ParameterValue[];
}

// ============ PERFORMANCE PARAMETERS ============
// For training goals linked to Athleticism Database (ParameterV2)

export interface AthletePerformanceParameter {
  id: string;
  athleteId: string;
  athleticismParameterId: string; // Links to ParameterV2 in Athleticism Database
  values: ParameterValue[];
}

// ============ LEGACY ALIASES (for backward compatibility) ============
// These are kept for backward compatibility with existing code

/** @deprecated Use BiometricDefinition instead */
export type ParameterDefinition = BiometricDefinition;

/** @deprecated Use AthleteBiometric instead */
export type AthleteParameter = AthleteBiometric;

// Default biometrics (health metrics)
export const DEFAULT_BIOMETRICS: Omit<BiometricDefinition, 'id' | 'createdAt'>[] = [
  { name: 'Height', type: 'quantitative', unit: 'cm' },
  { name: 'Weight', type: 'quantitative', unit: 'kg' },
];

// Legacy alias
/** @deprecated Use DEFAULT_BIOMETRICS instead */
export const DEFAULT_PARAMETERS = DEFAULT_BIOMETRICS;

export const ACTIVITY_LEVEL_LABELS: Record<DailyActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  lightly_active: 'Lightly Active (1-3 days/week)',
  moderately_active: 'Moderately Active (3-5 days/week)',
  very_active: 'Very Active (6-7 days/week)',
  extremely_active: 'Extremely Active (2x per day)',
};

export const SEX_LABELS: Record<Sex, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};
