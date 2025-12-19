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
  fullName: string;
  birthday: string | null;
  sex: Sex | null;
  sport: string | null;
  occupation: string | null;
  dailyActivityLevel: DailyActivityLevel | null;
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ParameterDefinition {
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

export interface AthleteParameter {
  id: string;
  athleteId: string;
  parameterDefinitionId: string;
  values: ParameterValue[];
}

// Default trackable metrics
export const DEFAULT_PARAMETERS: Omit<ParameterDefinition, 'id' | 'createdAt'>[] = [
  { name: 'Height', type: 'quantitative', unit: 'cm' },
  { name: 'Weight', type: 'quantitative', unit: 'kg' },
];

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
