export type ParameterCategory = 'strength' | 'speed' | 'power' | 'endurance' | 'mobility' | 'technique' | 'body_composition' | 'other';

export interface ParameterV2 {
  id: string;
  name: string;                    // "1RM Front Squat", "100m Sprint Time"
  unit?: string;                   // "kg", "s", "cm", etc.
  category?: string;               // Category for organization (can be custom)
  createdAt: string;
}

export interface ParameterInteraction {
  id: string;
  parameterId: string;             // The primary parameter
  interactingParameterId: string;  // The parameter that interacts with it
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
