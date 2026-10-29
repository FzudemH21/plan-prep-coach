export type ParameterCategory = 'strength' | 'speed' | 'power' | 'endurance' | 'mobility' | 'technique' | 'body_composition' | 'other';

export type InteractionDirection = 'contributes_to' | 'improved_by';

// ── Measures (2026-10-28) ─────────────────────────────────────────────────────
// A parameter is the test / quality ("30 m Sprint"); its measures are what is recorded for it (time,
// pain, quality …). A parameter without `measures` has one main measure built from its `unit`, and
// every value / goal / monitoring block without a measure id belongs to that main measure — older
// data needs no conversion. See src/utils/parameterMeasures.ts.

/** number: a value with a unit · scale: min–max with end labels (pain NRS, Borg CR10) · levels: own
 *  ordered levels (worst → best) · passFail: criterion met or not */
export type MeasureKind = 'number' | 'scale' | 'levels' | 'passFail';

/** The id of a parameter's main measure — values without a measure id belong to it */
export const MAIN_MEASURE_ID = 'main';

export interface ParameterMeasure {
  id: string;
  /** "Time", "Pain", "Quality" */
  name: string;
  kind: MeasureKind;
  /** number: the unit — for the main measure always the parameter's own `unit` */
  unit?: string;
  /** number / scale: which direction is progress (time: lower, distance: higher) */
  betterWhen?: 'higher' | 'lower';
  /** scale */
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  /** levels: in order from worst to best */
  levels?: string[];
}

/** A saved set of levels, reusable for other parameters (e.g. "Movement quality, 3 levels") */
export interface LevelPreset {
  id: string;
  name: string;
  levels: string[];
}
export type InteractionStrength = 'strong' | 'moderate' | 'weak';

export interface ParameterV2 {
  id: string;
  name: string;                    // "1RM Front Squat", "100m Sprint Time"
  unit?: string;                   // "kg", "s", "cm", etc.
  category?: string;               // Category for organization (can be custom)
  applicableSports?: string[];     // Sports this parameter is relevant for (free-text tags)
  /** How to perform the test — shown to athletes ("Test details") when this parameter is tested */
  testInstructions?: string;
  /** Demo video (YouTube or any link) for the test — shown with the instructions */
  testVideoUrl?: string;
  /** Body measurement (waist circumference, body fat …) rather than a performance metric — listed under
   *  Body Metrics in the athlete profile and in the goal / test pickers */
  isBiometric?: boolean;
  /** What is recorded for this parameter — the first one is the main measure (id MAIN_MEASURE_ID).
   *  Unset = one number measure in `unit` */
  measures?: ParameterMeasure[];
  /** Recorded per side (left / right) — number measures then also get the limb symmetry index (LSI) */
  perSide?: boolean;
  /** Parameters merged into this one (2026-10-29) — goals a plan still links to them are moved here;
   *  `asLsi`: a separate LSI parameter, its goals become this parameter's LSI goals */
  mergedParameters?: Array<{ id: string; name: string; asLsi?: boolean }>;
  createdAt: string;
}

export interface ParameterInteraction {
  id: string;
  sourceParameterId: string;       // The parameter that contributes/influences
  targetParameterId: string;       // The parameter being improved
  direction: InteractionDirection; // 'contributes_to' or 'improved_by'
  strength?: InteractionStrength;  // Optional intensity: 'strong', 'moderate', 'weak'
  /** Which measures of the TARGET parameter this applies to (e.g. only its pain) — unset = all */
  measureIds?: string[];
  // Legacy fields for migration (optional, will be removed after migration)
  parameterId?: string;
  interactingParameterId?: string;
}

export interface ParameterMethodV2 {
  id: string;
  parameterId: string;
  methodId: string;                // "Sprinting - Acceleration" format from Toolbox
  rationale?: string;              // The "why" - optional explanation
  evidence?: string;               // Research citations / supporting evidence
  evidenceQuality?: string;        // GRADE-inspired: "strong" | "moderate" | "preliminary" | "expert_opinion"
  /** Which of the parameter's measures the method targets (e.g. only pain, or time + pain) — unset = all */
  measureIds?: string[];
}

export interface ParametersDatabaseV2 {
  parameters: ParameterV2[];
  /** Body metrics already added from the old athlete-database list (ids). A body metric deleted
   *  on purpose stays deleted; one dropped by a save from an outdated copy is restored (the list is
   *  saved together with the parameters, so it is dropped along with them). */
  importedBiometricIds?: string[];
  interactions: ParameterInteraction[];
  parameterMethods: ParameterMethodV2[];
  /** Saved level sets for "levels" measures */
  levelPresets?: LevelPreset[];
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
  { value: 'strong', label: 'Strong', icon: '↑↑↑' },
  { value: 'moderate', label: 'Moderate', icon: '↑↑' },
  { value: 'weak', label: 'Weak', icon: '↑' },
];
