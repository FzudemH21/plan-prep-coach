// Training method parameters mapping
export interface MethodParameter {
  name: string;
  unit?: string;
  type: 'number' | 'text' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: string | number;
  isSetParameter?: boolean;
}

export const methodParameters: Record<string, MethodParameter[]> = {
  "Block starts 6–10 × 10–20 m @90–100% with full recovery (2–4 min), 2–3×/wk; emphasize set-up, shin angles, first 2 steps; video feedback each rep": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "reps", type: "number", min: 6, max: 10, defaultValue: 8 },
    { name: "distance_m", unit: "m", type: "number", min: 10, max: 20, defaultValue: 15 },
    { name: "intensity_metric", type: "select", options: ["Time", "Speed", "Reaction"], defaultValue: "Time" },
    { name: "intensity_target", unit: "%", type: "number", min: 90, max: 100, defaultValue: 95 },
    { name: "rest_between_reps_min", unit: "min", type: "number", min: 2, max: 4, defaultValue: 3 },
    { name: "technique_cues", type: "text", defaultValue: "Set-up, shin angles, first 2 steps" },
    { name: "video_feedback", type: "select", options: ["Yes", "No"], defaultValue: "Yes" }
  ],
  "Simple→choice reaction starts (light/sound cues): 8–12 reps, 2–3×/wk; 10–20 s between reps; add false-start control drills": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "reps", type: "number", min: 8, max: 12, defaultValue: 10 },
    { name: "cue_type", type: "select", options: ["Light", "Sound", "Both"], defaultValue: "Light" },
    { name: "rest_between_reps_s", unit: "s", type: "number", min: 10, max: 20, defaultValue: 15 },
    { name: "false_start_control", type: "select", options: ["Yes", "No"], defaultValue: "Yes" }
  ],
  "Max-intent isometrics (IMTP or iso-squat): 3–6 × 3–5 s, 2×/wk; pair with unloaded jumps 4–6 × 3–5 @ full intent (2–3 min rest)": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "iso_sets", type: "number", min: 3, max: 6, defaultValue: 4 },
    { name: "iso_hold_s", unit: "s", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "pair_jump_sets", type: "number", min: 4, max: 6, defaultValue: 5 },
    { name: "pair_jump_reps", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "rest_between_exercises_min", unit: "min", type: "number", min: 2, max: 3, defaultValue: 2.5 }
  ],
  "Heavy resisted sprints 10–20 m with 30–50% v-decrement: 4–8 reps, 2×/wk; 2–4 min rest; posture cue 'push long'": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "reps", type: "number", min: 4, max: 8, defaultValue: 6 },
    { name: "distance_m", unit: "m", type: "number", min: 10, max: 20, defaultValue: 15 },
    { name: "intensity_metric", type: "select", options: ["V-decrement", "Load"], defaultValue: "V-decrement" },
    { name: "v_decrement_percent", unit: "%", type: "number", min: 30, max: 50, defaultValue: 40 },
    { name: "rest_between_reps_min", unit: "min", type: "number", min: 2, max: 4, defaultValue: 3 },
    { name: "posture_cue", type: "text", defaultValue: "push long" }
  ],
  "Wall drills (A-march/lean): 3–5 × 20–30 contacts, 2–3×/wk; progress to 3-step build-outs 6–10 reps": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "contacts", type: "number", min: 20, max: 30, defaultValue: 25 },
    { name: "progression_build_out_reps", type: "number", min: 6, max: 10, defaultValue: 8 }
  ],
  "Dribble to 10–20 m & wicket runs 3–5 × 20–30 m, 2×/wk; maintain front-side mechanics": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "segment_length_m", unit: "m", type: "number", min: 20, max: 30, defaultValue: 25 },
    { name: "technical_focus", type: "text", defaultValue: "front-side mechanics" }
  ],
  "Heavy resistance training >85% 1RM (squat/hinge): 3–6 × ≤5 reps, 2×/wk; 2–4 min rest; rotate front/back/hinge": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 3, max: 6, defaultValue: 4 },
    { name: "reps", type: "number", min: 1, max: 5, defaultValue: 3 },
    { name: "intensity_percent_1RM", unit: "%", type: "number", min: 85, max: 100, defaultValue: 90 },
    { name: "rest_between_sets_min", unit: "min", type: "number", min: 2, max: 4, defaultValue: 3 },
    { name: "exercise_rotation", type: "text", defaultValue: "front/back/hinge" }
  ],
  "Anti-extension/anti-rotation isometrics 3–5 × 20–40 s, 2–3×/wk; add heavy carries 4–6 × 20–40 m": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "hold_s", unit: "s", type: "number", min: 20, max: 40, defaultValue: 30 },
    { name: "paired_carries_sets", type: "number", min: 4, max: 6, defaultValue: 5 },
    { name: "paired_carries_distance_m", unit: "m", type: "number", min: 20, max: 40, defaultValue: 30 }
  ],
  "Seated/standing arm-swing drills 4–6 × 10–15 cycles, 2×/wk; integrate into 10–20 m starts": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 4, max: 6, defaultValue: 5 },
    { name: "cycles", type: "number", min: 10, max: 15, defaultValue: 12 },
    { name: "integration_task", type: "text", defaultValue: "10–20 m starts" }
  ],
  "Pre-performance routine practice 1–2×/wk (breath cues, visualization 5–8 min) before starts; 6–10 blocked then 6–10 random starts": [
    { name: "frequency_per_week", type: "number", min: 1, max: 2, defaultValue: 1 },
    { name: "visualization_min", unit: "min", type: "number", min: 5, max: 8, defaultValue: 6 },
    { name: "breathing_cues", type: "select", options: ["Yes", "No"], defaultValue: "Yes" },
    { name: "blocked_trials", type: "number", min: 6, max: 10, defaultValue: 8 },
    { name: "random_trials", type: "number", min: 6, max: 10, defaultValue: 8 }
  ],
  "Resisted sprints 10–20 m with 10–30% v-decrement: 3–6 reps, 2×/wk; pair with heavy trap-bar deadlift 3–5 × 2–5 @85–95% 1RM": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sprint_reps", type: "number", min: 3, max: 6, defaultValue: 4 },
    { name: "sprint_distance_m", unit: "m", type: "number", min: 10, max: 20, defaultValue: 15 },
    { name: "v_decrement_percent", unit: "%", type: "number", min: 10, max: 30, defaultValue: 20 },
    { name: "TBDL_sets", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "TBDL_reps", type: "number", min: 2, max: 5, defaultValue: 3 },
    { name: "TBDL_intensity_percent_1RM", unit: "%", type: "number", min: 85, max: 95, defaultValue: 90 }
  ],
  "Sled pulls/pushes with torso lean: 4–8 × 10–20 m, 2×/wk; aim constant shin angle; 2–3 min rest": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "sets", type: "number", min: 4, max: 8, defaultValue: 6 },
    { name: "distance_m", unit: "m", type: "number", min: 10, max: 20, defaultValue: 15 },
    { name: "rest_between_reps_min", unit: "min", type: "number", min: 2, max: 3, defaultValue: 2.5 },
    { name: "shin_angle_target", type: "text", defaultValue: "constant" }
  ],
  "Wicket runs 4–6 × 20–30 m, 2×/wk; adjust spacing to target contact time and projection": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "runs", type: "number", min: 4, max: 6, defaultValue: 5 },
    { name: "segment_length_m", unit: "m", type: "number", min: 20, max: 30, defaultValue: 25 },
    { name: "spacing_adjustment", type: "text", defaultValue: "individual" },
    { name: "contact_time_target", unit: "ms", type: "number", min: 120, max: 180, defaultValue: 150 },
    { name: "projection_cue", type: "text", defaultValue: "horizontal" }
  ],
  "Isometric mid-thigh pull 3–5 × 3–5 s + jump squats 20–40% 1RM 4–6 × 3–5, 2×/wk": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "IMTP_sets", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "IMTP_hold_s", unit: "s", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "JumpSquat_sets", type: "number", min: 4, max: 6, defaultValue: 5 },
    { name: "JumpSquat_reps", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "JumpSquat_load_percent_1RM", unit: "%", type: "number", min: 20, max: 40, defaultValue: 30 }
  ],
  "Fly sprints 20–30 m @98–100% vmax: 4–8 reps, 2×/wk; 3–5 min rest; aim tc < 120–140 ms": [
    { name: "frequency_per_week", type: "number", min: 1, max: 7, defaultValue: 2 },
    { name: "reps", type: "number", min: 4, max: 8, defaultValue: 6 },
    { name: "fly_distance_m", unit: "m", type: "number", min: 20, max: 30, defaultValue: 25 },
    { name: "intensity_metric", type: "select", options: ["Vmax %", "Time"], defaultValue: "Vmax %" },
    { name: "intensity_target", unit: "%", type: "number", min: 98, max: 100, defaultValue: 99 },
    { name: "rest_between_reps_min", unit: "min", type: "number", min: 3, max: 5, defaultValue: 4 },
    { name: "contact_time_target_ms", unit: "ms", type: "number", min: 120, max: 140, defaultValue: 130 }
  ]
}

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