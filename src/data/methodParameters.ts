// Training method parameters mapping
export interface MethodParameter {
  name: string;
  unit?: string;
  type: 'number' | 'text' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: string | number;
}

export const methodParameters: Record<string, MethodParameter[]> = {
  "10–30 m build-ups with posture checkpoints": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "reps", type: "number", min: 1, max: 20, defaultValue: 4 },
    { name: "distance_m", unit: "m", type: "number", min: 10, max: 30, defaultValue: 20 },
    { name: "rest_between_reps_min", unit: "min", type: "number", min: 1, max: 10, defaultValue: 3 },
    { name: "checkpoints_m", unit: "m", type: "number", min: 5, max: 15, defaultValue: 10 }
  ],
  "505-style RSA": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 1 },
    { name: "reps", type: "number", min: 3, max: 15, defaultValue: 6 },
    { name: "distance_pattern", type: "text", defaultValue: "5-0-5m" },
    { name: "rest_between_reps_s", unit: "s", type: "number", min: 10, max: 120, defaultValue: 45 },
    { name: "technique_cues", type: "text", defaultValue: "Low center of mass" }
  ],
  "A/B-skips & dribbles": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 1, max: 6, defaultValue: 3 },
    { name: "segment_length_m", unit: "m", type: "number", min: 10, max: 50, defaultValue: 20 },
    { name: "transfer_task (accelerations)", type: "text", defaultValue: "10m accelerations" }
  ],
  "Alactic sprints 20–40 m": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "reps", type: "number", min: 2, max: 8, defaultValue: 4 },
    { name: "distance_m", unit: "m", type: "number", min: 20, max: 40, defaultValue: 30 },
    { name: "intensity_metric", type: "select", options: ["Time", "Speed", "Split"], defaultValue: "Time" },
    { name: "intensity_target", unit: "%", type: "number", min: 90, max: 100, defaultValue: 95 },
    { name: "rest_between_reps_min", unit: "min", type: "number", min: 3, max: 8, defaultValue: 5 }
  ],
  "Alternating step drills & wall cycles": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "cycles", type: "number", min: 5, max: 20, defaultValue: 10 },
    { name: "transfer_task (sprints)", type: "text", defaultValue: "20m sprints" }
  ],
  "Ankling/pogos": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "contacts", type: "number", min: 10, max: 50, defaultValue: 20 },
    { name: "progression (to drop jumps)", type: "text", defaultValue: "Week 3-4" },
    { name: "paired_isometric (calf)", type: "text", defaultValue: "3x10s holds" }
  ],
  "Anti-extension/anti-rotation isometrics": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "hold_s", unit: "s", type: "number", min: 10, max: 60, defaultValue: 30 },
    { name: "paired_carries_distance_m", unit: "m", type: "number", min: 10, max: 40, defaultValue: 20 }
  ],
  "Anti-rotation core + carries": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "reps", type: "number", min: 5, max: 20, defaultValue: 10 },
    { name: "carries_distance_m", unit: "m", type: "number", min: 10, max: 40, defaultValue: 20 }
  ],
  "Arm cycles + wicket runs": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "blocks", type: "number", min: 2, max: 6, defaultValue: 3 },
    { name: "runs_per_block", type: "number", min: 2, max: 8, defaultValue: 4 }
  ],
  "Back or front squat (strength)": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 3, max: 6, defaultValue: 4 },
    { name: "reps", type: "number", min: 1, max: 8, defaultValue: 4 },
    { name: "intensity_percent_1RM", unit: "%", type: "number", min: 60, max: 100, defaultValue: 85 },
    { name: "paired_hinge_sets", type: "number", min: 2, max: 4, defaultValue: 3 },
    { name: "paired_hinge_intensity_percent_1RM", unit: "%", type: "number", min: 60, max: 90, defaultValue: 75 }
  ],
  "Block starts": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets_or_reps", type: "number", min: 3, max: 12, defaultValue: 6 },
    { name: "distance_m", unit: "m", type: "number", min: 10, max: 60, defaultValue: 30 },
    { name: "intensity_metric", type: "select", options: ["Time", "Speed", "Reaction"], defaultValue: "Time" },
    { name: "intensity_target", unit: "%", type: "number", min: 90, max: 100, defaultValue: 95 },
    { name: "rest_between_reps_min", unit: "min", type: "number", min: 2, max: 8, defaultValue: 4 },
    { name: "technique_cues", type: "text", defaultValue: "Drive phase focus" },
    { name: "video_feedback", type: "select", options: ["Yes", "No"], defaultValue: "Yes" }
  ],
  "Bounding series": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 1 },
    { name: "sets", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "distance_m", unit: "m", type: "number", min: 30, max: 100, defaultValue: 60 },
    { name: "technical_focus", type: "text", defaultValue: "Horizontal displacement" }
  ],
  "Coaching cueing + video (wicket spacing)": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 1 },
    { name: "runs", type: "number", min: 3, max: 10, defaultValue: 5 },
    { name: "video_feedback", type: "select", options: ["Yes", "No"], defaultValue: "Yes" },
    { name: "spacing_adjustment", type: "text", defaultValue: "Individual based" }
  ],
  "Dribble to 10–20 m & wicket runs": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "segment_length_m", unit: "m", type: "number", min: 10, max: 20, defaultValue: 15 },
    { name: "technical_focus (front-side mechanics)", type: "text", defaultValue: "Knee drive" }
  ],
  "Technique drill block (A/B, dribbles, wicket)": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "segment_length_m", unit: "m", type: "number", min: 10, max: 30, defaultValue: 20 },
    { name: "integration (to sprints)", type: "text", defaultValue: "Progressive build-ups" }
  ],
  "Drop jumps 20–40 cm": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 1 },
    { name: "sets", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "reps", type: "number", min: 3, max: 8, defaultValue: 5 },
    { name: "drop_height_cm", unit: "cm", type: "number", min: 20, max: 40, defaultValue: 30 },
    { name: "contact_time_target_ms", unit: "ms", type: "number", min: 150, max: 250, defaultValue: 200 }
  ],
  "RSIST ankle/knee": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 2, max: 4, defaultValue: 3 },
    { name: "holds_s", unit: "s", type: "number", min: 5, max: 30, defaultValue: 15 },
    { name: "joint_position", type: "select", options: ["Ankle", "Knee", "Both"], defaultValue: "Both" }
  ],
  "Fly sprints 20–30 m": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 1 },
    { name: "reps", type: "number", min: 2, max: 6, defaultValue: 3 },
    { name: "fly_distance_m", unit: "m", type: "number", min: 20, max: 30, defaultValue: 25 },
    { name: "build_up_m", unit: "m", type: "number", min: 30, max: 50, defaultValue: 40 },
    { name: "intensity_metric", type: "select", options: ["Time", "Speed"], defaultValue: "Speed" },
    { name: "intensity_target", unit: "%", type: "number", min: 95, max: 100, defaultValue: 98 },
    { name: "rest_between_reps_min", unit: "min", type: "number", min: 5, max: 10, defaultValue: 7 },
    { name: "contact_time_target_ms", unit: "ms", type: "number", min: 80, max: 120, defaultValue: 100 }
  ]
};

// Add more methods here following the same pattern...
// For brevity, I'll continue with a few more key methods

export const getParametersForMethod = (methodName: string): MethodParameter[] => {
  return methodParameters[methodName] || [];
};

export const getParameterValue = (
  mesocycleId: string, 
  microcycleIndex: number, 
  methodName: string, 
  parameterName: string,
  parameterValues: Record<string, Record<number, Record<string, Record<string, string | number>>>>
): string | number => {
  return parameterValues[mesocycleId]?.[microcycleIndex]?.[methodName]?.[parameterName] || '';
};

export const setParameterValue = (
  mesocycleId: string,
  microcycleIndex: number,
  methodName: string,
  parameterName: string,
  value: string | number,
  parameterValues: Record<string, Record<number, Record<string, Record<string, string | number>>>>
): Record<string, Record<number, Record<string, Record<string, string | number>>>> => {
  const updated = { ...parameterValues };
  
  if (!updated[mesocycleId]) {
    updated[mesocycleId] = {};
  }
  if (!updated[mesocycleId][microcycleIndex]) {
    updated[mesocycleId][microcycleIndex] = {};
  }
  if (!updated[mesocycleId][microcycleIndex][methodName]) {
    updated[mesocycleId][microcycleIndex][methodName] = {};
  }
  
  updated[mesocycleId][microcycleIndex][methodName][parameterName] = value;
  
  return updated;
};