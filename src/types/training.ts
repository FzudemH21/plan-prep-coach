export type DisplayMode = "step-by-step" | "macro" | "meso" | "micro";

export type IntensityLevel = "off" | "deload" | "easy" | "easy-moderate" | "moderate" | "moderate-hard" | "hard" | "extremely-hard";

export interface AthleteInfo {
  id: string;
  name: string;
  age: number;
  sex: "male" | "female" | "other";
  sport: string;
  occupation: string;
  dailyActivity: string;
  sleep: string;
  trainingHistory: string;
  movementAnalysisResults: string;
  freeTextInfo: string;
  createdAt: Date;
  updatedAt: Date;
}

// Plan timeline - shared across all goals
export interface PlanDuration {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  totalWeeks: number;
}

// Individual SMART goal - for performance targets
export interface SmartGoal {
  id: string;
  description: string;
  baselineValue: number;
  desiredValue: number;
  unit: string;
  percentChange: number;
  // Optional link to athlete parameter for auto-fill
  linkedParameterId?: string;
  // Optional legacy fields (deprecated)
  specific?: string;
  measurable?: string;
  achievable?: string;
  relevant?: string;
  timeBound?: string;
  startDate?: Date;
  endDate?: Date;
  totalDays?: number;
  totalWeeks?: number;
}

export interface SubGoal {
  id: string;
  parentGoalId?: string; // Links to a SmartGoal.id for hierarchical organization
  description: string;
  testMethod: string;
  preTestValue: number;
  goalValue: number;
  unit: string;
  percentChange: number;
  testDates: string[];
  comments?: string;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  eventDates: string[];
  comments?: string;
}

export interface TrainableQuality {
  id: string;
  name: string;
  description?: string;
  methods: string[];
}

export interface TrainingMethod {
  id: string;
  name: string;
  quality: string;
  parameters: {
    sets?: number;
    reps?: number;
    percentRM?: number;
    frequency?: number;
    duration?: number;
    intensity?: string;
    rest?: number;
    tempo?: string;
    volume?: number;
    [key: string]: any;
  };
  exercises: Exercise[];
  mesocycleAllocations: string[];
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  tier?: string;
  direction?: string;
  stance?: string;
  equipment?: string;
  muscleGroups?: string[];
  description?: string;
}

export interface Mesocycle {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  duration: number; // in weeks
  intensity: IntensityLevel;
  trainingMethods: string[];
  microcycles: Microcycle[];
}

export interface Microcycle {
  id: string;
  mesocycleId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  duration: number; // in days
  intensity: IntensityLevel;
  trainingDays: TrainingDay[];
}

export interface TrainingDay {
  id: string;
  microcycleId: string;
  date: Date;
  dayOfWeek: number;
  isTrainingDay: boolean;
  intensity: IntensityLevel;
  sessions: TrainingSession[];
}

export interface TrainingSession {
  id: string;
  trainingDayId: string;
  name: string;
  order: number;
  trainingMethods: SessionMethod[];
  duration?: number;
  notes?: string;
}

export interface SessionMethod {
  id: string;
  trainingMethodId: string;
  order: number;
  exercises: SessionExercise[];
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  order: number;
  parameters: {
    sets?: number;
    reps?: number;
    weight?: number;
    percentRM?: number;
    duration?: number;
    rest?: number;
    tempo?: string;
    rpe?: number;
    [key: string]: any;
  };
  completed?: boolean;
  notes?: string;
}

export interface TrainingPlan {
  id: string;
  athleteId: string;
  name: string;
  smartGoal: SmartGoal;
  subGoals: SubGoal[];
  trainableQualities: TrainableQuality[];
  trainingMethods: TrainingMethod[];
  mesocycles: Mesocycle[];
  createdAt: Date;
  updatedAt: Date;
  status: "draft" | "active" | "completed" | "paused";
}

export interface ExerciseGlossary {
  id: string;
  name: string;
  type: "resistance" | "preventive" | "corrective" | "accessory" | "plyometric";
  exercises: Exercise[];
}

export interface GoalTemplate {
  id: string;
  goal: string;
  subGoals: string[];
  qualities: string[];
  methods: string[];
}