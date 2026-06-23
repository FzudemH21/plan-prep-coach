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
  'ex-3': 'SS-A',
  'ex-4': 'SS-A',
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
        .psv-header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .psv-title { font-size: 22px; font-weight: bold; margin: 0 0 4px; }
        .psv-meta { display: flex; gap: 16px; font-size: 12px; color: #333; flex-wrap: wrap; }
        .psv-session-notes { margin-top: 6px; font-size: 12px; font-style: italic; color: #444; }
        .psv-session-notes-label { font-weight: bold; font-style: normal; }
        .psv-section { margin-bottom: 14px; }
        .psv-section-name { font-size: 14px; font-weight: bold; border-bottom: 1px solid #666; padding-bottom: 3px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .psv-section-notes { font-size: 12px; font-style: italic; color: #555; margin-bottom: 8px; }
        .psv-exercise { margin-bottom: 10px; padding: 6px 0 6px 8px; border-left: 2px solid #ccc; }
        .psv-exercise-header { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .psv-exercise-name { font-size: 14px; font-weight: bold; }
        .psv-superset-label { font-size: 11px; font-weight: bold; background: #000; color: #fff; padding: 1px 5px; border-radius: 3px; }
        .psv-each-side { font-size: 11px; color: #555; border: 1px solid #aaa; padding: 1px 5px; border-radius: 3px; }
        .psv-param-grid { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 5px; }
        .psv-param-grid th { background: #f0f0f0; border: 1px solid #bbb; padding: 3px 8px; text-align: left; font-weight: bold; font-size: 11px; }
        .psv-param-grid td { border: 1px solid #ddd; padding: 3px 8px; text-align: left; }
        .psv-param-grid tr:nth-child(even) td { background: #fafafa; }
        .psv-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; margin-bottom: 4px; }
        .psv-chip { font-size: 11px; border: 1px solid #999; padding: 1px 6px; border-radius: 12px; }
        .psv-exercise-notes { font-size: 12px; font-style: italic; color: #555; margin-top: 4px; }
        .psv-circuit { margin-bottom: 10px; padding: 6px 0 6px 8px; border-left: 2px solid #888; }
        .psv-circuit-header { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
        .psv-circuit-meta { font-size: 11px; color: #555; margin-bottom: 4px; }
        .psv-circuit-exercise { font-size: 12px; padding: 2px 0; border-bottom: 1px solid #eee; }
      `}</style>

      <PrintSessionView
        sessionName="Morning Strength Session"
        date="Monday, June 23, 2026"
        dayIntensity="7"
        sessionIntensity="8"
        sessionComments="Primary focus: posterior chain loading. Keep bar speed high on squats."
        sections={MOCK_SECTIONS}
        getSupersetLabel={(id) => MOCK_SUPERSETS[id]}
      />
    </div>
  );
}
