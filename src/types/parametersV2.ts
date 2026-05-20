export type ParameterCategory = 'strength' | 'speed' | 'power' | 'endurance' | 'mobility' | 'technique' | 'body_composition' | 'other';

export type InteractionDirection = 'contributes_to' | 'improved_by';
export type InteractionStrength = 'strong' | 'moderate' | 'weak';

export interface ParameterV2 {
  id: string;
  name: string;                    // "1RM Front Squat", "100m Sprint Time"
  unit?: string;                   // "kg", "s", "cm", etc.
  category?: string;               // Category for organization (can be custom)
  applicableSports?: string[];     // Sports this parameter is relevant for (free-text tags)
  createdAt: string;
}

export interface ParameterInteraction {
  id: string;
  sourceParameterId: string;       // The parameter that contributes/influences
  targetParameterId: string;       // The parameter being improved
  direction: InteractionDirection; // 'contributes_to' or 'improved_by'
  strength?: InteractionStrength;  // Optional intensity: 'strong', 'moderate', 'weak'
  // Legacy fields for migration (optional, will be removed after migration)
  parameterId?: string;
  interactingParameterId?: string;
}

export interface ParameterMethodV2 {
  id: string;
  parameterId: string;
  methodId: string;                // "Sprinting - Acceleration" format from Toolbox
  rationale?: string;              // The "why" - optional explanation
}

export interface ParametersDatabaseV2 {
  parameters: ParameterV2[];
  interactions: ParameterInteraction[];
  parameterMethods: ParameterMethodV2[];
  lastUpdated: string;
}

export const PARAMETER_CATEGORIES: { value: ParameterCategory; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'speed', label: 'Speed' },
  { value: 'power', label: 'Power' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'technique', label: 'Technique' },
  { value: 'body_composition', label: 'Body Composition' },
  { value: 'other', label: 'Other' },
];

export const INTERACTION_STRENGTHS: { value: InteractionStrength; label: string; icon: string }[] = [
  { value: 'strong', label: 'Strong', icon: '↑↑' },
  { value: 'moderate', label: 'Moderate', icon: '↑' },
  { value: 'weak', label: 'Weak', icon: '→' },
];
