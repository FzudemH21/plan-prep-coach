export type GoalCategory = 'strength' | 'speed' | 'power' | 'endurance' | 'mobility' | 'technique' | 'body_composition' | 'other';

export interface GoalV2 {
  id: string;
  name: string;                    // "1RM Front Squat", "100m Sprint Time"
  unit?: string;                   // "kg", "s", "cm", etc.
  category?: GoalCategory;         // Category for organization
  createdAt: string;
}

export interface GoalInteraction {
  id: string;
  goalId: string;                  // The primary goal
  interactingGoalId: string;       // The goal that interacts with it
}

export interface GoalMethodV2 {
  id: string;
  goalId: string;
  methodId: string;                // "Sprinting - Acceleration" format from Toolbox
  loadingRecommendations: Record<string, string | number>;  // Parameter values
  rationale?: string;              // The "why" - optional explanation
}

export interface GoalsDatabaseV2 {
  goals: GoalV2[];
  interactions: GoalInteraction[];
  goalMethods: GoalMethodV2[];
  lastUpdated: string;
}

export const GOAL_CATEGORIES: { value: GoalCategory; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'speed', label: 'Speed' },
  { value: 'power', label: 'Power' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'technique', label: 'Technique' },
  { value: 'body_composition', label: 'Body Composition' },
  { value: 'other', label: 'Other' },
];
