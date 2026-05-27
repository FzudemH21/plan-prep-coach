// Seed data utility – injects complete demo training plans into localStorage.
// All data structures match the current app schema (macrocycleData, mesocycleData,
// trainingDays, dailyIntensityData, sessionSections, exerciseDistribution, supersets,
// parameterValues, methodAllocations, daySplitStates).
//
// loadSeedData()     → 12-week sprint plan (existing demo)
// loadDemoPlan2026() → 4-week Demo Plan 2026 (all features: tests, events, mixed sessions)

const MESO_IDS = ['demo-meso-1', 'demo-meso-2', 'demo-meso-3'] as const;

const MICRO_IDS = [
  ['demo-micro-1-1', 'demo-micro-1-2', 'demo-micro-1-3', 'demo-micro-1-4'],
  ['demo-micro-2-1', 'demo-micro-2-2', 'demo-micro-2-3', 'demo-micro-2-4'],
  ['demo-micro-3-1', 'demo-micro-3-2', 'demo-micro-3-3', 'demo-micro-3-4'],
] as const;

const MICRO_INTENSITIES = [
  ['2', '4', '5', '1'],
  ['5', '6', '7', '1'],
  ['6', '7', '9', '5'],
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

export function loadSeedData(): unknown {
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
      intensity: '5',
      trainingMethods: [...METHODS],
      allocatedSubGoals: [SUB1, SUB2],
      trainingQualities: ['Maximalkraft', 'Schnellkraft', 'Beschleunigung'],
      microcycles: [
        { id: 'demo-micro-1-1', name: 'Woche 1', duration: 7, intensity: '2' },
        { id: 'demo-micro-1-2', name: 'Woche 2', duration: 7, intensity: '4' },
        { id: 'demo-micro-1-3', name: 'Woche 3', duration: 7, intensity: '5' },
        { id: 'demo-micro-1-4', name: 'Woche 4 (Deload)', duration: 7, intensity: '1' },
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
      intensity: '7',
      trainingMethods: [...METHODS],
      allocatedSubGoals: [SUB1, SUB2],
      trainingQualities: ['Maximalkraft', 'Schnellkraft', 'Maximalgeschwindigkeit'],
      microcycles: [
        { id: 'demo-micro-2-1', name: 'Woche 5', duration: 7, intensity: '5' },
        { id: 'demo-micro-2-2', name: 'Woche 6', duration: 7, intensity: '6' },
        { id: 'demo-micro-2-3', name: 'Woche 7', duration: 7, intensity: '7' },
        { id: 'demo-micro-2-4', name: 'Woche 8 (Deload)', duration: 7, intensity: '1' },
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
      intensity: '9',
      trainingMethods: [METHODS[1], METHODS[2], METHODS[3]], // No max strength in peak phase
      allocatedSubGoals: [SUB1, SUB2],
      trainingQualities: ['Schnellkraft', 'Beschleunigung', 'Maximalgeschwindigkeit'],
      microcycles: [
        { id: 'demo-micro-3-1', name: 'Woche 9', duration: 7, intensity: '6' },
        { id: 'demo-micro-3-2', name: 'Woche 10', duration: 7, intensity: '7' },
        { id: 'demo-micro-3-3', name: 'Woche 11', duration: 7, intensity: '9' },
        { id: 'demo-micro-3-4', name: 'Woche 12 (Taper)', duration: 7, intensity: '5' },
      ],
    },
  ];

  const microIntensityMap: Record<string, string> = {
    'demo-micro-1-1': '2',
    'demo-micro-1-2': '4',
    'demo-micro-1-3': '5',
    'demo-micro-1-4': '1',
    'demo-micro-2-1': '5',
    'demo-micro-2-2': '6',
    'demo-micro-2-3': '7',
    'demo-micro-2-4': '1',
    'demo-micro-3-1': '6',
    'demo-micro-3-2': '7',
    'demo-micro-3-3': '9',
    'demo-micro-3-4': '5',
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
      const intensity = isTraining ? microIntensity : '0';
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

  // ── Write to localStorage (best-effort – QuotaExceededError must not crash the function) ─
  try {
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
  } catch (e) {
    console.warn('[loadSeedData] localStorage write failed (quota?):', e);
  }

  // Add / replace in trainingPrograms store
  try {
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
  } catch (e) {
    console.warn('[loadSeedData] trainingPrograms store write failed (quota?):', e);
  }

  // ── Coach-Profil Seed-Daten ──────────────────────────────────────────────
  // Schreiben wenn: kein Profil vorhanden ODER nur ein Skipped-Profil gesetzt
  const _existingProfile = localStorage.getItem('coachProfile');
  const _isSkipped = _existingProfile
    ? (() => { try { const p = JSON.parse(_existingProfile); return p && p.skipped === true; } catch { return false; } })()
    : false;
  if (!_existingProfile || _isSkipped) {
    const coachProfile = {
      name: 'Felix Wagner',
      sports: ['Leichtathletik', 'Sprint'],
      structured: {
        philosophy:
          'Athletengerechte Periodisierung basierend auf wissenschaftlichen Erkenntnissen – ' +
          'jeder Trainingsplan wird individuell auf den Athleten zugeschnitten und berücksichtigt ' +
          'Belastungs-Erholungs-Balance, aktuelle Leistungsdaten und langfristige Entwicklungsziele.',
        methods:
          'Sprinttraining (Beschleunigung & Maximalgeschwindigkeit), Kraft- und Schnellkrafttraining, ' +
          'Plyometrie sowie gezieltes Techniktraining. Die Methoden werden je nach Mesozyklus-Phase ' +
          'in Frequenz und Intensität angepasst.',
        targetGroup:
          'Sprinter auf 100m–400m, Altersklasse 16–30 Jahre, vom ambitionierten Amateur bis zum Semi-Profi.',
        experience:
          '8 Jahre Coaching-Erfahrung im Leichtathletik-Bereich, davon 5 Jahre als Vereinstrainer ' +
          'mit nachweisbaren Leistungsverbesserungen bei über 20 Athleten.',
      },
      summary:
        'Felix Wagner ist ein erfahrener Leichtathletik-Coach mit Schwerpunkt Sprint, der evidenzbasierte ' +
        'Periodisierungsmethoden mit einer hohen Individualität in der Trainingsplanung verbindet. ' +
        'Seine Athleten profitieren von einem strukturierten, wissenschaftlich fundierten Ansatz, ' +
        'der Kraft, Schnelligkeit und Technik ganzheitlich entwickelt.',
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem('coachProfile', JSON.stringify(coachProfile));
  }

  return trainingProgram;
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo Plan 2026 – 4-week plan testing all current features:
//   • 2 Mesocycles × 2 Weeks • Tests & Events (calendarEvents + trainingDays)
//   • Mixed sessions (with / without exercises) • Periodization table values
// ─────────────────────────────────────────────────────────────────────────────

const D2_PROGRAM_ID = 'demo2-program-1';
const D2_PARAM_ID   = 'demo2-param-sprint';
const D2_ATHLETE_ID = 'demo2-athlete-1';

const D2_MESO = ['demo2-meso-1', 'demo2-meso-2'] as const;
const D2_MICRO = [
  ['demo2-micro-1-1', 'demo2-micro-1-2'],
  ['demo2-micro-2-1', 'demo2-micro-2-2'],
] as const;

const D2_METHODS = ['Kraft – Grundübungen', 'Sprint – Beschleunigung'] as const;

const D2_MICRO_INTENSITIES: Record<string, string> = {
  'demo2-micro-1-1': '2',
  'demo2-micro-1-2': '5',
  'demo2-micro-2-1': '7',
  'demo2-micro-2-2': '1',
};

function d2SecId(date: string, si: number, label: string): string {
  return `d2-sec-${date}-${si}-${label}`;
}

export function loadDemoPlan2026(): unknown {
  const now = new Date().toISOString();

  // Plan: 4 weeks starting 2026-04-06 (Monday)
  const planStart = new Date('2026-04-06T00:00:00.000Z');
  const planEnd   = addDays(planStart, 27); // 28 days → ends 2026-05-03

  // ── 1. Ensure demo parameter exists in parameters-database-v2 ──────────────
  {
    let pdb: { parameters: { id: string }[]; interactions: unknown[]; parameterMethods: unknown[]; lastUpdated: string };
    try {
      const raw = localStorage.getItem('parameters-database-v2');
      pdb = raw ? JSON.parse(raw) : { parameters: [], interactions: [], parameterMethods: [], lastUpdated: now };
    } catch {
      pdb = { parameters: [], interactions: [], parameterMethods: [], lastUpdated: now };
    }
    if (!pdb.parameters.find((p) => p.id === D2_PARAM_ID)) {
      pdb.parameters.push({ id: D2_PARAM_ID, name: '100m Sprint Zeit', unit: 's', category: 'speed', createdAt: now });
      pdb.lastUpdated = now;
      localStorage.setItem('parameters-database-v2', JSON.stringify(pdb));
    }
  }

  // ── 2. Ensure demo athlete exists in athlete-database ──────────────────────
  let athleteId = D2_ATHLETE_ID;
  {
    let adb: { groups: unknown[]; athletes: { id: string; isArchived?: boolean }[]; biometricDefinitions: unknown[]; athleteBiometrics: unknown[]; athletePerformanceParameters: unknown[]; calendarAssignments: unknown[] };
    try {
      const raw = localStorage.getItem('athlete-database');
      adb = raw ? JSON.parse(raw) : { groups: [], athletes: [], biometricDefinitions: [], athleteBiometrics: [], athletePerformanceParameters: [], calendarAssignments: [] };
    } catch {
      adb = { groups: [], athletes: [], biometricDefinitions: [], athleteBiometrics: [], athletePerformanceParameters: [], calendarAssignments: [] };
    }
    // Use first non-archived athlete if one exists, else create demo athlete
    const existing = adb.athletes.find((a) => !a.isArchived);
    if (existing) {
      athleteId = existing.id;
    } else if (!adb.athletes.find((a) => a.id === D2_ATHLETE_ID)) {
      adb.athletes.unshift({
        id: D2_ATHLETE_ID,
        firstName: 'Alex',
        middleName: null,
        lastName: 'Demo',
        birthday: '2000-01-01',
        sex: 'other',
        sport: 'Leichtathletik',
        occupation: null,
        dailyActivityLevel: 'very_active',
        groupIds: [],
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        notes: 'Demo-Athlet für Plan Prep Coach',
      });
      localStorage.setItem('athlete-database', JSON.stringify(adb));
    }
  }

  // ── 3. Key dates ────────────────────────────────────────────────────────────
  const testDay1  = fmtDate(addDays(planStart, 11)); // Fri Apr 17 – end of Meso 1
  const testDay2  = fmtDate(addDays(planStart, 25)); // Fri May 1  – end of Meso 2
  const eventDay1 = fmtDate(addDays(planStart, 7));  // Mon Apr 13 – start of Week 2
  const eventDay2 = fmtDate(addDays(planStart, 21)); // Mon Apr 27 – start of Week 4

  // ── 4. CalendarEvents for the athlete (tests + events) ────────────────────
  {
    let store: Record<string, unknown[]>;
    try {
      const raw = localStorage.getItem('calendarEvents');
      store = raw ? JSON.parse(raw) : {};
    } catch {
      store = {};
    }
    const existing = ((store[athleteId] || []) as { id: string }[]).filter(
      (e) => !e.id.startsWith('demo2-ce-'),
    );
    store[athleteId] = [
      ...existing,
      { id: 'demo2-ce-test-1',  date: testDay1,  type: 'test',  title: '100m Sprint Test',      notes: 'Zwischentest nach Woche 2', parameterId: D2_PARAM_ID, targetValue: '10.5' },
      { id: 'demo2-ce-test-2',  date: testDay2,  type: 'test',  title: '100m Sprint Test',      notes: 'Abschlusstest Woche 4',     parameterId: D2_PARAM_ID, targetValue: '10.3' },
      { id: 'demo2-ce-event-1', date: eventDay1, type: 'event', title: 'Trainingslager Beginn', notes: '3-tägiges Intensivlager' },
      { id: 'demo2-ce-event-2', date: eventDay2, type: 'event', title: 'Stadtmeisterschaften',  notes: 'Saisonhöhepunkt – 100m Final' },
    ];
    localStorage.setItem('calendarEvents', JSON.stringify(store));
  }

  // ── 5. macrocycleData ───────────────────────────────────────────────────────
  const D2_SG1  = 'demo2-sg-1';
  const D2_SUB1 = 'demo2-sub-1';

  const macrocycleData = {
    planName: 'Demo Plan 2026',
    planNotes: '4-Wochen-Plan zur Demo aller aktuellen Features: Tests, Events, gemischte Sessions, Periodisierungstabelle.',
    selectedAthleteId: athleteId,
    planDuration: {
      startDate: planStart.toISOString(),
      endDate: planEnd.toISOString(),
      totalDays: 28,
      totalWeeks: 4,
    },
    smartGoals: [
      {
        id: D2_SG1,
        description: '100m-Zeit auf 10.3 s verbessern (von 10.8 s in 4 Wochen)',
        baselineValue: 10.8,
        desiredValue: 10.3,
        unit: 's',
        percentChange: -4.6,
      },
    ],
    smartGoal: {
      id: D2_SG1,
      description: '100m-Zeit auf 10.3 s verbessern',
      baselineValue: 10.8,
      desiredValue: 10.3,
      unit: 's',
      percentChange: -4.6,
      startDate: planStart.toISOString(),
      endDate: planEnd.toISOString(),
      totalDays: 28,
      totalWeeks: 4,
    },
    subGoals: [
      {
        id: D2_SUB1,
        parentGoalId: D2_SG1,
        description: '100m Sprint Zeit messen',
        testMethod: '100m Sprint Test',
        preTestValue: 10.8,
        goalValue: 10.3,
        unit: 's',
        percentChange: -4.6,
        testDates: [testDay1, testDay2],
        comments: 'Zwischentest Woche 2, Abschlusstest Woche 4',
        parameterLinkedId: D2_PARAM_ID,
      },
    ],
    events: [
      {
        id: 'demo2-ev-1',
        name: 'Trainingslager Beginn',
        description: '3-tägiges Intensivlager',
        eventDates: [eventDay1],
        comments: 'Beginn Mesozyklus 1 Woche 2',
      },
      {
        id: 'demo2-ev-2',
        name: 'Stadtmeisterschaften',
        description: 'Saisonhöhepunkt – 100m Final',
        eventDates: [eventDay2],
        comments: 'Letzter Wettkampf der Saison',
      },
    ],
    qualities: [
      { id: 'd2-q-1', name: 'Maximalkraft',     description: 'Maximale Kraftentfaltung',    methods: [D2_METHODS[0]] },
      { id: 'd2-q-2', name: 'Beschleunigung',   description: 'Sprintbeschleunigung 0–30 m', methods: [D2_METHODS[1]] },
    ],
    qualitiesBySubGoal: {
      [D2_SUB1]: { label: '100m Sprint Zeit messen', list: ['Maximalkraft', 'Beschleunigung'] },
    },
    methodsByQuality: {
      'd2-q-1': { subGoalLabel: '100m Sprint Zeit messen', qualityName: 'Maximalkraft',   list: [D2_METHODS[0]] },
      'd2-q-2': { subGoalLabel: '100m Sprint Zeit messen', qualityName: 'Beschleunigung', list: [D2_METHODS[1]] },
    },
    selectedTest: null,
    selectedEvent: null,
    selectedMethods: [...D2_METHODS],
    manuallyAddedMethods: [],
    lastUpdated: now,
  };

  // ── 6. mesocycleData ────────────────────────────────────────────────────────
  const mesocycles = [
    {
      id: 'demo2-meso-1',
      name: 'Mesozyklus 1 – Aufbau',
      weeks: 2,
      sessionsPerWeek: 3,
      sessionLength: 75,
      startDate: planStart.toISOString(),
      endDate: addDays(planStart, 13).toISOString(),
      duration: 2,
      intensity: '5',
      trainingMethods: [...D2_METHODS],
      allocatedSubGoals: [D2_SUB1],
      trainingQualities: ['Maximalkraft', 'Beschleunigung'],
      microcycles: [
        { id: 'demo2-micro-1-1', name: 'Woche 1', duration: 7, intensity: '2' },
        { id: 'demo2-micro-1-2', name: 'Woche 2', duration: 7, intensity: '5' },
      ],
    },
    {
      id: 'demo2-meso-2',
      name: 'Mesozyklus 2 – Peak & Deload',
      weeks: 2,
      sessionsPerWeek: 3,
      sessionLength: 70,
      startDate: addDays(planStart, 14).toISOString(),
      endDate: planEnd.toISOString(),
      duration: 2,
      intensity: '7',
      trainingMethods: [...D2_METHODS],
      allocatedSubGoals: [D2_SUB1],
      trainingQualities: ['Maximalkraft', 'Beschleunigung'],
      microcycles: [
        { id: 'demo2-micro-2-1', name: 'Woche 3', duration: 7, intensity: '7' },
        { id: 'demo2-micro-2-2', name: 'Woche 4 (Deload)', duration: 7, intensity: '1' },
      ],
    },
  ];

  // ── 7. trainingDays + dailyIntensityData ────────────────────────────────────
  // Session names per day-of-week: Mon = Krafttraining, Wed = Sprinttraining, Fri = varies
  const sessionNameMap: Record<number, string[]> = {
    0: ['Krafttraining'],      // Mon
    2: ['Sprinttraining'],     // Wed
    4: ['Kraft & Sprint'],     // Fri (generic for most weeks)
  };
  const week1FriName  = 'Auxiliary Strength';
  const week2FriName  = '100m Sprint Test';   // test day
  const week3FriName  = 'Speed Endurance';
  const week4FriName  = '100m Sprint Test';   // test day

  const trainingDays: unknown[] = [];
  const dailyIntensityData: unknown[] = [];

  for (let week = 0; week < 4; week++) {
    const mesoIdx  = Math.floor(week / 2);
    const microIdx = week % 2;
    const mesoId   = D2_MESO[mesoIdx];
    const microId  = D2_MICRO[mesoIdx][microIdx];
    const microIntensity = D2_MICRO_INTENSITIES[microId];

    for (let d = 0; d < 7; d++) {
      const date    = addDays(planStart, week * 7 + d);
      const dateStr = fmtDate(date);
      const dow     = date.getDay();
      const dayName = DAY_NAMES[dow];

      const isTraining = dow === 1 || dow === 3 || dow === 5; // Mon/Wed/Fri
      const intensity  = isTraining ? microIntensity : '0';
      const isTestDay  = dateStr === testDay1 || dateStr === testDay2;
      const isEventDay = dateStr === eventDay1 || dateStr === eventDay2;

      // Determine session name
      let sessionNames: string[] | undefined;
      if (isTraining) {
        if (dow === 5) {
          // Friday: varies by week
          const friNames: Record<number, string> = { 0: week1FriName, 1: week2FriName, 2: week3FriName, 3: week4FriName };
          sessionNames = [friNames[week]];
        } else {
          sessionNames = sessionNameMap[dow === 1 ? 0 : 2];
        }
      }

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
        sessionNames: sessionNames ?? undefined,
        testNames:  isTestDay  ? ['100m Sprint Test']   : undefined,
        eventNames: isEventDay ? (dateStr === eventDay1 ? ['Trainingslager Beginn'] : ['Stadtmeisterschaften']) : undefined,
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

  // ── 8. daySplitStates ───────────────────────────────────────────────────────
  const daySplitStates: Record<string, number> = {};
  for (let week = 0; week < 4; week++) {
    for (const d of [0, 2, 4]) { // Mon/Wed/Fri offsets from Monday
      const dateStr = fmtDate(addDays(planStart, week * 7 + d));
      daySplitStates[dateStr] = 1;
    }
  }

  // ── 9. sessionSections ──────────────────────────────────────────────────────
  // Week 1 Mon, Wed, Fri get full section structure.
  // Remaining weeks: sections for Mon only (bare structure).
  const sessionSections: unknown[] = [];

  const addSections = (dateStr: string, si: number, isSprint: boolean) => {
    if (isSprint) {
      sessionSections.push(
        { id: d2SecId(dateStr, si, 'warmup'), dayDate: dateStr, sessionIndex: si, name: 'Warm-up',   order: 0 },
        { id: d2SecId(dateStr, si, 'sprint'), dayDate: dateStr, sessionIndex: si, name: 'Sprint',     order: 1 },
        { id: d2SecId(dateStr, si, 'cool'),   dayDate: dateStr, sessionIndex: si, name: 'Cool-down',  order: 2 },
      );
    } else {
      sessionSections.push(
        { id: d2SecId(dateStr, si, 'warmup'), dayDate: dateStr, sessionIndex: si, name: 'Warm-up',   order: 0 },
        { id: d2SecId(dateStr, si, 'main'),   dayDate: dateStr, sessionIndex: si, name: 'Hauptarbeit', order: 1 },
        { id: d2SecId(dateStr, si, 'cool'),   dayDate: dateStr, sessionIndex: si, name: 'Cool-down',  order: 2 },
      );
    }
  };

  for (let week = 0; week < 4; week++) {
    for (const d of [0, 2, 4]) {
      const date    = addDays(planStart, week * 7 + d);
      const dateStr = fmtDate(date);
      const dow     = date.getDay();
      const isSprint = dow === 3; // Wednesday
      if (week === 0) {
        // Week 1: all three training days get full sections
        addSections(dateStr, 0, isSprint);
      } else if (dow === 1) {
        // Other weeks: Monday gets sections (bare structure, no exercises)
        addSections(dateStr, 0, false);
      }
      // Wed/Fri of weeks 2-4: no pre-defined sections (coach fills in)
    }
  }

  // ── 10. exerciseDistribution + supersets ────────────────────────────────────
  // Full exercises only for Week 1 Monday & Friday to demonstrate the feature.
  // Week 1 Wednesday and all other days: no pre-filled exercises.
  const exerciseDistribution: unknown[] = [];
  const supersets: Record<string, Record<string, Record<string, Record<string, string[]>>>> = {};

  const d2Ex = (
    id: string, exerciseName: string, methodId: string, categoryName: string,
    dateStr: string, si: number, order: number, sectionId: string,
    extras: Record<string, unknown> = {},
  ) => {
    exerciseDistribution.push({
      id,
      exerciseId: `d2-exlib-${id}`,
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

  // ─ Week 1 Monday (2026-04-06): Krafttraining Unterkörper (WITH exercises) ─
  const mon1 = fmtDate(planStart);
  const secMon1Wu   = d2SecId(mon1, 0, 'warmup');
  const secMon1Main = d2SecId(mon1, 0, 'main');
  const secMon1Cool = d2SecId(mon1, 0, 'cool');
  const SS_MON1 = 'd2-ss-mon1';

  d2Ex('d2-e-mon1-wu1',  'Hip Mobility Circuit', 'warm-up', 'Warm-up', mon1, 0, 0, secMon1Wu, { parameterSource: 'toolbox' });
  d2Ex('d2-e-mon1-wu2',  'Glute Activation',     'warm-up', 'Warm-up', mon1, 0, 1, secMon1Wu, { parameterSource: 'toolbox' });
  // Superset: Back Squat + Countermovement Jump (strength–power complex)
  d2Ex('d2-e-mon1-sq',   'Back Squat',            D2_METHODS[0], 'Kraft', mon1, 0, 0, secMon1Main, { supersetId: SS_MON1 });
  d2Ex('d2-e-mon1-cmj',  'Countermovement Jump',  D2_METHODS[0], 'Kraft', mon1, 0, 1, secMon1Main, { supersetId: SS_MON1 });
  d2Ex('d2-e-mon1-rdl',  'Romanian Deadlift',     D2_METHODS[0], 'Kraft', mon1, 0, 2, secMon1Main, {});
  d2Ex('d2-e-mon1-str',  'Static Stretching',     'cool-down', 'Cool-down', mon1, 0, 0, secMon1Cool, { parameterSource: 'toolbox' });

  supersets[mon1] = { '0': { [secMon1Main]: { [SS_MON1]: ['d2-e-mon1-sq', 'd2-e-mon1-cmj'] } } };

  // ─ Week 1 Friday (2026-04-10): Auxiliary Strength (WITH exercises) ──────────
  const fri1 = fmtDate(addDays(planStart, 4));
  const secFri1Wu   = d2SecId(fri1, 0, 'warmup');
  const secFri1Main = d2SecId(fri1, 0, 'main');
  const secFri1Cool = d2SecId(fri1, 0, 'cool');

  d2Ex('d2-e-fri1-wu1',  'Foam Rolling',        'warm-up', 'Warm-up', fri1, 0, 0, secFri1Wu, { parameterSource: 'toolbox' });
  d2Ex('d2-e-fri1-bss',  'Bulgarian Split Squat', D2_METHODS[0], 'Kraft', fri1, 0, 0, secFri1Main, { eachSide: true });
  d2Ex('d2-e-fri1-nhc',  'Nordic Hamstring Curl', D2_METHODS[0], 'Kraft', fri1, 0, 1, secFri1Main, {});
  d2Ex('d2-e-fri1-acc',  '30m Beschleunigung',    D2_METHODS[1], 'Sprint', fri1, 0, 2, secFri1Main, { notes: '3 × 30 m · 3 min Pause' });
  d2Ex('d2-e-fri1-str',  'Hip-Flexor Stretch',    'cool-down', 'Cool-down', fri1, 0, 0, secFri1Cool, { parameterSource: 'toolbox' });

  // Week 1 Wednesday: sessions only, no exercises (demonstrated via sessionSections above)

  // ── 11. parameterValues ─────────────────────────────────────────────────────
  // pv[mesoId][microcycleIndex][methodName][sessionIndex][paramName] = value
  type ParamMap = Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>;
  const pv: ParamMap = {};

  const d2Cfgs: Record<string, Record<string, (string | number)[]>> = {
    [D2_METHODS[0]]: {
      'Sätze':              [3, 4, 5, 2],
      'Wdh.':               [6, 5, 4, 6],
      'Intensität (% 1RM)': [70, 77, 83, 65],
      'Pause (min)':        [2.5, 3, 3.5, 2],
    },
    [D2_METHODS[1]]: {
      'Frequenz/Woche': [2, 3, 3, 1],
      'Wdh.':           [4, 5, 6, 3],
      'Distanz (m)':    [30, 30, 30, 30],
      'Pause (min)':    [3, 3, 4, 3],
    },
  };

  D2_MESO.forEach((mesoId, mi) => {
    pv[mesoId] = {};
    D2_MICRO[mi].forEach((_, microIdx) => {
      pv[mesoId][microIdx] = {};
      const weekIdx = mi * 2 + microIdx;
      D2_METHODS.forEach((method) => {
        pv[mesoId][microIdx][method] = {
          0: Object.fromEntries(
            Object.entries(d2Cfgs[method]).map(([param, vals]) => [param, vals[weekIdx]]),
          ),
        };
      });
    });
  });

  // ── 12. methodAllocations ───────────────────────────────────────────────────
  const methodAllocations: Record<string, string[]> = {
    [D2_METHODS[0]]: ['demo2-meso-1', 'demo2-meso-2'],
    [D2_METHODS[1]]: ['demo2-meso-1', 'demo2-meso-2'],
  };

  // ── 13. Assemble TrainingProgram ────────────────────────────────────────────
  const trainingProgram = {
    id: D2_PROGRAM_ID,
    name: 'Demo Plan 2026',
    athleteId,
    athleteName: null, // resolved on load from athlete-database
    primaryGoal: macrocycleData.smartGoals[0].description,
    duration: {
      startDate: planStart.toISOString(),
      endDate: planEnd.toISOString(),
      weeks: 4,
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

  // ── 14. Write to trainingPrograms store (insert at top) ────────────────────
  try {
    let store: { version: number; programs: { id: string }[] };
    try {
      const raw = localStorage.getItem('trainingPrograms');
      store = raw ? JSON.parse(raw) : { version: 1, programs: [] };
    } catch {
      store = { version: 1, programs: [] };
    }
    store.programs = store.programs.filter((p) => p.id !== D2_PROGRAM_ID);
    store.programs.unshift(trainingProgram);
    localStorage.setItem('trainingPrograms', JSON.stringify(store));
  } catch (e) {
    console.warn('[loadDemoPlan2026] trainingPrograms store write failed (quota?):', e);
  }

  console.info('[Demo Plan 2026] Loaded – athleteId:', athleteId, '| calendarEvents added for athlete');
  return trainingProgram;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strength Development – 12-Week Plan
//   • 3 Mesocycles × 4 Weeks • Mon/Tue/Thu training days
//   • Full exercise detail for first week of each mesocycle
//   • Progressive parameter values across all 12 weeks
// ─────────────────────────────────────────────────────────────────────────────

const STR_PROGRAM_ID = 'strength-plan-12w';

const STR_MESO_IDS = ['str-meso-1', 'str-meso-2', 'str-meso-3'] as const;

const STR_MICRO_IDS = [
  ['str-micro-1-1', 'str-micro-1-2', 'str-micro-1-3', 'str-micro-1-4'],
  ['str-micro-2-1', 'str-micro-2-2', 'str-micro-2-3', 'str-micro-2-4'],
  ['str-micro-3-1', 'str-micro-3-2', 'str-micro-3-3', 'str-micro-3-4'],
] as const;

const SMETHODS = [
  'Max Strength – Compound Lifts',
  'Hypertrophy – Volume Training',
  'Posterior Chain & Accessories',
] as const;

function strSecId(date: string, si: number, label: string): string {
  return `str-sec-${date}-${si}-${label}`;
}

export function loadStrengthPlan(): unknown {
  const now = new Date().toISOString();

  // Plan: 12 weeks starting 2026-06-01 (Monday)
  const planStart = new Date('2026-06-01T00:00:00.000Z');
  const planEnd = addDays(planStart, 83); // ends 2026-08-23

  const startDate = planStart.toISOString();
  const endDate = planEnd.toISOString();

  // ── Microcycle intensity map ─────────────────────────────────────────────
  const strMicroIntensityMap: Record<string, string> = {
    'str-micro-1-1': '2',
    'str-micro-1-2': '5',
    'str-micro-1-3': '7',
    'str-micro-1-4': '1',
    'str-micro-2-1': '5',
    'str-micro-2-2': '6',
    'str-micro-2-3': '7',
    'str-micro-2-4': '1',
    'str-micro-3-1': '7',
    'str-micro-3-2': '9',
    'str-micro-3-3': '7',
    'str-micro-3-4': '2',
  };

  // ── macrocycleData ────────────────────────────────────────────────────────
  const macrocycleData = {
    planName: 'Strength Development – 12-Week Plan',
    selectedAthleteId: null,
    planDuration: {
      startDate,
      endDate,
      totalDays: 84,
      totalWeeks: 12,
    },
    smartGoals: [
      {
        id: 'str-sg-1',
        description: 'Back Squat: 100 kg → 130 kg (+30%)',
        baselineValue: 100,
        desiredValue: 130,
        unit: 'kg',
        percentChange: 30,
      },
    ],
    smartGoal: {
      id: 'str-sg-1',
      description: 'Back Squat: 100 kg → 130 kg (+30%)',
      baselineValue: 100,
      desiredValue: 130,
      unit: 'kg',
      percentChange: 30,
    },
    subGoals: [
      {
        id: 'str-sub-1',
        parentGoalId: 'str-sg-1',
        description: 'Build hypertrophy base',
        testMethod: 'Lean Body Mass (DEXA)',
        preTestValue: 72,
        goalValue: 76,
        unit: 'kg',
        percentChange: 5.6,
      },
      {
        id: 'str-sub-2',
        parentGoalId: 'str-sg-1',
        description: 'Improve relative strength',
        testMethod: 'Back Squat 1RM',
        preTestValue: 100,
        goalValue: 130,
        unit: 'kg',
        percentChange: 30,
      },
    ],
    events: [
      {
        id: 'str-ev-1',
        name: 'Strength Test – 1RM Back Squat',
        description: 'Final performance test',
        eventDates: [fmtDate(addDays(planStart, 77))],
        comments: 'Week 12 Monday',
      },
    ],
    qualities: [
      {
        id: 'str-q-1',
        name: 'Maximal Strength',
        description: 'Maximum force production',
        methods: [SMETHODS[0]],
      },
      {
        id: 'str-q-2',
        name: 'Muscle Hypertrophy',
        description: 'Increase in muscle cross-section',
        methods: [SMETHODS[1]],
      },
      {
        id: 'str-q-3',
        name: 'Posterior Chain Strength',
        description: 'Hip hinge and unilateral strength',
        methods: [SMETHODS[2]],
      },
    ],
    qualitiesBySubGoal: {
      'str-sub-1': {
        label: 'Build hypertrophy base',
        list: ['Muscle Hypertrophy', 'Posterior Chain Strength'],
      },
      'str-sub-2': {
        label: 'Improve relative strength',
        list: ['Maximal Strength', 'Posterior Chain Strength'],
      },
    },
    methodsByQuality: {
      'str-q-1': {
        subGoalLabel: 'Improve relative strength',
        qualityName: 'Maximal Strength',
        list: [SMETHODS[0]],
      },
      'str-q-2': {
        subGoalLabel: 'Build hypertrophy base',
        qualityName: 'Muscle Hypertrophy',
        list: [SMETHODS[1]],
      },
      'str-q-3': {
        subGoalLabel: 'Build hypertrophy base',
        qualityName: 'Posterior Chain Strength',
        list: [SMETHODS[2]],
      },
    },
    selectedTest: null,
    selectedEvent: null,
    selectedMethods: [...SMETHODS],
    manuallyAddedMethods: [],
    lastUpdated: now,
  };

  // ── mesocycleData ─────────────────────────────────────────────────────────
  const mesocycles = [
    {
      id: 'str-meso-1',
      name: 'Phase 1 – Foundation',
      weeks: 4,
      sessionsPerWeek: 3,
      sessionLength: 75,
      startDate,
      endDate: addDays(planStart, 27).toISOString(),
      duration: 4,
      intensity: '5',
      trainingMethods: [...SMETHODS],
      microcycles: [
        { id: 'str-micro-1-1', name: 'Week 1', duration: 7, intensity: '2' },
        { id: 'str-micro-1-2', name: 'Week 2', duration: 7, intensity: '5' },
        { id: 'str-micro-1-3', name: 'Week 3', duration: 7, intensity: '7' },
        { id: 'str-micro-1-4', name: 'Week 4 (Deload)', duration: 7, intensity: '1' },
      ],
    },
    {
      id: 'str-meso-2',
      name: 'Phase 2 – Strength Build',
      weeks: 4,
      sessionsPerWeek: 3,
      sessionLength: 75,
      startDate: addDays(planStart, 28).toISOString(),
      endDate: addDays(planStart, 55).toISOString(),
      duration: 4,
      intensity: '7',
      trainingMethods: [...SMETHODS],
      microcycles: [
        { id: 'str-micro-2-1', name: 'Week 5', duration: 7, intensity: '5' },
        { id: 'str-micro-2-2', name: 'Week 6', duration: 7, intensity: '6' },
        { id: 'str-micro-2-3', name: 'Week 7', duration: 7, intensity: '7' },
        { id: 'str-micro-2-4', name: 'Week 8 (Deload)', duration: 7, intensity: '1' },
      ],
    },
    {
      id: 'str-meso-3',
      name: 'Phase 3 – Peak Strength',
      weeks: 4,
      sessionsPerWeek: 3,
      sessionLength: 70,
      startDate: addDays(planStart, 56).toISOString(),
      endDate: addDays(planStart, 83).toISOString(),
      duration: 4,
      intensity: '9',
      trainingMethods: [SMETHODS[0], SMETHODS[2]], // No volume training in peak phase
      microcycles: [
        { id: 'str-micro-3-1', name: 'Week 9', duration: 7, intensity: '7' },
        { id: 'str-micro-3-2', name: 'Week 10', duration: 7, intensity: '9' },
        { id: 'str-micro-3-3', name: 'Week 11', duration: 7, intensity: '7' },
        { id: 'str-micro-3-4', name: 'Week 12', duration: 7, intensity: '2' },
      ],
    },
  ];

  // ── trainingDays + dailyIntensityData ─────────────────────────────────────
  // Training days: Monday (dow=1), Tuesday (dow=2), Thursday (dow=4)
  const trainingDays: unknown[] = [];
  const dailyIntensityData: unknown[] = [];

  for (let week = 0; week < 12; week++) {
    const mesoIdx = Math.floor(week / 4);
    const microIdx = week % 4;
    const mesoId = STR_MESO_IDS[mesoIdx];
    const microId = STR_MICRO_IDS[mesoIdx][microIdx];
    const microIntensity = strMicroIntensityMap[microId];

    for (let d = 0; d < 7; d++) {
      const date = addDays(planStart, week * 7 + d);
      const dateStr = fmtDate(date);
      const dow = date.getDay(); // 0=Sun
      const dayName = DAY_NAMES[dow];

      // Training: Mon(1), Tue(2), Thu(4)
      const isTraining = dow === 1 || dow === 2 || dow === 4;
      const intensity = isTraining ? microIntensity : '0';

      let sessionName: string | undefined;
      if (dow === 1) sessionName = 'Lower Body – Squat';
      else if (dow === 2) sessionName = 'Upper Body – Press & Pull';
      else if (dow === 4) sessionName = 'Posterior Chain';

      trainingDays.push({
        date: dateStr,
        dayOfWeek: dow,
        dayName,
        mesocycleId: mesoId,
        microcycleId: microId,
        isTestDay: false,
        isEventDay: false,
        isTrainingDay: isTraining,
        intensity,
        sessions: isTraining ? 1 : undefined,
        sessionNames: isTraining && sessionName ? [sessionName] : undefined,
      });

      dailyIntensityData.push({
        date: dateStr,
        mesocycleId: mesoId,
        microcycleId: microId,
        dayOfWeek: dow,
        intensity,
        isTestDay: false,
        isEventDay: false,
      });
    }
  }

  // ── daySplitStates – only training days (Mon=0, Tue=1, Thu=3 offsets from Mon) ──
  const daySplitStates: Record<string, number> = {};
  for (let week = 0; week < 12; week++) {
    // Mon offset=0, Tue offset=1, Thu offset=3
    for (const d of [0, 1, 3]) {
      const dateStr = fmtDate(addDays(planStart, week * 7 + d));
      daySplitStates[dateStr] = 1;
    }
  }

  // ── sessionSections – all training days, flat array ──────────────────────
  const sessionSections: unknown[] = [];

  for (let week = 0; week < 12; week++) {
    for (const d of [0, 1, 3]) {
      const dateStr = fmtDate(addDays(planStart, week * 7 + d));
      sessionSections.push(
        { id: strSecId(dateStr, 0, 'warmup'),   dayDate: dateStr, sessionIndex: 0, name: 'Warm-up',   order: 0 },
        { id: strSecId(dateStr, 0, 'main'),     dayDate: dateStr, sessionIndex: 0, name: 'Main Work',  order: 1 },
        { id: strSecId(dateStr, 0, 'cooldown'), dayDate: dateStr, sessionIndex: 0, name: 'Cool-down',  order: 2 },
      );
    }
  }

  // ── exerciseDistribution ──────────────────────────────────────────────────
  const exerciseDistribution: unknown[] = [];
  const supersets: Record<string, Record<string, Record<string, Record<string, string[]>>>> = {};

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
      exerciseId: `str-exlib-${id}`,
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

  // ──────────────────────────────────────────────────────────────────────────
  // Exercise distribution – all 12 weeks, generated by loop per mesocycle
  // ──────────────────────────────────────────────────────────────────────────

  // Mesocycle 1 (weeks 1–4): Mon d=0, Tue d=1, Thu d=3
  for (let weekIdx = 0; weekIdx < 4; weekIdx++) {
    const mon = fmtDate(addDays(planStart, weekIdx * 7 + 0));
    const tue = fmtDate(addDays(planStart, weekIdx * 7 + 1));
    const thu = fmtDate(addDays(planStart, weekIdx * 7 + 3));
    const w = `m1w${weekIdx}`;

    // Monday – Lower Body
    const monWu = strSecId(mon, 0, 'warmup'); const monMain = strSecId(mon, 0, 'main'); const monCd = strSecId(mon, 0, 'cooldown');
    ex(`str-e-${w}mon-wu1`, 'Foam Rolling',                          'warm-up',   'Warm-up',     mon, 0, 0, monWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}mon-wu2`, 'Hip Mobility Drill',                    'warm-up',   'Warm-up',     mon, 0, 1, monWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}mon-sq`,  'Back Squat',                            SMETHODS[0], 'Strength',    mon, 0, 0, monMain, {});
    ex(`str-e-${w}mon-rdl`, 'Romanian Deadlift',                     SMETHODS[0], 'Strength',    mon, 0, 1, monMain, {});
    ex(`str-e-${w}mon-lp`,  'Leg Press',                             SMETHODS[1], 'Hypertrophy', mon, 0, 2, monMain, {});
    ex(`str-e-${w}mon-lu`,  'Walking Lunge',                         SMETHODS[1], 'Hypertrophy', mon, 0, 3, monMain, {});
    ex(`str-e-${w}mon-cd1`, 'Static Stretching – Quads/Hip Flexors', 'cool-down', 'Cool-down',   mon, 0, 0, monCd,   { parameterSource: 'toolbox' });

    // Tuesday – Upper Body
    const tueWu = strSecId(tue, 0, 'warmup'); const tueMain = strSecId(tue, 0, 'main'); const tueCd = strSecId(tue, 0, 'cooldown');
    ex(`str-e-${w}tue-wu1`, 'Band Pull-Apart',    'warm-up',   'Warm-up',     tue, 0, 0, tueWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}tue-wu2`, 'Shoulder Circles',   'warm-up',   'Warm-up',     tue, 0, 1, tueWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}tue-bp`,  'Bench Press',        SMETHODS[0], 'Strength',    tue, 0, 0, tueMain, {});
    ex(`str-e-${w}tue-pu`,  'Pull-Up',            SMETHODS[0], 'Strength',    tue, 0, 1, tueMain, {});
    ex(`str-e-${w}tue-ohp`, 'Overhead Press',     SMETHODS[1], 'Hypertrophy', tue, 0, 2, tueMain, {});
    ex(`str-e-${w}tue-row`, 'Bent-over Row',      SMETHODS[1], 'Hypertrophy', tue, 0, 3, tueMain, {});
    ex(`str-e-${w}tue-cd1`, 'Doorframe Stretch',  'cool-down', 'Cool-down',   tue, 0, 0, tueCd,   { parameterSource: 'toolbox' });

    // Thursday – Posterior Chain
    const thuWu = strSecId(thu, 0, 'warmup'); const thuMain = strSecId(thu, 0, 'main'); const thuCd = strSecId(thu, 0, 'cooldown');
    ex(`str-e-${w}thu-wu1`, 'Glute Activation',       'warm-up',   'Warm-up',    thu, 0, 0, thuWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}thu-wu2`, 'Dead Bug',                'warm-up',   'Warm-up',    thu, 0, 1, thuWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}thu-bss`, 'Bulgarian Split Squat',   SMETHODS[2], 'Accessories',thu, 0, 0, thuMain, {});
    ex(`str-e-${w}thu-ht`,  'Hip Thrust',              SMETHODS[2], 'Accessories',thu, 0, 1, thuMain, {});
    ex(`str-e-${w}thu-nhc`, 'Nordic Hamstring Curl',   SMETHODS[2], 'Accessories',thu, 0, 2, thuMain, {});
    ex(`str-e-${w}thu-cp`,  'Copenhagen Plank',        SMETHODS[2], 'Accessories',thu, 0, 3, thuMain, {});
    ex(`str-e-${w}thu-cd1`, 'Hip 90/90 Stretch',       'cool-down', 'Cool-down',  thu, 0, 0, thuCd,   { parameterSource: 'toolbox' });
  }

  // Mesocycle 2 (weeks 5–8): offset = (4 + weekIdx) * 7
  for (let weekIdx = 0; weekIdx < 4; weekIdx++) {
    const mon = fmtDate(addDays(planStart, (4 + weekIdx) * 7 + 0));
    const tue = fmtDate(addDays(planStart, (4 + weekIdx) * 7 + 1));
    const thu = fmtDate(addDays(planStart, (4 + weekIdx) * 7 + 3));
    const w = `m2w${weekIdx}`;

    // Monday – Lower Body
    const monWu = strSecId(mon, 0, 'warmup'); const monMain = strSecId(mon, 0, 'main'); const monCd = strSecId(mon, 0, 'cooldown');
    ex(`str-e-${w}mon-wu1`, 'Foam Rolling',                          'warm-up',   'Warm-up',     mon, 0, 0, monWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}mon-wu2`, 'Hip Mobility Drill',                    'warm-up',   'Warm-up',     mon, 0, 1, monWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}mon-sq`,  'Back Squat',                            SMETHODS[0], 'Strength',    mon, 0, 0, monMain, {});
    ex(`str-e-${w}mon-fsq`, 'Front Squat',                           SMETHODS[0], 'Strength',    mon, 0, 1, monMain, {});
    ex(`str-e-${w}mon-rdl`, 'Romanian Deadlift',                     SMETHODS[2], 'Accessories', mon, 0, 2, monMain, {});
    ex(`str-e-${w}mon-hbd`, 'Hex Bar Deadlift',                      SMETHODS[2], 'Accessories', mon, 0, 3, monMain, {});
    ex(`str-e-${w}mon-cd1`, 'Static Stretching – Quads/Hip Flexors', 'cool-down', 'Cool-down',   mon, 0, 0, monCd,   { parameterSource: 'toolbox' });

    // Tuesday – Upper Body
    const tueWu = strSecId(tue, 0, 'warmup'); const tueMain = strSecId(tue, 0, 'main'); const tueCd = strSecId(tue, 0, 'cooldown');
    ex(`str-e-${w}tue-wu1`, 'Band Pull-Apart',    'warm-up',   'Warm-up',     tue, 0, 0, tueWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}tue-wu2`, 'Shoulder Circles',   'warm-up',   'Warm-up',     tue, 0, 1, tueWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}tue-bp`,  'Bench Press',        SMETHODS[0], 'Strength',    tue, 0, 0, tueMain, {});
    ex(`str-e-${w}tue-wpu`, 'Weighted Pull-Up',   SMETHODS[0], 'Strength',    tue, 0, 1, tueMain, {});
    ex(`str-e-${w}tue-pp`,  'Push Press',         SMETHODS[1], 'Hypertrophy', tue, 0, 2, tueMain, {});
    ex(`str-e-${w}tue-pr`,  'Pendlay Row',        SMETHODS[1], 'Hypertrophy', tue, 0, 3, tueMain, {});
    ex(`str-e-${w}tue-cd1`, 'Doorframe Stretch',  'cool-down', 'Cool-down',   tue, 0, 0, tueCd,   { parameterSource: 'toolbox' });

    // Thursday – Posterior Chain
    const thuWu = strSecId(thu, 0, 'warmup'); const thuMain = strSecId(thu, 0, 'main'); const thuCd = strSecId(thu, 0, 'cooldown');
    ex(`str-e-${w}thu-wu1`, 'Glute Activation',    'warm-up',   'Warm-up',    thu, 0, 0, thuWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}thu-wu2`, 'Dead Bug',             'warm-up',   'Warm-up',    thu, 0, 1, thuWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}thu-bss`, 'Bulgarian Split Squat',SMETHODS[2], 'Accessories',thu, 0, 0, thuMain, {});
    ex(`str-e-${w}thu-ht`,  'Hip Thrust',           SMETHODS[2], 'Accessories',thu, 0, 1, thuMain, {});
    ex(`str-e-${w}thu-gb`,  'Glute Bridge',         SMETHODS[2], 'Accessories',thu, 0, 2, thuMain, {});
    ex(`str-e-${w}thu-slr`, 'Single Leg RDL',       SMETHODS[2], 'Accessories',thu, 0, 3, thuMain, {});
    ex(`str-e-${w}thu-cd1`, 'Hip 90/90 Stretch',    'cool-down', 'Cool-down',  thu, 0, 0, thuCd,   { parameterSource: 'toolbox' });
  }

  // Mesocycle 3 (weeks 9–12): offset = (8 + weekIdx) * 7
  for (let weekIdx = 0; weekIdx < 4; weekIdx++) {
    const mon = fmtDate(addDays(planStart, (8 + weekIdx) * 7 + 0));
    const tue = fmtDate(addDays(planStart, (8 + weekIdx) * 7 + 1));
    const thu = fmtDate(addDays(planStart, (8 + weekIdx) * 7 + 3));
    const w = `m3w${weekIdx}`;

    // Monday – Lower Body (Peak, 3 exercises)
    const monWu = strSecId(mon, 0, 'warmup'); const monMain = strSecId(mon, 0, 'main'); const monCd = strSecId(mon, 0, 'cooldown');
    ex(`str-e-${w}mon-wu1`, 'Foam Rolling',                          'warm-up',   'Warm-up',   mon, 0, 0, monWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}mon-wu2`, 'Hip Mobility Drill',                    'warm-up',   'Warm-up',   mon, 0, 1, monWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}mon-sq`,  'Back Squat',                            SMETHODS[0], 'Strength',  mon, 0, 0, monMain, {});
    ex(`str-e-${w}mon-psq`, 'Paused Squat',                          SMETHODS[0], 'Strength',  mon, 0, 1, monMain, {});
    ex(`str-e-${w}mon-rp`,  'Rack Pull',                             SMETHODS[0], 'Strength',  mon, 0, 2, monMain, {});
    ex(`str-e-${w}mon-cd1`, 'Static Stretching – Quads/Hip Flexors', 'cool-down', 'Cool-down', mon, 0, 0, monCd,   { parameterSource: 'toolbox' });

    // Tuesday – Upper Body (Peak)
    const tueWu = strSecId(tue, 0, 'warmup'); const tueMain = strSecId(tue, 0, 'main'); const tueCd = strSecId(tue, 0, 'cooldown');
    ex(`str-e-${w}tue-wu1`, 'Band Pull-Apart',    'warm-up',   'Warm-up',    tue, 0, 0, tueWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}tue-wu2`, 'Shoulder Circles',   'warm-up',   'Warm-up',    tue, 0, 1, tueWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}tue-bp`,  'Bench Press',        SMETHODS[0], 'Strength',   tue, 0, 0, tueMain, {});
    ex(`str-e-${w}tue-ib`,  'Incline Bench Press',SMETHODS[0], 'Strength',   tue, 0, 1, tueMain, {});
    ex(`str-e-${w}tue-wd`,  'Weighted Dip',       SMETHODS[0], 'Strength',   tue, 0, 2, tueMain, {});
    ex(`str-e-${w}tue-cr`,  'Cable Row',          SMETHODS[2], 'Accessories',tue, 0, 3, tueMain, {});
    ex(`str-e-${w}tue-cd1`, 'Doorframe Stretch',  'cool-down', 'Cool-down',  tue, 0, 0, tueCd,   { parameterSource: 'toolbox' });

    // Thursday – Posterior Chain (Peak)
    const thuWu = strSecId(thu, 0, 'warmup'); const thuMain = strSecId(thu, 0, 'main'); const thuCd = strSecId(thu, 0, 'cooldown');
    ex(`str-e-${w}thu-wu1`, 'Glute Activation',    'warm-up',   'Warm-up',    thu, 0, 0, thuWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}thu-wu2`, 'Dead Bug',             'warm-up',   'Warm-up',    thu, 0, 1, thuWu,   { parameterSource: 'toolbox' });
    ex(`str-e-${w}thu-bss`, 'Bulgarian Split Squat',SMETHODS[2], 'Accessories',thu, 0, 0, thuMain, {});
    ex(`str-e-${w}thu-hbd`, 'Hex Bar Deadlift',     SMETHODS[2], 'Accessories',thu, 0, 1, thuMain, {});
    ex(`str-e-${w}thu-ht`,  'Hip Thrust',           SMETHODS[2], 'Accessories',thu, 0, 2, thuMain, {});
    ex(`str-e-${w}thu-cd1`, 'Hip 90/90 Stretch',    'cool-down', 'Cool-down',  thu, 0, 0, thuCd,   { parameterSource: 'toolbox' });
  }

  // ── parameterValues ───────────────────────────────────────────────────────
  // pv[mesoId][microcycleIndex][methodName][sessionIdx][paramName] = value
  // 12 progressive values (one per week)
  const pv: Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>> = {};

  // SMETHODS[0] – Max Strength – Compound Lifts
  const strCfg0: Record<string, (string | number)[]> = {
    'Sets':          [3, 3, 4, 2, 4, 4, 5, 3, 5, 5, 4, 3],
    'Reps':          [8, 6, 5, 8, 5, 4, 3, 5, 3, 2, 3, 5],
    'Intensity (% 1RM)': [70, 75, 80, 65, 80, 85, 88, 75, 88, 92, 90, 82],
    'Rest (min)':    [1.5, 2, 2, 1.5, 2.5, 3, 3, 2, 3, 4, 3.5, 2.5],
  };

  // SMETHODS[1] – Hypertrophy – Volume Training (meso 1 and 2 only)
  const strCfg1: Record<string, (string | number)[]> = {
    'Sets':          [3, 4, 4, 2, 4, 4, 3, 2, 0, 0, 0, 0],
    'Reps':          [12, 10, 10, 12, 10, 8, 10, 10, 0, 0, 0, 0],
    'Intensity (% 1RM)': [60, 65, 68, 55, 70, 72, 70, 62, 0, 0, 0, 0],
    'Rest (min)':    [1, 1, 1.5, 1, 1.5, 1.5, 1.5, 1, 0, 0, 0, 0],
  };

  // SMETHODS[2] – Posterior Chain & Accessories
  const strCfg2: Record<string, (string | number)[]> = {
    'Sets':          [3, 3, 3, 2, 3, 4, 4, 3, 4, 4, 4, 3],
    'Reps':          [10, 10, 8, 10, 8, 8, 6, 8, 6, 5, 6, 8],
    'Rest (min)':    [1.5, 1.5, 2, 1.5, 2, 2, 2.5, 2, 2.5, 3, 2.5, 2],
  };

  STR_MESO_IDS.forEach((mesoId, mi) => {
    pv[mesoId] = {};
    STR_MICRO_IDS[mi].forEach((_, microIdx) => {
      pv[mesoId][microIdx] = {};
      const weekIdx = mi * 4 + microIdx;

      // SMETHODS[0] – always present
      pv[mesoId][microIdx][SMETHODS[0]] = {
        0: Object.fromEntries(
          Object.entries(strCfg0).map(([param, vals]) => [param, vals[weekIdx]]),
        ),
      };

      // SMETHODS[1] – meso 1 and 2 only
      if (mi < 2) {
        pv[mesoId][microIdx][SMETHODS[1]] = {
          0: Object.fromEntries(
            Object.entries(strCfg1).map(([param, vals]) => [param, vals[weekIdx]]),
          ),
        };
      }

      // SMETHODS[2] – always present
      pv[mesoId][microIdx][SMETHODS[2]] = {
        0: Object.fromEntries(
          Object.entries(strCfg2).map(([param, vals]) => [param, vals[weekIdx]]),
        ),
      };
    });
  });

  // ── methodAllocations ─────────────────────────────────────────────────────
  const methodAllocations: Record<string, string[]> = {
    [SMETHODS[0]]: ['str-meso-1', 'str-meso-2', 'str-meso-3'],
    [SMETHODS[1]]: ['str-meso-1', 'str-meso-2'],
    [SMETHODS[2]]: ['str-meso-1', 'str-meso-2', 'str-meso-3'],
  };

  // ── Assemble TrainingProgram ──────────────────────────────────────────────
  const trainingProgram = {
    id: STR_PROGRAM_ID,
    name: 'Strength Development – 12-Week Plan',
    athleteId: null,
    athleteName: 'Demo Athlete',
    primaryGoal: 'Increase maximal strength: Back Squat 100 kg → 130 kg in 12 weeks',
    duration: {
      startDate,
      endDate,
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
    methodAllocations,
  };

  // ── Write to trainingPrograms store only (upsert by id) ──────────────────
  try {
    let store: { version: number; programs: { id: string }[] };
    try {
      const raw = localStorage.getItem('trainingPrograms');
      store = raw ? JSON.parse(raw) : { version: 1, programs: [] };
    } catch {
      store = { version: 1, programs: [] };
    }
    store.programs = store.programs.filter((p) => p.id !== STR_PROGRAM_ID);
    store.programs.unshift(trainingProgram);
    localStorage.setItem('trainingPrograms', JSON.stringify(store));
  } catch (e) {
    console.warn('[loadStrengthPlan] trainingPrograms store write failed (quota?):', e);
  }

  console.info('[Strength Plan 12W] Loaded – id:', STR_PROGRAM_ID);
  return trainingProgram;
}

// ── Exercise Library Seed Data ───────────────────────────────────────────────
// Injects 5 demo category libraries with exercises into custom_libraries.
// Never overwrites existing libraries – merges by library id.

interface SeedLibrary {
  id: string;
  name: string;
  description: string;
  exercises: string[];
}

const EXERCISE_SEED_LIBRARIES: SeedLibrary[] = [
  {
    id: 'sprint-speed',
    name: 'Sprint & Speed',
    description: 'Sprint- und Schnelligkeitsübungen',
    exercises: [
      'Lauf ABC (Koordination)', 'Steigerungsläufe', 'Fliegender Sprint 30m', 'Blockstart 10m',
      'Wicket Drills', 'Resisted Sprint 20m', 'Wicket Run', 'Flying Sprint 60m',
      'Wall Drive Drill', 'A-Skip', 'B-Skip', 'High Knee Sprint',
    ],
  },
  {
    id: 'kraft-unterkrper',
    name: 'Kraft – Unterkörper',
    description: 'Unterkörper-Kraftübungen',
    exercises: [
      'Back Squat', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Hip Thrust',
      'Front Squat', 'Hex Bar Deadlift', 'Leg Press', 'Nordic Hamstring Curl',
      'Step-Up', 'Glute Bridge', 'Barbell Lunge', 'Box Squat',
    ],
  },
  {
    id: 'kraft-oberkrper',
    name: 'Kraft – Oberkörper',
    description: 'Oberkörper-Kraftübungen',
    exercises: [
      'Bench Press', 'Pull-Up', 'Overhead Press', 'Bent-over Row',
      'Incline Bench Press', 'Dumbbell Row', 'Face Pull', 'Dip',
      'Landmine Press', 'Cable Row', 'Lat Pulldown', 'Push-Up Variation',
    ],
  },
  {
    id: 'plyometrie',
    name: 'Plyometrie',
    description: 'Plyometrische Sprungübungen',
    exercises: [
      'Box Jump', 'Depth Jump', 'Broad Jump', 'Single Leg Hop',
      'Hurdle Jump', 'Triple Hop', 'Reactive Drop Jump', 'Lateral Bound',
      'Ankle Stiffness Jump', 'Bounding', 'Tuck Jump', 'Pogo Jump',
    ],
  },
  {
    id: 'stabilitt-mobilitt',
    name: 'Stabilität & Mobilität',
    description: 'Stabilitäts- und Mobilitätsübungen',
    exercises: [
      'Copenhagen Plank', 'Nordic Hamstring Curl', 'Hip 90/90 Stretch', 'Ankle Mobility',
      'Dead Bug', 'Pallof Press', 'Single Leg RDL', 'Hip Airplane',
      'T-Spine Rotation', 'Thoracic Extension', 'Glute Bridge March', 'Monster Walk',
    ],
  },
  {
    id: 'olympisch',
    name: 'Olympic Lifts',
    description: 'Olympic weightlifting movements',
    exercises: [
      'Power Clean', 'Hang Power Clean', 'Power Snatch', 'Hang Power Snatch',
      'Push Jerk', 'Clean Pull', 'Snatch Pull', 'Clean & Jerk',
    ],
  },
  {
    id: 'conditioning',
    name: 'Conditioning',
    description: 'Energy system conditioning',
    exercises: [
      'Sled Push 20m', 'Sled Pull 20m', 'Prowler Sprint', 'Tempo Run 200m',
      'Hill Sprint 40m', 'Bike Sprint 10s', 'Row 500m', 'Ski Erg 500m',
    ],
  },
];

const EXERCISE_LIB_COLUMNS = [
  { id: 'name', name: 'Übungsname', type: 'text' as const, required: true },
  { id: 'notes', name: 'Notizen', type: 'textarea' as const, required: false },
];

export function loadExerciseLibrarySeedData(): unknown[] {
  const STORAGE_KEY = 'custom_libraries';
  const now = new Date().toISOString();

  let stored: { libraries: any[]; lastUpdated: string; version: string };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.version >= '3.0.0') {
      stored = parsed;
    } else {
      stored = { libraries: [], lastUpdated: now, version: '3.0.0' };
    }
  } catch {
    stored = { libraries: [], lastUpdated: now, version: '3.0.0' };
  }

  let changed = false;
  let ts = Date.now();

  for (const lib of EXERCISE_SEED_LIBRARIES) {
    const existing = stored.libraries.find((l: any) => l.id === lib.id);

    if (!existing) {
      // Create library with exercises
      const exercises = lib.exercises.map((name, i) => ({
        id: String(ts + i),
        data: { name, notes: '' },
      }));
      ts += lib.exercises.length;

      stored.libraries.push({
        id: lib.id,
        name: lib.name,
        type: 'exercise',
        description: lib.description,
        columns: EXERCISE_LIB_COLUMNS,
        exercises,
        createdAt: now,
        lastUpdated: now,
      });
      changed = true;
    } else {
      // Library exists – add only exercises not already present (match by name)
      const existingNames = new Set(
        existing.exercises.map((e: any) => (e.data?.name ?? '').toLowerCase())
      );
      const toAdd = lib.exercises.filter(n => !existingNames.has(n.toLowerCase()));
      if (toAdd.length > 0) {
        existing.exercises.push(
          ...toAdd.map((name, i) => ({
            id: String(ts + i),
            data: { name, notes: '' },
          }))
        );
        ts += toAdd.length;
        existing.lastUpdated = now;
        changed = true;
      }
    }
  }

  if (changed) {
    stored.lastUpdated = now;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    console.info('[Exercise Library Seed] Loaded', EXERCISE_SEED_LIBRARIES.length, 'libraries');
  } else {
    console.info('[Exercise Library Seed] Already up to date – no changes made');
  }

  // Return the seed libraries in CustomLibrary format so callers can sync to Supabase
  let ts2 = Date.now();
  return EXERCISE_SEED_LIBRARIES.map(lib => {
    const exercises = lib.exercises.map((name, i) => ({
      id: String(ts2 + i),
      data: { name, notes: '' },
    }));
    ts2 += lib.exercises.length;
    return {
      id: lib.id,
      name: lib.name,
      type: 'exercise',
      description: lib.description,
      columns: EXERCISE_LIB_COLUMNS,
      exercises,
      createdAt: now,
      lastUpdated: now,
    };
  });
}
