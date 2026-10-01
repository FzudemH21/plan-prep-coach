export interface ToolboxEntry {
  id: string;
  category: string;
  subCategory: string;
  // Primary parameter name (required)
  parameterName: string;
  parameterType: 'qualitative' | 'quantitative';
  options: string[];
  // Exercise selection categories
  exerciseCategories?: string[];
  // Training frequency indicator
  isFrequencyParameter?: boolean;
  // Set parameter indicator (determines number of rows in exercise detail view)
  isSetParameter?: boolean;
  // Rest/pause parameter indicator (used to drive the rest timer in athlete app)
  isRestParameter?: boolean;
  // Whether to show this parameter in the grid by default (also controls athlete app session grid visibility)
  showInGridByDefault?: boolean;
  // Calculated parameter support
  isCalculated?: boolean;           // Flag to mark as calculated
  formula?: string;                 // Formula expression, e.g., "Sets * Ground Contacts"
  sourceParameterIds?: string[];    // IDs of method parameters used in the formula
  athleteDataRefs?: string[];       // IDs of athlete data tokens used in the formula (biometric def IDs, perf param IDs, or 'e1RM')
  // Role in the method's interval timer in the athlete app (e.g. HIIT) — set in the method editor
  intervalRole?: IntervalRole;
}

/** Roles of a method's parameters in the interval timer: work + rest between reps + reps are needed.
 *  workTarget: shown during work for orientation only (e.g. distance, pace, stroke rate) — the timer
 *  always runs on time (the stimulus is the time at an intensity); several parameters can have it. */
export type IntervalRole = 'work' | 'rest' | 'reps' | 'workIntensity' | 'restIntensity' | 'workTarget';

/** The interval timer of a method: which parameter holds what (parameter names) */
export interface IntervalSpec {
  work: string;
  rest: string;
  reps: string;
  workIntensity?: string;
  restIntensity?: string;
  /** Shown during work for orientation (e.g. "400 m"), no effect on the timing */
  workTargets?: string[];
}

/** The interval timer of one method's parameters — undefined when work, rest or reps has no parameter */
export function intervalSpecFor(methodEntries: ToolboxEntry[]): IntervalSpec | undefined {
  const by = (role: IntervalRole) => methodEntries.find(e => e.intervalRole === role)?.parameterName;
  const work = by('work');
  const rest = by('rest');
  const reps = by('reps');
  if (!work || !rest || !reps) return undefined;
  const workTargets = methodEntries.filter(e => e.intervalRole === 'workTarget').map(e => e.parameterName);
  return {
    work, rest, reps,
    workIntensity: by('workIntensity'),
    restIntensity: by('restIntensity'),
    ...(workTargets.length > 0 ? { workTargets } : {}),
  };
}

export interface ToolboxDatabase {
  entries: ToolboxEntry[];
  lastUpdated: string;
  methodDescriptions?: Record<string, string>; // key: "category|||subCategory"
}