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

export interface AthleteNote {
  id: string;
  text: string;
  /** ISO date string */
  timestamp: string;
}

export interface Athlete {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthday: string | null;
  sex: Sex | null;
  sport: string | null;
  team: string | null;
  occupation: string | null;
  dailyActivityLevel: DailyActivityLevel | null;
  groupIds: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  /** @deprecated use notesHistory instead — kept for migration */
  notes?: string;
  notesHistory?: AthleteNote[];
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

// ============ ATHLETE CALENDAR ASSIGNMENT ============
// For assigning training programs to athlete calendars

export interface AssignedMicrocycle {
  id: string;
  name: string;
  duration: number; // days
  intensity: string;
}

export interface AssignedMesocycle {
  id: string;
  name: string;
  startDate: string; // ISO date string (shifted)
  endDate: string;   // ISO date string (shifted)
  weeks: number;
  duration: number;  // days
  intensity: string;
  microcycles: AssignedMicrocycle[];
  sessionsPerWeek: number;
  sessionLength: number;
  trainingQualities?: string[];
  allocatedSubGoals?: string[];
}

export interface AthleteCalendarAssignment {
  id: string;
  athleteId: string;
  programId: string;           // Reference to source TrainingProgram
  programName: string;         // Snapshot of program name at assignment time
  
  // Assignment dates (shifted to athlete's calendar)
  startDate: string;           // ISO date string
  endDate: string;             // ISO date string
  
  // Original program dates (for reference/warning)
  originalStartDate: string;
  originalEndDate: string;
  
  // Selection filters (what portions were assigned)
  selectedMesocycleIds: string[];      // Empty = all mesocycles
  selectedMicrocycleIds: string[];     // Empty = all microcycles in selected mesocycles
  
  // Copied data (snapshot at assignment time)
  assignedMesocycles: AssignedMesocycle[];  // Full mesocycle data with shifted dates
  
  // Metadata
  createdAt: string;
  notes?: string;

  // Reviewed tests & events (from Step 4)
  reviewedSubGoals?: ReviewedSubGoal[];
  reviewedEvents?: ReviewedEvent[];

  // Outcome annotation (filled in after the plan concludes)
  outcomeRating?: number | null;                          // 1–5 overall rating
  outcomeGoalAchievement?: 'not_achieved' | 'partial' | 'achieved' | 'exceeded' | null;
  outcomeLoadTolerance?: 'too_easy' | 'about_right' | 'too_hard' | null;
  outcomeNotes?: string | null;
}

export interface ReviewedSubGoal {
  id: string;
  testMethod: string;
  baselineValue: number;
  goalValue: number;
  unit: string;
  comments?: string;
  scheduledDates: string[];
  parameterLinkedId?: string;
}

export interface ReviewedEvent {
  id: string;
  name: string;
  comments?: string;
  scheduledDates: string[];
}
