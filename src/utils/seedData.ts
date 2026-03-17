// Seed data utility – injects a complete demo training plan into localStorage.
// All data structures match the current app schema (macrocycleData, mesocycleData,
// trainingDays, dailyIntensityData, sessionSections, exerciseDistribution, supersets,
// parameterValues, methodAllocations, daySplitStates).

const MESO_IDS = ['demo-meso-1', 'demo-meso-2', 'demo-meso-3'] as const;

const MICRO_IDS = [
  ['demo-micro-1-1', 'demo-micro-1-2', 'demo-micro-1-3', 'demo-micro-1-4'],
  ['demo-micro-2-1', 'demo-micro-2-2', 'demo-micro-2-3', 'demo-micro-2-4'],
  ['demo-micro-3-1', 'demo-micro-3-2', 'demo-micro-3-3', 'demo-micro-3-4'],
] as const;

const MICRO_INTENSITIES = [
  ['easy', 'easy-moderate', 'moderate', 'deload'],
  ['moderate', 'moderate-hard', 'hard', 'deload'],
  ['moderate-hard', 'hard', 'extremely-hard', 'moderate'],
] as const;

const METHODS = [
  'Max Strength – Heavy Resistance',
  'Power – Jumps & Plyometrics',
  'Sprint – Acceleration',
  'Sprint – Max Velocity',
] as const;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function secId(date: string, si: number, label: string): string {
  return `demo-sec-${date}-${si}-${label}`;
}

export function loadSeedData(): void {
  // Plan: 12 weeks starting 2026-03-23 (Monday)
  const planStart = new Date('2026-03-23T00:00:00.000Z');
  const planEnd = addDays(planStart, 83);

  const SG1 = 'demo-sg-1';
  const SUB1 = 'demo-sub-1';
  const SUB2 = 'demo-sub-2';

  // ── macrocycleData ──────────────────────────────────────────────────────────
  const macrocycleData = {
    planName: 'Sprint Performance – Demo Plan',
    planNotes:
      '12-Wochen-Sprintentwicklungsprogramm zur Demonstration aller App-Features: ' +
      'Masterplanner, Periodisierungstabelle, Supersätze, Sessions und Sektionen.',
    selectedAthleteId: null,
    planDuration: {
      startDate: planStart.toISOString(),
      endDate: planEnd.toISOString(),
      totalDays: 84,
      totalWeeks: 12,
    },
    smartGoals: [
      {
        id: SG1,
        description: '100m-Zeit von 10.8 s auf 10.5 s verbessern (–0.3 s in 12 Wochen)',
        baselineValue: 10.8,
        desiredValue: 10.5,
        unit: 's',
        percentChange: -2.8,
      },
    ],
    // legacy field kept for backward compatibility
    smartGoal: {
      id: SG1,
      description: '100m-Zeit von 10.8 s auf 10.5 s verbessern',
      baselineValue: 10.8,
      desiredValue: 10.5,
      unit: 's',
      percentChange: -2.8,
      startDate: planStart.toISOString(),
      endDate: planEnd.toISOString(),
      totalDays: 84,
      totalWeeks: 12,
    },
    subGoals: [
      {
        id: SUB1,
        parentGoalId: SG1,
        description: 'Relative Maximalkraft erhöhen',
        testMethod: 'Back Squat 1RM',
        preTestValue: 120,
        goalValue: 140,
        unit: 'kg',
        percentChange: 16.7,
        testDates: [fmtDate(addDays(planStart, 55))], // Mid-test: week 8 Mon
        comments: 'Getestet am Beginn von Woche 9',
      },
      {
        id: SUB2,
        parentGoalId: SG1,
        description: 'Explosivkraft steigern (CMJ)',
        testMethod: 'Countermovement Jump',
        preTestValue: 42,
        goalValue: 48,
        unit: 'cm',
        percentChange: 14.3,
        testDates: [fmtDate(addDays(planStart, 55))],
        comments: '',
      },
    ],
    events: [
      {
        id: 'demo-ev-1',
        name: 'Stadtmeisterschaften',
        description: 'Saisonhöhepunkt – 100m Sprint',
        eventDates: [fmtDate(addDays(planStart, 75))], // Week 11 Sat
        comments: 'Wichtigstes Saisonereignis',
      },
    ],
    qualities: [
      { id: 'q-1', name: 'Maximalkraft', description: 'Maximale Kraftentfaltung', methods: [METHODS[0]] },
      { id: 'q-2', name: 'Schnellkraft', description: 'Explosive Kraftentfaltung', methods: [METHODS[1]] },
      { id: 'q-3', name: 'Beschleunigung', description: 'Sprintbeschleunigung 0–30 m', methods: [METHODS[2]] },
      {
        id: 'q-4',
        name: 'Maximalgeschwindigkeit',
        description: 'Maximale Sprintgeschwindigkeit 30–60 m',
        methods: [METHODS[3]],
      },
    ],
    qualitiesBySubGoal: {
      [SUB1]: { label: 'Relative Maximalkraft erhöhen', list: ['Maximalkraft', 'Schnellkraft'] },
      [SUB2]: {
        label: 'Explosivkraft steigern',
        list: ['Schnellkraft', 'Beschleunigung', 'Maximalgeschwindigkeit'],
      },
    },
    methodsByQuality: {
      'q-1': { subGoalLabel: 'Relative Maximalkraft erhöhen', qualityName: 'Maximalkraft', list: [METHODS[0]] },
      'q-2': { subGoalLabel: 'Relative Maximalkraft erhöhen', qualityName: 'Schnellkraft', list: [METHODS[1]] },
      'q-3': { subGoalLabel: 'Explosivkraft steigern', qualityName: 'Beschleunigung', list: [METHODS[2]] },
      'q-4': {
        subGoalLabel: 'Explosivkraft steigern',
        qualityName: 'Maximalgeschwindigkeit',
        list: [METHODS[3]],
      },
    },
    selectedTest: null,
    selectedEvent: null,
    selectedMethods: [...METHODS],
    manuallyAddedMethods: [],
    lastUpdated: new Date().toISOString(),
  };

  // ── mesocycleData ───────────────────────────────────────────────────────────
  const mesocycles = [
    {
      id: 'demo-meso-1',
      name: 'Mesozyklus 1 – Allgemeine Vorbereitung',
      weeks: 4,
      sessionsPerWeek: 3,
      sessionLength: 75,
      startDate: planStart.toISOString(),
      endDate: addDays(planStart, 27).toISOString(),
      duration: 4,
      intensity: 'moderate',
      trainingMethods: [...METHODS],
      allocatedSubGoals: [SUB1, SUB2],
      trainingQualities: ['Maximalkraft', 'Schnellkraft', 'Beschleunigung'],
      microcycles: [
        { id: 'demo-micro-1-1', name: 'Woche 1', duration: 7, intensity: 'easy' },
        { id: 'demo-micro-1-2', name: 'Woche 2', duration: 7, intensity: 'easy-moderate' },
        { id: 'demo-micro-1-3', name: 'Woche 3', duration: 7, intensity: 'moderate' },
        { id: 'demo-micro-1-4', name: 'Woche 4 (Deload)', duration: 7, intensity: 'deload' },
      ],
    },
    {
      id: 'demo-meso-2',
      name: 'Mesozyklus 2 – Spezifische Vorbereitung',
      weeks: 4,
      sessionsPerWeek: 3,
      sessionLength: 75,
      startDate: addDays(planStart, 28).toISOString(),
      endDate: addDays(planStart, 55).toISOString(),
      duration: 4,
      intensity: 'hard',
      trainingMethods: [...METHODS],
      allocatedSubGoals: [SUB1, SUB2],
      trainingQualities: ['Maximalkraft', 'Schnellkraft', 'Maximalgeschwindigkeit'],
      microcycles: [
        { id: 'demo-micro-2-1', name: 'Woche 5', duration: 7, intensity: 'moderate' },
        { id: 'demo-micro-2-2', name: 'Woche 6', duration: 7, intensity: 'moderate-hard' },
        { id: 'demo-micro-2-3', name: 'Woche 7', duration: 7, intensity: 'hard' },
        { id: 'demo-micro-2-4', name: 'Woche 8 (Deload)', duration: 7, intensity: 'deload' },
      ],
    },
    {
      id: 'demo-meso-3',
      name: 'Mesozyklus 3 – Wettkampfvorbereitung',
      weeks: 4,
      sessionsPerWeek: 3,
      sessionLength: 70,
      startDate: addDays(planStart, 56).toISOString(),
      endDate: addDays(planStart, 83).toISOString(),
      duration: 4,
      intensity: 'extremely-hard',
      trainingMethods: [METHODS[1], METHODS[2], METHODS[3]], // No max strength in peak phase
      allocatedSubGoals: [SUB1, SUB2],
      trainingQualities: ['Schnellkraft', 'Beschleunigung', 'Maximalgeschwindigkeit'],
      microcycles: [
        { id: 'demo-micro-3-1', name: 'Woche 9', duration: 7, intensity: 'moderate-hard' },
        { id: 'demo-micro-3-2', name: 'Woche 10', duration: 7, intensity: 'hard' },
        { id: 'demo-micro-3-3', name: 'Woche 11', duration: 7, intensity: 'extremely-hard' },
        { id: 'demo-micro-3-4', name: 'Woche 12 (Taper)', duration: 7, intensity: 'moderate' },
      ],
    },
  ];

  const microIntensityMap: Record<string, string> = {
    'demo-micro-1-1': 'easy',
    'demo-micro-1-2': 'easy-moderate',
    'demo-micro-1-3': 'moderate',
    'demo-micro-1-4': 'deload',
    'demo-micro-2-1': 'moderate',
    'demo-micro-2-2': 'moderate-hard',
    'demo-micro-2-3': 'hard',
    'demo-micro-2-4': 'deload',
    'demo-micro-3-1': 'moderate-hard',
    'demo-micro-3-2': 'hard',
    'demo-micro-3-3': 'extremely-hard',
    'demo-micro-3-4': 'moderate',
  };

  // ── trainingDays + dailyIntensityData ───────────────────────────────────────
  const trainingDays: unknown[] = [];
  const dailyIntensityData: unknown[] = [];

  // Test day: Monday of week 8 (offset 49)
  const testDayDate = fmtDate(addDays(planStart, 49));
  // Event day: Saturday of week 11 (offset 75)
  const eventDayDate = fmtDate(addDays(planStart, 75));

  for (let week = 0; week < 12; week++) {
    const mesoIdx = Math.floor(week / 4);
    const microIdx = week % 4;
    const mesoId = MESO_IDS[mesoIdx];
    const microId = MICRO_IDS[mesoIdx][microIdx];
    const microIntensity = microIntensityMap[microId];

    for (let d = 0; d < 7; d++) {
      const date = addDays(planStart, week * 7 + d);
      const dateStr = fmtDate(date);
      const dow = date.getDay(); // 0=Sun
      const dayName = DAY_NAMES[dow];

      // Training: Mon(1), Wed(3), Fri(5)
      const isTraining = dow === 1 || dow === 3 || dow === 5;
      const intensity = isTraining ? microIntensity : 'off';
      const isTestDay = dateStr === testDayDate && dow === 1;
      const isEventDay = dateStr === eventDayDate;

      const sessionName = dow === 3 ? 'Sprinttraining' : 'Krafttraining';

      trainingDays.push({
        date: dateStr,
        dayOfWeek: dow,
        dayName,
        mesocycleId: mesoId,
        microcycleId: microId,
        isTestDay,
        isEventDay,
        isTrainingDay: isTraining,
        intensity,
        sessions: isTraining ? 1 : undefined,
        sessionNames: isTraining ? [sessionName] : undefined,
        testNames: isTestDay ? ['Back Squat 1RM', 'Countermovement Jump'] : undefined,
        eventNames: isEventDay ? ['Stadtmeisterschaften'] : undefined,
      });

      dailyIntensityData.push({
        date: dateStr,
        mesocycleId: mesoId,
        microcycleId: microId,
        dayOfWeek: dow,
        intensity,
        isTestDay,
        isEventDay,
      });
    }
  }

  // ── daySplitStates ──────────────────────────────────────────────────────────
  // All training days = 1 session. Week 3 Monday = 2 sessions (demo double day).
  const daySplitStates: Record<string, number> = {};
  const week3MonDate = fmtDate(addDays(planStart, 14)); // 2026-04-06

  for (let week = 0; week < 12; week++) {
    for (const d of [0, 2, 4]) {
      const dateStr = fmtDate(addDays(planStart, week * 7 + d));
      daySplitStates[dateStr] = dateStr === week3MonDate ? 2 : 1;
    }
  }

  // ── sessionSections ─────────────────────────────────────────────────────────
  const sessionSections: unknown[] = [];

  for (let week = 0; week < 12; week++) {
    for (const d of [0, 2, 4]) {
      const dateStr = fmtDate(addDays(planStart, week * 7 + d));
      const dow = addDays(planStart, week * 7 + d).getDay();
      const isSprintDay = dow === 3;

      if (isSprintDay) {
        sessionSections.push(
          { id: secId(dateStr, 0, 'warmup'), dayDate: dateStr, sessionIndex: 0, name: 'Warm-up', order: 0 },
          { id: secId(dateStr, 0, 'sprint'), dayDate: dateStr, sessionIndex: 0, name: 'Sprint Work', order: 1 },
          { id: secId(dateStr, 0, 'cooldown'), dayDate: dateStr, sessionIndex: 0, name: 'Cool-down', order: 2 },
        );
      } else {
        sessionSections.push(
          { id: secId(dateStr, 0, 'warmup'), dayDate: dateStr, sessionIndex: 0, name: 'Warm-up', order: 0 },
          { id: secId(dateStr, 0, 'main'), dayDate: dateStr, sessionIndex: 0, name: 'Hauptarbeit', order: 1 },
          { id: secId(dateStr, 0, 'cooldown'), dayDate: dateStr, sessionIndex: 0, name: 'Cool-down', order: 2 },
        );
      }

      // Double day: add session 1 for week 3 Monday
      if (dateStr === week3MonDate) {
        sessionSections.push(
          { id: secId(dateStr, 1, 'warmup'), dayDate: dateStr, sessionIndex: 1, name: 'Warm-up', order: 0 },
          { id: secId(dateStr, 1, 'sprint'), dayDate: dateStr, sessionIndex: 1, name: 'Sprint Work', order: 1 },
        );
      }
    }
  }

  // ── exerciseDistribution + supersets ────────────────────────────────────────
  // Full exercise detail for Week 1 (Mon/Wed/Fri) to showcase all features.
  // Remaining weeks get no pre-filled exercises (coach fills them in).
  const exerciseDistribution: unknown[] = [];
  const supersets: Record<string, Record<string, Record<string, Record<string, string[]>>>> = {};

  // Helper to push an exercise entry
  const ex = (
    id: string,
    exerciseName: string,
    methodId: string,
    categoryName: string,
    dateStr: string,
    si: number,
    order: number,
    sectionId: string,
    extras: Record<string, unknown> = {},
  ) => {
    exerciseDistribution.push({
      id,
      exerciseId: `demo-exlib-${id}`,
      exerciseName,
      methodId,
      categoryName,
      dayDate: dateStr,
      sessionIndex: si,
      order,
      sectionId,
      parameterSource: 'periodization' as const,
      ...extras,
    });
  };

  // ---- Week 1 Monday (2026-03-23) – Strength + Power Complex ----
  const mon1 = fmtDate(planStart);
  const secMon1Wu = secId(mon1, 0, 'warmup');
  const secMon1Main = secId(mon1, 0, 'main');
  const secMon1Cd = secId(mon1, 0, 'cooldown');
  const SS_MON1 = 'demo-ss-mon1-complex';

  ex('demo-e-mon1-wu1', 'General Mobility', 'warm-up', 'Warm-up', mon1, 0, 0, secMon1Wu, { parameterSource: 'toolbox' });
  ex('demo-e-mon1-wu2', 'Activation Drills', 'warm-up', 'Warm-up', mon1, 0, 1, secMon1Wu, { parameterSource: 'toolbox' });
  // Superset A: Back Squat + CMJ (strength–power complex)
  ex('demo-e-mon1-sq', 'Back Squat', METHODS[0], 'Kraft', mon1, 0, 0, secMon1Main, { supersetId: SS_MON1 });
  ex('demo-e-mon1-cmj', 'Countermovement Jump', METHODS[1], 'Sprungkraft', mon1, 0, 1, secMon1Main, { supersetId: SS_MON1 });
  ex('demo-e-mon1-rdl', 'Romanian Deadlift', METHODS[0], 'Kraft', mon1, 0, 2, secMon1Main, {});
  ex('demo-e-mon1-hip', 'Hip Thrust', METHODS[0], 'Kraft', mon1, 0, 3, secMon1Main, {});
  ex('demo-e-mon1-str', 'Static Stretching', 'cool-down', 'Cool-down', mon1, 0, 0, secMon1Cd, { parameterSource: 'toolbox' });

  supersets[mon1] = { '0': { [secMon1Main]: { [SS_MON1]: ['demo-e-mon1-sq', 'demo-e-mon1-cmj'] } } };

  // ---- Week 1 Wednesday (2026-03-25) – Sprint Session ----
  const wed1 = fmtDate(addDays(planStart, 2));
  const secWed1Wu = secId(wed1, 0, 'warmup');
  const secWed1Sprint = secId(wed1, 0, 'sprint');
  const secWed1Cd = secId(wed1, 0, 'cooldown');

  ex('demo-e-wed1-wu1', 'Lauf-ABCs', 'warm-up', 'Warm-up', wed1, 0, 0, secWed1Wu, { parameterSource: 'toolbox' });
  ex('demo-e-wed1-wu2', 'Sprintdrills', 'warm-up', 'Warm-up', wed1, 0, 1, secWed1Wu, { parameterSource: 'toolbox' });
  ex('demo-e-wed1-acc', '30m Beschleunigungsläufe', METHODS[2], 'Sprint', wed1, 0, 0, secWed1Sprint, {
    notes: '4 × 30 m · 3 min Pause',
  });
  ex('demo-e-wed1-fly', '60m Flying Sprints', METHODS[3], 'Sprint', wed1, 0, 1, secWed1Sprint, {
    notes: '3 × 60 m mit 20 m Anlauf · 5 min Pause',
  });
  ex('demo-e-wed1-jog', 'Auslaufen + Stretching', 'cool-down', 'Cool-down', wed1, 0, 0, secWed1Cd, {
    parameterSource: 'toolbox',
  });

  // ---- Week 1 Friday (2026-03-27) – Unilateral Strength ----
  const fri1 = fmtDate(addDays(planStart, 4));
  const secFri1Wu = secId(fri1, 0, 'warmup');
  const secFri1Main = secId(fri1, 0, 'main');
  const secFri1Cd = secId(fri1, 0, 'cooldown');
  const SS_FRI1 = 'demo-ss-fri1-unilateral';

  ex('demo-e-fri1-wu1', 'Foam Rolling', 'warm-up', 'Warm-up', fri1, 0, 0, secFri1Wu, { parameterSource: 'toolbox' });
  ex('demo-e-fri1-wu2', 'Hüftmobilisation', 'warm-up', 'Warm-up', fri1, 0, 1, secFri1Wu, { parameterSource: 'toolbox' });
  // Superset B: Bulgarian Split Squat + SL-RDL (unilateral, each side)
  ex('demo-e-fri1-bss', 'Bulgarian Split Squat', METHODS[0], 'Kraft', fri1, 0, 0, secFri1Main, {
    supersetId: SS_FRI1,
    eachSide: true,
  });
  ex('demo-e-fri1-slrdl', 'Single-Leg RDL', METHODS[0], 'Kraft', fri1, 0, 1, secFri1Main, {
    supersetId: SS_FRI1,
    eachSide: true,
  });
  ex('demo-e-fri1-nhc', 'Nordic Hamstring Curl', METHODS[0], 'Kraft', fri1, 0, 2, secFri1Main, {});
  ex('demo-e-fri1-str', 'Hip-Flexor Stretching', 'cool-down', 'Cool-down', fri1, 0, 0, secFri1Cd, {
    parameterSource: 'toolbox',
  });

  supersets[fri1] = { '0': { [secFri1Main]: { [SS_FRI1]: ['demo-e-fri1-bss', 'demo-e-fri1-slrdl'] } } };

  // ── parameterValues ─────────────────────────────────────────────────────────
  // Structure: paramValues[mesocycleId][microcycleIndex][methodName][sessionIdx][paramName] = value
  // 12 progressive values (one per week) for each parameter
  const pv: Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>> = {};

  type MethodConfig = Record<string, (string | number)[]>;
  const cfgs: Record<string, MethodConfig> = {
    [METHODS[0]]: {
      'Sätze':              [3, 4, 4, 2, 4, 4, 5, 3, 4, 5, 5, 3],
      'Wdh.':               [6, 5, 4, 6, 5, 4, 3, 5, 4, 3, 3, 5],
      'Intensität (% 1RM)': [75, 78, 82, 70, 80, 83, 87, 72, 83, 88, 90, 80],
      'Pause (min)':        [2.5, 3, 3, 2, 3, 3, 3.5, 2, 3, 3.5, 4, 2.5],
    },
    [METHODS[1]]: {
      'Sätze':       [3, 3, 4, 2, 4, 4, 5, 3, 4, 5, 5, 3],
      'Wdh.':        [5, 5, 4, 4, 5, 5, 4, 4, 5, 4, 3, 4],
      'Intensität':  ['60%', '65%', '70%', '60%', '70%', '75%', '80%', '65%', '75%', '80%', '85%', '70%'],
      'Pause (min)': [2, 2, 2.5, 2, 2, 2.5, 3, 2, 2.5, 3, 3, 2],
    },
    [METHODS[2]]: {
      'Frequenz/Woche': [2, 2, 3, 1, 3, 3, 3, 2, 3, 3, 3, 2],
      'Wdh.':           [4, 5, 6, 3, 6, 7, 8, 4, 6, 8, 10, 5],
      'Distanz (m)':    [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      'Pause (min)':    [3, 3, 3, 3, 3, 3, 4, 3, 3, 4, 4, 3],
    },
    [METHODS[3]]: {
      'Frequenz/Woche': [1, 1, 2, 1, 2, 2, 2, 1, 2, 3, 3, 2],
      'Wdh.':           [3, 3, 4, 2, 4, 4, 5, 3, 4, 5, 6, 4],
      'Distanz (m)':    [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
      'Anlauf (m)':     [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
      'Pause (min)':    [4, 4, 4, 4, 4, 4, 5, 4, 5, 5, 5, 4],
    },
  };

  MESO_IDS.forEach((mesoId, mi) => {
    pv[mesoId] = {};
    MICRO_IDS[mi].forEach((_, microIdx) => {
      pv[mesoId][microIdx] = {};
      METHODS.forEach((method) => {
        if (mi === 2 && method === METHODS[0]) return; // No max strength in meso 3
        const weekIdx = mi * 4 + microIdx;
        pv[mesoId][microIdx][method] = {
          0: Object.fromEntries(
            Object.entries(cfgs[method]).map(([param, vals]) => [param, vals[weekIdx]]),
          ),
        };
      });
    });
  });

  // ── methodAllocations ───────────────────────────────────────────────────────
  const methodAllocations: Record<string, string[]> = {
    [METHODS[0]]: ['demo-meso-1', 'demo-meso-2'],              // Max strength: not in competition phase
    [METHODS[1]]: ['demo-meso-1', 'demo-meso-2', 'demo-meso-3'],
    [METHODS[2]]: ['demo-meso-1', 'demo-meso-2', 'demo-meso-3'],
    [METHODS[3]]: ['demo-meso-1', 'demo-meso-2', 'demo-meso-3'],
  };

  // ── Build TrainingProgram entry ─────────────────────────────────────────────
  const programId = 'demo-program-1';
  const now = new Date().toISOString();

  const trainingProgram = {
    id: programId,
    name: macrocycleData.planName,
    athleteId: null,
    athleteName: null,
    primaryGoal: macrocycleData.smartGoals[0].description,
    duration: {
      startDate: planStart.toISOString(),
      endDate: planEnd.toISOString(),
      weeks: 12,
    },
    createdAt: now,
    lastModifiedAt: now,
    status: 'active',
    macrocycleData,
    mesocycleData: { mesocycles },
    trainingDays,
    exerciseDistribution,
    parameterValues: pv,
    dailyIntensityData,
    daySplitStates,
    sessionSections,
    supersets,
  };

  // ── Write to localStorage ───────────────────────────────────────────────────
  localStorage.setItem('macrocycleData', JSON.stringify(macrocycleData));
  localStorage.setItem('mesocycleData', JSON.stringify({ mesocycles }));
  localStorage.setItem('trainingDays', JSON.stringify(trainingDays));
  localStorage.setItem('dailyIntensityData', JSON.stringify(dailyIntensityData));
  localStorage.setItem('daySplitStates', JSON.stringify(daySplitStates));
  localStorage.setItem('sessionSections', JSON.stringify(sessionSections));
  localStorage.setItem('exerciseDistribution', JSON.stringify(exerciseDistribution));
  localStorage.setItem('supersets', JSON.stringify(supersets));
  localStorage.setItem('parameterValues', JSON.stringify(pv));
  localStorage.setItem('methodAllocations', JSON.stringify(methodAllocations));
  localStorage.setItem('activeProgramId', programId);
  localStorage.setItem('macrocycleStep', '3');
  localStorage.setItem('mesocycleStep', '1');

  // Add / replace in trainingPrograms store
  let store: { version: number; programs: unknown[] };
  try {
    const raw = localStorage.getItem('trainingPrograms');
    store = raw ? JSON.parse(raw) : { version: 1, programs: [] };
  } catch {
    store = { version: 1, programs: [] };
  }
  store.programs = (store.programs as { id: string }[]).filter((p) => p.id !== programId);
  store.programs.unshift(trainingProgram);
  localStorage.setItem('trainingPrograms', JSON.stringify(store));
}
