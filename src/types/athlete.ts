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

// ============ ATHLETE SETTINGS ============

export interface AthleteSettings {
  units: {
    weight: 'metric' | 'imperial';   // kg vs lb
    distance: 'metric' | 'imperial'; // km vs miles
    length: 'metric' | 'imperial';   // cm vs inch
  };
  timezone: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  features: {
    training: boolean;
    workoutComments: boolean;
    restDayMessage: boolean;
    logActivities: boolean;
    activityComments: boolean;
    bodyMetrics: boolean;
  };
  athleteApp: {
    calendarRange: 'current' | '+1week' | '+2weeks' | '+3weeks' | '+4weeks';
    allowRearrangeWorkouts: boolean;
    allowCreateWorkouts: boolean;
    allowAddExercises: boolean;
  };
}

export const DEFAULT_ATHLETE_SETTINGS: AthleteSettings = {
  units: { weight: 'metric', distance: 'metric', length: 'metric' },
  timezone: 'Europe/Berlin',
  dateFormat: 'DD/MM/YYYY',
  features: {
    training: true,
    workoutComments: true,
    restDayMessage: true,
    logActivities: true,
    activityComments: true,
    bodyMetrics: true,
  },
  athleteApp: {
    calendarRange: '+2weeks',
    allowRearrangeWorkouts: false,
    allowCreateWorkouts: false,
    allowAddExercises: false,
  },
};

export interface Athlete {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthday: string | null;
  sex: Sex | null;
  /** @deprecated single-sport legacy field — use `sports` instead */
  sport: string | null;
  /** Multiple sports; preferred over `sport`. Backward-compat: read as `sports ?? (sport ? [sport] : [])` */
  sports?: string[];
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
  settings?: AthleteSettings;
}

// Helper to get display name
export const getAthleteDisplayName = (athlete: Athlete): string => {
  const parts = [athlete.firstName, athlete.middleName, athlete.lastName].filter(Boolean);
  return parts.join(' ') || 'Unnamed Athlete';
};

// ============ MONITORING CONFIG ============

export type MonitoringBlockType = 'wellbeing' | 'ostrc' | 'custom_metric';
export type CustomMetricInputType = 'number' | 'scale';

export interface ScaleAnchor {
  value: number;
  label: string;
}

export interface CustomMetricBlockConfig {
  /** ParameterV2 id — values are saved as athlete_test_results entries */
  parameterId: string;
  /** Cached display name */
  parameterName: string;
  /** Cached unit (e.g. "bpm", "kg") or null */
  parameterUnit: string | null;
  /** How the athlete inputs the value */
  inputType: CustomMetricInputType;
  /** Optional custom question label shown to athlete */
  label?: string;
  // Scale-specific
  scaleMin?: number;
  scaleMax?: number;
  scaleAnchors?: ScaleAnchor[];
}

export interface MonitoringBlock {
  id: string;
  type: MonitoringBlockType;
  enabled: boolean;
  /** Only present when type === 'custom_metric' */
  config?: CustomMetricBlockConfig;
}

export interface MonitoringConfig {
  blocks: MonitoringBlock[];
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  blocks: [
    { id: 'wellbeing', type: 'wellbeing', enabled: true },
    { id: 'ostrc', type: 'ostrc', enabled: true },
  ],
};

// ============ BIOMETRICS (Health Metrics) ============
// For trackable health metrics like Height, Weight, Resting HR, etc.

export interface BiometricDefinition {
  id: string;
  name: string;
  type: ParameterType;
  unit: string | null; // Only for quantitative
  /** System biometrics (Height, Weight) cannot be deleted */
  isSystem?: boolean;
  createdAt: string;
}

export interface ParameterValue {
  id: string;
  value: string;
  recordedAt: string;
  /** True when this value was entered by the athlete themselves in the athlete app. */
  selfReported?: boolean;
  /** Optional note left by the athlete when entering a self-reported value. */
  note?: string;
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

// Default biometrics (health metrics) — seeded when database is first initialized.
// Height and Weight are system biometrics (isSystem: true) — cannot be deleted by coach.
// Body Fat and Resting Heart Rate are pre-seeded examples but can be removed per athlete.
export const DEFAULT_BIOMETRICS: Omit<BiometricDefinition, 'id' | 'createdAt'>[] = [
  { name: 'Height', type: 'quantitative', unit: 'cm', isSystem: true },
  { name: 'Weight', type: 'quantitative', unit: 'kg', isSystem: true },
  { name: 'Body Fat', type: 'quantitative', unit: '%' },
  { name: 'Resting Heart Rate', type: 'quantitative', unit: 'bpm' },
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
