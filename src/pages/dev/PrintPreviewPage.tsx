import { PrintSessionView } from '@/components/print/PrintSessionView';
import { WorkoutSection } from '@/types/workout';

const MOCK_SECTIONS: WorkoutSection[] = [
  {
    id: 'warm-up',
    name: 'Warm-up',
    order: 0,
    comments: 'Focus on hip mobility and ankle dorsiflexion.',
    exercises: [
      {
        id: 'ex-1',
        exerciseId: 'glute-bridge',
        exerciseName: 'Glute Bridge',
        methodId: 'Lower Body Resistance Training - Strength',
        categoryName: 'Lower Body Resistance Strength',
        order: 0,
        parameters: {
          Sets: '2',
          Reps: '15',
          'Rest (s)': '60',
          Reps_set1: '15',
          Reps_set2: '15',
        },
      },
      {
        id: 'ex-2',
        exerciseId: 'ankle-circles',
        exerciseName: 'Ankle Circles',
        methodId: 'Lower Body Resistance Training - Strength',
        categoryName: 'Lower Body Resistance Strength',
        order: 1,
        eachSide: true,
        parameters: {
          Sets: '2',
          Reps: '10',
          Reps_set1: '10',
          Reps_set2: '10',
        },
        notes: '10 reps clockwise + 10 anti-clockwise.',
      },
    ],
  },
  {
    id: 'main',
    name: 'Main Block',
    order: 1,
    exercises: [
      {
        id: 'ex-3',
        exerciseId: 'back-squat',
        exerciseName: 'Back Squat',
        methodId: 'Lower Body Resistance Training - Strength',
        categoryName: 'Lower Body Resistance Strength',
        order: 0,
        supersetId: 'ss-a',
        parameters: {
          Sets: '4',
          Reps: '5',
          'Load (%1RM)': '80',
          'Tempo': '3010',
          'Rest (s)': '180',
          Reps_set1: '5',
          Reps_set2: '5',
          Reps_set3: '5',
          Reps_set4: '5',
          'Load (%1RM)_set1': '75',
          'Load (%1RM)_set2': '80',
          'Load (%1RM)_set3': '80',
          'Load (%1RM)_set4': '82.5',
        },
        notes: 'Pause 1s at bottom. Keep chest tall.',
      },
      {
        id: 'ex-4',
        exerciseId: 'box-jump',
        exerciseName: 'Box Jump',
        methodId: 'Lower Body Power Training - Plyometric',
        categoryName: 'Lower Body Power',
        order: 1,
        supersetId: 'ss-a',
        parameters: {
          Sets: '4',
          Reps: '3',
          'Box Height (cm)': '50',
          Reps_set1: '3',
          Reps_set2: '3',
          Reps_set3: '3',
          Reps_set4: '3',
        },
      },
      {
        id: 'ex-5',
        exerciseId: 'rdl',
        exerciseName: 'Romanian Deadlift',
        methodId: 'Lower Body Resistance Training - Strength',
        categoryName: 'Lower Body Resistance Strength',
        order: 2,
        parameters: {
          Sets: '3',
          Reps: '8',
          'Load (%1RM)': '70',
          'Rest (s)': '120',
          Reps_set1: '8',
          Reps_set2: '8',
          Reps_set3: '8',
        },
      },
    ],
  },
  {
    id: 'cooldown',
    name: 'Cooldown',
    order: 2,
    exercises: [
      {
        id: 'ex-6',
        exerciseId: 'hip-flexor-stretch',
        exerciseName: 'Hip Flexor Stretch',
        methodId: 'Mobility',
        categoryName: 'Mobility',
        order: 0,
        eachSide: true,
        parameters: {
          Sets: '2',
          Duration: '45',
          Duration_set1: '45',
          Duration_set2: '45',
        },
      },
    ],
  },
];

const MOCK_SUPERSETS: Record<string, string> = {
  'ex-3': 'A1',
  'ex-4': 'A2',
};

export default function PrintPreviewPage() {
  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: '16px', color: '#666', fontSize: '13px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
        <strong style={{ color: '#000' }}>Dev: Print Preview</strong>
        &nbsp;— This page renders <code>PrintSessionView</code> with mock data for design review.
        Press <kbd style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px', border: '1px solid #ccc' }}>Ctrl+P</kbd> to see the print output.
      </div>

      {/* Simulate what the print view looks like on screen by temporarily overriding the CSS */}
      <style>{`
        .print-session-view { display: block !important; }
        .psv-header { display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto auto; column-gap: 16px; align-items: start; border-bottom: 1.5px solid var(--coach-accent, #2563eb); padding-bottom: 9px; margin-bottom: 14px; }
        .psv-title { grid-column: 1; grid-row: 1; font-size: 22px; font-weight: 800; letter-spacing: -0.025em; margin: 0 0 4px; }
        .psv-meta { grid-column: 1; grid-row: 2; display: flex; gap: 14px; font-size: 11px; color: #44403c; flex-wrap: wrap; font-family: ui-monospace, monospace; }
        .psv-session-notes { grid-column: 1; grid-row: 3; margin-top: 5px; font-size: 11px; font-style: italic; color: #78716c; }
        .psv-session-notes-label { font-weight: 700; font-style: normal; color: #44403c; }
        .psv-coach-logo { grid-column: 2; grid-row: 1 / 4; align-self: start; justify-self: end; display: block; max-height: 48px; max-width: 96px; width: auto; height: auto; object-fit: contain; object-position: right top; }
        .psv-section { margin-bottom: 14px; }
        .psv-section-name { font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--coach-accent, #2563eb); border-bottom: 1px solid var(--coach-accent, #2563eb); padding-bottom: 3px; margin: 0 0 7px; }
        .psv-section-notes { font-size: 11px; font-style: italic; color: #78716c; margin-bottom: 6px; }
        .psv-superset-group { margin-bottom: 12px; border-left: 2.5px solid var(--coach-accent, #2563eb); padding-left: 10px; }
        .psv-superset-group-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: var(--coach-accent, #2563eb); margin-bottom: 5px; }
        .psv-superset-group .psv-exercise { border-left: none; padding-left: 0; margin-bottom: 5px; }
        .psv-superset-index { font-size: 11px; font-weight: 700; min-width: 16px; display: inline-block; font-family: ui-monospace, monospace; color: #44403c; }
        .psv-exercise { margin-bottom: 8px; padding: 4px 0 4px 7px; border-left: 1.5px solid #e7e5e4; }
        .psv-exercise-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .psv-exercise-name { font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
        .psv-superset-label { font-size: 9px; font-weight: 700; background: var(--coach-accent, #2563eb); color: #fff; padding: 1px 4px; border-radius: 2px; letter-spacing: 0.08em; text-transform: uppercase; }
        .psv-each-side { font-size: 9px; font-weight: 600; color: #78716c; border: 0.5px solid #d6d3d1; padding: 1px 4px; border-radius: 2px; letter-spacing: 0.06em; text-transform: uppercase; }
        .psv-param-grid { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px; font-family: ui-monospace, monospace; }
        .psv-param-grid th { background: color-mix(in srgb, var(--coach-accent, #2563eb) 10%, #fff); border-bottom: 1px solid var(--coach-accent, #2563eb); border-top: none; border-left: none; border-right: none; padding: 3px 8px; text-align: left; font-weight: 700; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
        .psv-param-grid td { border: none; border-bottom: 0.5px solid #f1efed; padding: 3px 8px; }
        .psv-param-grid tr:last-child td { border-bottom: none; }
        .psv-param-grid tr:nth-child(even) td { background: #fafaf9; }
        .psv-chips { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; margin-bottom: 3px; }
        .psv-chip { font-size: 10px; font-weight: 500; background: #f4f4f3; border: 0.5px solid #e7e5e4; padding: 1.5px 5px; border-radius: 99px; color: #44403c; font-family: ui-monospace, monospace; }
        .psv-exercise-notes { font-size: 11px; font-style: italic; color: #78716c; margin-top: 3px; }
        .psv-circuit { margin-bottom: 10px; padding: 6px 8px; background: #fafaf9; border: 0.5px solid #e7e5e4; border-left: 2.5px solid #78716c; }
        .psv-circuit-header { font-size: 12px; font-weight: 700; margin-bottom: 3px; }
        .psv-circuit-meta { font-size: 10px; color: #78716c; margin-bottom: 5px; font-family: ui-monospace, monospace; }
        .psv-circuit-exercise { font-size: 11px; padding: 2px 0; border-bottom: 0.5px solid #e7e5e4; }
      `}</style>

      <PrintSessionView
        sessionName="Morning Strength Session"
        date="Monday, June 23, 2026"
        dayIntensity="7"
        sessionIntensity="8"
        sessionComments="Primary focus: posterior chain loading. Keep bar speed high on squats."
        sections={MOCK_SECTIONS}
        getSupersetLabel={(id) => MOCK_SUPERSETS[id]}
        accentColor="#2563eb"
      />
    </div>
  );
}
