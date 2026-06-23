import '@/styles/print-session.css';
import { WorkoutSection, WorkoutExercise } from '@/types/workout';
import { ToolboxDatabase, ToolboxEntry } from '@/types/toolbox';
import { ParameterVisibilityOverrides, isParameterVisible } from '@/components/microcycle-planning/ParameterVisibilityPopover';
import { getBorgLabelFull, migrateLegacyIntensity } from '@/utils/intensityScale';
import { getParametersForMethod } from '@/data/methodParameters';

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
}

interface ParamMeta {
  name: string;
  unit?: string;
  isSetParameter: boolean;
  isRestParameter: boolean;
  isFrequencyParameter: boolean;
  showInGridByDefault: boolean;
}

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
): { setCount: number; displayableParams: ParamMeta[] } {
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
    }));
  }

  const setParam = params.find(p => p.isSetParameter && !p.isRestParameter);
  const setCount = setParam ? Number(exercise.parameters[setParam.name] || 3) : 0;

  const displayableParams = params.filter(
    p => (!p.isSetParameter || p.isRestParameter) && !p.isFrequencyParameter,
  );

  return { setCount, displayableParams };
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

function ExerciseBlock({
  exercise,
  toolboxData,
  getSupersetLabel,
  visibilityOverrides = {},
}: {
  exercise: WorkoutExercise;
  toolboxData?: ToolboxDatabase;
  getSupersetLabel: (id: string) => string | undefined;
  visibilityOverrides?: ParameterVisibilityOverrides;
}) {
  if (exercise.isCircuit) return <CircuitBlock exercise={exercise} />;

  const supersetLabel = getSupersetLabel(exercise.id);
  const { setCount, displayableParams } = buildParamMeta(exercise, toolboxData);

  const gridParams = displayableParams.filter(p =>
    isParameterVisible(p.name, p.showInGridByDefault, visibilityOverrides),
  );
  const chipParams = displayableParams.filter(
    p => !isParameterVisible(p.name, p.showInGridByDefault, visibilityOverrides),
  );

  return (
    <div className="psv-exercise">
      <div className="psv-exercise-header">
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
}: PrintSessionViewProps) {
  return (
    <div className="print-session-view">
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
      </div>

      {sections.map(section => (
        <div key={section.id} className="psv-section">
          <h2 className="psv-section-name">{section.name}</h2>
          {section.comments?.trim() && (
            <p className="psv-section-notes">{section.comments}</p>
          )}
          {section.exercises.map(exercise => (
            <ExerciseBlock
              key={exercise.id}
              exercise={exercise}
              toolboxData={toolboxData}
              getSupersetLabel={getSupersetLabel}
              visibilityOverrides={visibilityOverrides}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
