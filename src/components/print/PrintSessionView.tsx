import '@/styles/print-session.css';
import { WorkoutSection, WorkoutExercise } from '@/types/workout';
import { ToolboxDatabase, ToolboxEntry } from '@/types/toolbox';
import { ParameterVisibilityOverrides, isParameterVisible } from '@/components/microcycle-planning/ParameterVisibilityPopover';
import { getBorgLabelFull, migrateLegacyIntensity } from '@/utils/intensityScale';
import { getParametersForMethod } from '@/data/methodParameters';
import { evaluateFormula, parseNumeric } from '@/utils/formulaEvaluator';

export interface PrintSessionViewProps {
  sessionName: string;
  date: string;
  dayIntensity?: string;
  sessionIntensity?: string;
  sessionComments?: string;
  sections: WorkoutSection[];
  toolboxData?: ToolboxDatabase;
  getSupersetLabel: (exerciseId: string) => string | undefined;
  visibilityOverrides?: ParameterVisibilityOverrides;
  /** Mirror of WorkoutSessionSheet's resolveAthleteDataRefs — needed for e1RM / biometric formulas */
  resolveAthleteDataRefs?: (refs: string[], exerciseName: string) => Record<string, number | undefined>;
  /** Coach logo URL — rendered top-right of the print header */
  coachLogo?: string;
  /** Coach brand accent color (hex) — applied via --coach-accent CSS variable */
  accentColor?: string;
}

interface ParamMeta {
  name: string;
  unit?: string;
  isSetParameter: boolean;
  isRestParameter: boolean;
  isFrequencyParameter: boolean;
  showInGridByDefault: boolean;
  isCalculated: boolean;
}

// Percentage units — stored as 80 but need to be 0.80 in formula context
const PCT_UNITS = new Set(['%', '%1RM', '%BW', '%maxV', '%maxHR']);

function getToolboxParams(methodId: string, toolboxData?: ToolboxDatabase): ToolboxEntry[] {
  if (!toolboxData?.entries) return [];
  return toolboxData.entries.filter(entry => {
    const id = entry.subCategory ? `${entry.category} - ${entry.subCategory}` : entry.category;
    return id === methodId;
  });
}

function buildParamMeta(
  exercise: WorkoutExercise,
  toolboxData?: ToolboxDatabase,
): { setCount: number; displayableParams: ParamMeta[]; toolboxParams: ToolboxEntry[] } {
  const toolboxParams = getToolboxParams(exercise.methodId, toolboxData);
  const keys = Object.keys(exercise.parameters || {});
  const baseKeys = keys.filter(k => !k.endsWith('_unit') && !/_set\d+$/i.test(k));

  let params: ParamMeta[];

  if (baseKeys.length > 0) {
    params = baseKeys.map(name => {
      const toolboxEntry = toolboxParams.find(tp => tp.parameterName === name);
      return {
        name,
        unit:
          typeof exercise.parameters[`${name}_unit`] === 'string'
            ? String(exercise.parameters[`${name}_unit`])
            : undefined,
        isSetParameter:
          toolboxEntry?.isSetParameter || /^sets?$/i.test(name) || /ground contacts/i.test(name),
        isRestParameter:
          toolboxEntry?.isRestParameter || /rest|pause|recovery/i.test(name),
        isFrequencyParameter: toolboxEntry?.isFrequencyParameter || false,
        showInGridByDefault: toolboxEntry?.showInGridByDefault ?? true,
        isCalculated: toolboxEntry?.isCalculated ?? false, // mirrors WorkoutExerciseCard
      };
    });
  } else {
    const defs = getParametersForMethod(exercise.methodId);
    params = (defs || []).map(d => ({
      name: d.name,
      unit: d.unit,
      isSetParameter: d.isSetParameter ?? false,
      isRestParameter: /rest|pause|recovery/i.test(d.name),
      isFrequencyParameter: false,
      showInGridByDefault: true,
      isCalculated: false,
    }));
  }

  // Append isCalculated toolbox entries not already in the list (mirrors WorkoutExerciseCard)
  for (const tp of toolboxParams) {
    if (tp.isCalculated && !!tp.formula && !params.some(p => p.name === tp.parameterName)) {
      params.push({
        name: tp.parameterName,
        unit:
          tp.parameterType === 'quantitative' && tp.options.length > 0
            ? tp.options[0]
            : undefined,
        isSetParameter: false,
        isRestParameter: false,
        isFrequencyParameter: false,
        showInGridByDefault: tp.showInGridByDefault ?? true,
        isCalculated: true,
      });
    }
  }

  const setParam = params.find(p => p.isSetParameter && !p.isRestParameter);
  const setCount = setParam ? Number(exercise.parameters[setParam.name] || 3) : 0;

  const displayableParams = params.filter(
    p => (!p.isSetParameter || p.isRestParameter) && !p.isFrequencyParameter,
  );

  return { setCount, displayableParams, toolboxParams };
}

function resolveCalcValue(
  entry: ToolboxEntry,
  setIndex: number,
  exercise: WorkoutExercise,
  toolboxParams: ToolboxEntry[],
  resolveAthleteDataRefs?: (refs: string[], exerciseName: string) => Record<string, number | undefined>,
): string {
  if (!entry.formula) return '—';

  const ctx: Record<string, number> = {};

  // Pass 1: resolve by sourceParameterIds (toolbox-mediated, handles renamed params)
  for (const srcId of (entry.sourceParameterIds ?? [])) {
    const srcParam = toolboxParams.find(p => p.id === srcId);
    if (!srcParam) continue;
    const raw =
      exercise.parameters[`${srcParam.parameterName}_set${setIndex + 1}`] ??
      exercise.parameters[srcParam.parameterName];
    const unit =
      (exercise.parameters[`${srcParam.parameterName}_unit`] as string | undefined) ??
      (srcParam.parameterType === 'quantitative' && srcParam.options.length > 0
        ? srcParam.options[0]
        : undefined);
    let n = parseNumeric(raw ?? '');
    if (!isNaN(n) && unit && PCT_UNITS.has(unit)) n = n / 100;
    if (!isNaN(n)) ctx[srcParam.parameterName] = n;
  }

  // Pass 2: resolve remaining by parameter name from toolbox entries (handles stale IDs)
  for (const sibling of toolboxParams.filter(p => !p.isCalculated)) {
    if (ctx[sibling.parameterName] !== undefined) continue;
    const raw =
      exercise.parameters[`${sibling.parameterName}_set${setIndex + 1}`] ??
      exercise.parameters[sibling.parameterName];
    if (raw === undefined || raw === '') continue;
    const unit =
      (exercise.parameters[`${sibling.parameterName}_unit`] as string | undefined) ??
      (sibling.parameterType === 'quantitative' && sibling.options.length > 0
        ? sibling.options[0]
        : undefined);
    let n = parseNumeric(raw);
    if (!isNaN(n) && unit && PCT_UNITS.has(unit)) n = n / 100;
    if (!isNaN(n)) ctx[sibling.parameterName] = n;
  }

  // Pass 3: sweep exercise.parameters directly (handles empty toolboxParams / method-ID mismatch)
  for (const key of Object.keys(exercise.parameters || {})) {
    if (key.endsWith('_unit') || /_set\d+$/i.test(key)) continue;
    if (ctx[key] !== undefined) continue;
    const perSetVal = exercise.parameters[`${key}_set${setIndex + 1}`];
    const raw =
      perSetVal !== undefined && perSetVal !== ''
        ? perSetVal
        : exercise.parameters[key];
    if (raw === undefined || raw === '') continue;
    const unit = exercise.parameters[`${key}_unit`] as string | undefined;
    let n = parseNumeric(raw);
    if (!isNaN(n) && unit && PCT_UNITS.has(unit)) n = n / 100;
    if (!isNaN(n)) ctx[key] = n;
  }

  // Pass 4: athlete data refs (e1RM, biometrics, performance params)
  if (resolveAthleteDataRefs && entry.athleteDataRefs?.length) {
    const athleteData = resolveAthleteDataRefs(entry.athleteDataRefs, exercise.exerciseName);
    for (const [k, v] of Object.entries(athleteData)) {
      if (v !== undefined) ctx[k] = v;
    }
  }

  const result = evaluateFormula(entry.formula, ctx);
  if (result === null) return '—';
  return String(Math.round(result * 2) / 2);
}

function CircuitBlock({ exercise }: { exercise: WorkoutExercise }) {
  const meta: string[] = [];
  if (exercise.circuitRounds) meta.push(`${exercise.circuitRounds} rounds`);
  if (exercise.circuitRestBetweenRounds) meta.push(`${exercise.circuitRestBetweenRounds}s rest between rounds`);
  if (exercise.circuitRestBetweenExercises) meta.push(`${exercise.circuitRestBetweenExercises}s rest between exercises`);

  return (
    <div className="psv-circuit">
      <div className="psv-circuit-header">
        Circuit: {exercise.exerciseName || 'Circuit'}
      </div>
      {meta.length > 0 && (
        <div className="psv-circuit-meta">{meta.join(' · ')}</div>
      )}
      {exercise.circuitExercises?.map((sub, i) => {
        const parts: string[] = [];
        const enabled = sub.enabledParams ?? ['reps'];
        if (enabled.includes('reps') && sub.reps) parts.push(`${sub.reps} reps`);
        if (enabled.includes('time') && sub.time) parts.push(`${sub.time}s`);
        if (enabled.includes('distance') && sub.distance) parts.push(`${sub.distance}m`);
        return (
          <div key={i} className="psv-circuit-exercise">
            {i + 1}. {sub.exerciseName}{parts.length > 0 ? ` — ${parts.join(' · ')}` : ''}
          </div>
        );
      })}
      {exercise.circuitComments && (
        <p className="psv-exercise-notes">{exercise.circuitComments}</p>
      )}
    </div>
  );
}

// ── Superset grouping helpers ──────────────────────────────────────────────

/** "A1" → "A", "B2" → "B", anything else → undefined */
function getGroupLetter(label: string): string | undefined {
  const m = label.match(/^([A-Z]+)\d+$/);
  return m ? m[1] : undefined;
}

type ExerciseGroup =
  | { type: 'solo'; exercise: WorkoutExercise }
  | { type: 'superset'; groupLetter: string; exercises: { ex: WorkoutExercise; index: number }[] };

function groupExercises(
  exercises: WorkoutExercise[],
  getSupersetLabel: (id: string) => string | undefined,
): ExerciseGroup[] {
  const labels = exercises.map(ex => {
    const label = getSupersetLabel(ex.id);
    const m = label?.match(/^([A-Z]+)(\d+)$/);
    return m ? { groupLetter: m[1], index: parseInt(m[2]) } : null;
  });

  const groups: ExerciseGroup[] = [];
  let i = 0;
  while (i < exercises.length) {
    const meta = labels[i];
    if (!meta) {
      groups.push({ type: 'solo', exercise: exercises[i] });
      i++;
    } else {
      const letter = meta.groupLetter;
      const members: { ex: WorkoutExercise; index: number }[] = [];
      while (i < exercises.length && labels[i]?.groupLetter === letter) {
        members.push({ ex: exercises[i], index: labels[i]!.index });
        i++;
      }
      groups.push({ type: 'superset', groupLetter: letter, exercises: members });
    }
  }
  return groups;
}

// ──────────────────────────────────────────────────────────────────────────

function ExerciseBlock({
  exercise,
  toolboxData,
  getSupersetLabel,
  visibilityOverrides = {},
  resolveAthleteDataRefs,
  supersetIndex,
}: {
  exercise: WorkoutExercise;
  toolboxData?: ToolboxDatabase;
  getSupersetLabel: (id: string) => string | undefined;
  visibilityOverrides?: ParameterVisibilityOverrides;
  resolveAthleteDataRefs?: (refs: string[], exerciseName: string) => Record<string, number | undefined>;
  supersetIndex?: number;
}) {
  if (exercise.isCircuit) return <CircuitBlock exercise={exercise} />;

  const supersetLabel = getSupersetLabel(exercise.id);
  const { setCount, displayableParams, toolboxParams } = buildParamMeta(exercise, toolboxData);

  const gridParams = displayableParams.filter(p =>
    isParameterVisible(p.name, p.showInGridByDefault, visibilityOverrides),
  );
  const chipParams = displayableParams.filter(
    p => !isParameterVisible(p.name, p.showInGridByDefault, visibilityOverrides),
  );

  return (
    <div className="psv-exercise">
      <div className="psv-exercise-header">
        {supersetIndex !== undefined && (
          <span className="psv-superset-index">{supersetIndex}.</span>
        )}
        <span className="psv-exercise-name">{exercise.exerciseName}</span>
        {supersetLabel && <span className="psv-superset-label">{supersetLabel}</span>}
        {exercise.eachSide && <span className="psv-each-side">Each side</span>}
      </div>

      {setCount > 0 && gridParams.length > 0 && (
        <table className="psv-param-grid">
          <thead>
            <tr>
              <th>Set</th>
              {gridParams.map(p => (
                <th key={p.name}>
                  {p.name}{p.unit ? ` (${p.unit})` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: setCount }, (_, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                {gridParams.map(p => {
                  if (p.isCalculated) {
                    const entry = toolboxParams.find(tp => tp.parameterName === p.name);
                    const stored = exercise.parameters[`${p.name}_set${i + 1}`];
                    const val =
                      stored !== undefined && stored !== ''
                        ? String(stored)
                        : entry
                        ? resolveCalcValue(entry, i, exercise, toolboxParams, resolveAthleteDataRefs)
                        : '—';
                    return <td key={p.name} style={{ fontStyle: 'italic' }}>{val}</td>;
                  }
                  const val =
                    exercise.parameters[`${p.name}_set${i + 1}`] ??
                    exercise.parameters[p.name] ??
                    '—';
                  return <td key={p.name}>{String(val)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {chipParams.length > 0 && (
        <div className="psv-chips">
          {chipParams.map(p => {
            const val = exercise.parameters[p.name];
            if (val === undefined || val === '' || val === null) return null;
            return (
              <span key={p.name} className="psv-chip">
                {p.name}: {String(val)}{p.unit ? ` ${p.unit}` : ''}
              </span>
            );
          })}
        </div>
      )}

      {exercise.notes && <p className="psv-exercise-notes">{exercise.notes}</p>}
    </div>
  );
}

export function PrintSessionView({
  sessionName,
  date,
  dayIntensity,
  sessionIntensity,
  sessionComments,
  sections,
  toolboxData,
  getSupersetLabel,
  visibilityOverrides = {},
  resolveAthleteDataRefs,
  coachLogo,
  accentColor,
}: PrintSessionViewProps) {
  return (
    <div
      className="print-session-view"
      style={accentColor ? ({ '--coach-accent': accentColor } as React.CSSProperties) : undefined}
    >
      <div className="psv-header">
        <h1 className="psv-title">{sessionName}</h1>
        <div className="psv-meta">
          {date && <span>{date}</span>}
          {dayIntensity && (
            <span>Day: {getBorgLabelFull(migrateLegacyIntensity(dayIntensity))}</span>
          )}
          {sessionIntensity && (
            <span>Session: {getBorgLabelFull(migrateLegacyIntensity(sessionIntensity))}</span>
          )}
        </div>
        {sessionComments?.trim() && (
          <div className="psv-session-notes">
            <span className="psv-session-notes-label">Session Notes: </span>
            {sessionComments}
          </div>
        )}
        {coachLogo && (
          <img className="psv-coach-logo" src={coachLogo} alt="Coach logo" />
        )}
      </div>

      {sections.map(section => (
        <div key={section.id} className="psv-section">
          <h2 className="psv-section-name">{section.name}</h2>
          {section.comments?.trim() && (
            <p className="psv-section-notes">{section.comments}</p>
          )}
          {groupExercises(section.exercises, getSupersetLabel).map((group, gi) => {
            if (group.type === 'superset') {
              return (
                <div key={`ss-${group.groupLetter}-${gi}`} className="psv-superset-group">
                  <div className="psv-superset-group-label">Superset {group.groupLetter}</div>
                  {group.exercises.map(({ ex, index }) => (
                    <ExerciseBlock
                      key={ex.id}
                      exercise={ex}
                      toolboxData={toolboxData}
                      getSupersetLabel={() => undefined}
                      supersetIndex={index}
                      visibilityOverrides={visibilityOverrides}
                      resolveAthleteDataRefs={resolveAthleteDataRefs}
                    />
                  ))}
                </div>
              );
            }
            return (
              <ExerciseBlock
                key={group.exercise.id}
                exercise={group.exercise}
                toolboxData={toolboxData}
                getSupersetLabel={getSupersetLabel}
                visibilityOverrides={visibilityOverrides}
                resolveAthleteDataRefs={resolveAthleteDataRefs}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
