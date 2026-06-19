import React, { createContext, useContext } from 'react';
import { WorkoutExercise } from '@/types/workout';
import { ToolboxDatabase } from '@/types/toolbox';
import { ParameterVisibilityOverrides } from './ParameterVisibilityPopover';

/**
 * Context that holds stable callbacks and shared data for the workout session,
 * eliminating deep prop drilling from WorkoutSessionSheet -> WorkoutSectionCard -> WorkoutExerciseCard.
 *
 * NOTE: Per-section data (section, isCollapsed) is intentionally kept as direct props
 * because each WorkoutSectionCard instance renders a different section.
 */
export interface WorkoutSessionContextValue {
  // Exercise parameter handlers
  onParameterChange: (exerciseId: string, paramName: string, value: string | number) => void;
  onUnitChange: (exerciseId: string, paramName: string, unit: string) => void;

  // Exercise action handlers
  onToggleSuperset: (exerciseId1: string, exerciseId2: string, sectionId: string) => void;
  onDuplicateExercise: (exerciseId: string) => void;
  onDeleteExercise: (exerciseId: string) => void;

  // Superset helpers
  getSupersetLabel: (exerciseId: string) => string | undefined;

  // Exercise metadata handlers
  onExerciseNotesChange: (exerciseId: string, notes: string) => void;
  onExerciseEachSideChange: (exerciseId: string, eachSide: boolean) => void;

  // Section-level handlers
  onSectionCommentsChange?: (sectionId: string, comments: string) => void;

  // Parameter visibility
  toolboxData?: ToolboxDatabase;
  visibilityOverrides?: ParameterVisibilityOverrides;
  onVisibilityChange: (paramName: string, visible: boolean) => void;
  onShowAllParams: () => void;
  onResetParamsToDefaults: () => void;

  // Auto-calculate toggles
  onAutoCalculateWeightChange: (exerciseId: string, value: boolean) => void;
  onAutoCalculateTargetHRChange: (exerciseId: string, value: boolean) => void;

  // Resolves exactly the IDs listed in a formula's athleteDataRefs to a token-name → value map.
  // 'e1RM'         → most recent e1RM from Exercise Metrics (param-tags based Epley)
  // biometric ID   → athlete's latest value for that BiometricDefinition, keyed by def.name
  // perf param ID  → athlete's latest value for that ParameterV2, keyed by param.name
  resolveAthleteDataRefs: (refs: string[], exerciseName: string) => Record<string, number | undefined>;

  // Exercise detail / change
  onOpenExerciseDetail: (exercise: WorkoutExercise) => void;
  /** Open the exercise detail dialog for a sub-exercise inside a circuit */
  onOpenCircuitExerciseDetail?: (exerciseId: string, libraryId: string, exerciseName: string) => void;
  /** Open the exercise history sheet — only present when an athlete connection is available */
  onOpenHistory?: (exerciseName: string) => void;
  onChangeExercise: (
    exerciseId: string,
    newExercise: {
      exerciseId: string;
      exerciseName: string;
      libraryId: string;
      videoUrl?: string;
      description?: string;
    }
  ) => void;
  onOpenChangeLibrary: (exerciseId: string) => void;
}

const WorkoutSessionContext = createContext<WorkoutSessionContextValue | null>(null);

export function WorkoutSessionProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkoutSessionContextValue;
}) {
  return (
    <WorkoutSessionContext.Provider value={value}>
      {children}
    </WorkoutSessionContext.Provider>
  );
}

export function useWorkoutSession(): WorkoutSessionContextValue {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) {
    throw new Error('useWorkoutSession must be used inside WorkoutSessionProvider');
  }
  return ctx;
}
