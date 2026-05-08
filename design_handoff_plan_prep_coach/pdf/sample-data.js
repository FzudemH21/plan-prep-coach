/* =====================================================================
   PDF Sample Data — Plan Prep Coach training plan export
   Realistic sprint-strength prep program. Used by Variation B.

   STRUCTURE
   - Macrocycle = the whole plan
   - Mesocycle = a block (Accumulation / Transmutation / Realization / Taper)
       - intensityLabel: overall intensity character of the block
       - description:    1–2 sentences, what's happening this block
       - microcycles[]:  each is N days (variable, NOT always 7)
           - days[]: per-day intensity key
       - repSession[]:   the representative weekly skeleton for this meso
                         (e.g. Mon = Lower Body Strength, Tue = Speed, …)
                         length matches the microcycle days
   ===================================================================== */

const samplePlan = {
  athlete: {
    name: "Lena Hartmann",
    sport: "100m / 200m Sprint",
    team: "National Junior Squad",
    level: "National Junior Squad", // legacy alias — falls back to team
    age: 19,
    avatar: "LH",
  },
  coach: {
    name: "Felix Hanik",
    role: "Head Coach · Sports Scientist",
    studio: "felyz",
    studioFull: "felyz performance",
    location: "Munich, DE",
    logo: "assets/felyz-logo.png",
    // Coach-configurable accent — drives every accent in the PDF.
    // In the real app this comes from the coach profile.
    accent: "#D4572C",       // ember
    accentInk: "#FFFFFF",    // text on accent
  },
  plan: {
    title: "Spring Prep — 2026 Outdoor Season",
    subtitle: "General prep → Specific prep → Peak",
    startDate: "Mon, Jan 12 2026",
    endDate:   "Sun, Apr 5 2026",
    createdOn: "May 7 2026",
  },

  // Goals tree.
  // - mainGoals[]: top-tier parameters this plan is built to improve.
  // - subGoals[]: lower-tier parameters whose improvement contributes to
  //     one or more main goals. `contributesTo` is an array of mainGoal ids.
  //   In the real app this comes from the parameter database, where each
  //   parameter declares which other parameters it positively influences.
  mainGoals: [
    { id: "mg-1", name: "100m sprint time",   baseline: "11.42 s",   target: "10.95 s",  unit: "s",     contributesTo: ["mg-2"] },
    { id: "mg-2", name: "200m sprint time",   baseline: "23.18 s",   target: "22.40 s",  unit: "s",     contributesTo: [] },
    { id: "mg-3", name: "Maximal Strength",   baseline: "1.55 ×BW",  target: "1.7 ×BW",  unit: "×BW",   contributesTo: ["mg-1"] },
  ],
  subGoals: [
    { id: "sg-1", name: "Flying 10m",          baseline: "0.92 s",    target: "0.84 s",   contributesTo: ["mg-1", "mg-2"], contributesToSubs: [] },
    { id: "sg-2", name: "30m from blocks",     baseline: "4.21 s",    target: "4.05 s",   contributesTo: ["mg-1"],         contributesToSubs: ["sg-1"] },
    { id: "sg-3", name: "RSI (drop jump 30cm)", baseline: "2.05",     target: "2.40",     contributesTo: ["mg-1", "mg-2"], contributesToSubs: ["sg-1", "sg-2"] },
    { id: "sg-4", name: "Back squat 1RM",      baseline: "95 kg",     target: "105 kg",   contributesTo: ["mg-3", "mg-1"], contributesToSubs: ["sg-2"] },
    { id: "sg-5", name: "Trap-bar deadlift",   baseline: "115 kg",    target: "130 kg",   contributesTo: ["mg-3"],         contributesToSubs: ["sg-4"] },
  ],

  // Legacy structure kept for backward compatibility — the JSX uses
  // mainGoals/subGoals above.
  parameters: [
    {
      name: "Maximal Speed",
      summary: "Top-end velocity production at 60–80m of a sprint.",
      subGoals: [
        { name: "Flying 30m time",    target: "3.20s",    current: "3.42s",    delta: "−0.22s" },
        { name: "Max velocity",        target: "10.5 m/s", current: "9.8 m/s",  delta: "+0.7"   },
      ],
    },
    {
      name: "Acceleration",
      summary: "Force production in the first three steps and 0–30m.",
      subGoals: [
        { name: "30m from blocks",     target: "4.05s",    current: "4.21s",    delta: "−0.16s" },
        { name: "10m split",            target: "1.78s",    current: "1.85s",    delta: "−0.07s" },
      ],
    },
    {
      name: "Maximal Strength",
      summary: "Lower-body force ceiling — directly transfers to acceleration.",
      subGoals: [
        { name: "Back squat 1RM",       target: "1.7×BW",   current: "1.55×BW",  delta: "+0.15×BW" },
        { name: "Trap-bar deadlift",    target: "2.0×BW",   current: "1.78×BW",  delta: "+0.22×BW" },
      ],
    },
    {
      name: "Reactive Strength",
      summary: "Stretch-shortening cycle quality — separates good from elite sprinters.",
      subGoals: [
        { name: "RSI (drop jump 30cm)", target: "2.4",      current: "2.05",     delta: "+0.35" },
        { name: "Ground contact time",  target: "<160 ms",  current: "184 ms",   delta: "−24 ms" },
      ],
    },
  ],

  // ---------------------------------------------------------------------
  // Mesocycles. Each microcycle's `days` length is the actual day count —
  // a microcycle does NOT have to be 7 days. The repSession array length
  // matches the microcycle length and labels each day's session theme.
  // ---------------------------------------------------------------------
  mesocycles: [
    {
      id: 1,
      name: "Accumulation",
      intensityKey: "moderate",
      intensityLabel: "Moderate",
      description:
        "Volume-led general prep. Building the work capacity and tendon resilience that lets the heavier blocks land. CNS load stays low; tonnage is the work.",
      color: "var(--meso-1)",
      microcycles: [
        { label: "MC 01", days: ["moderate","hard","easy","moderate-hard","moderate","easy","off"] },
        { label: "MC 02", days: ["moderate-hard","hard","easy","moderate-hard","hard","easy-moderate","off"] },
        { label: "MC 03", days: ["hard","hard","easy","moderate-hard","hard","easy-moderate","off"] },
        { label: "MC 04 · Deload", days: ["easy","moderate","easy","easy-moderate","moderate","easy","off"] },
      ],
      repSession: [
        { day: "Mon", title: "Lower Body — Strength Endurance", intensity: "moderate-hard", exercise: "Squat / RDL / Lunge",        prescription: "5×8"          },
        { day: "Tue", title: "Tempo — Extensive Aerobic",        intensity: "moderate",      exercise: "Tempo runs",                  prescription: "8–10×200m @ 70%" },
        { day: "Wed", title: "Recovery & Mobility",              intensity: "easy",          exercise: "Soft tissue, drills",         prescription: ""             },
        { day: "Thu", title: "Upper Body + MedBall Power",       intensity: "moderate-hard", exercise: "Bench, Pull, MedBall throws", prescription: ""             },
        { day: "Fri", title: "Tempo + Plyometrics (low)",        intensity: "moderate",      exercise: "Tempo + low-amplitude plyos", prescription: ""             },
        { day: "Sat", title: "Active Recovery",                  intensity: "easy",          exercise: "Light tempo, mobility",       prescription: ""             },
        { day: "Sun", title: "Off",                               intensity: "off",           exercise: "Rest, sleep, walk",           prescription: ""             },
      ],
    },
    {
      id: 2,
      name: "Transmutation",
      intensityKey: "hard",
      intensityLabel: "Hard",
      description:
        "Convert capacity to specific output. Heavy compound strength meets resisted sprints — the overlap that builds horizontal force at the start.",
      color: "var(--meso-3)",
      microcycles: [
        { label: "MC 05", days: ["hard","extremely-hard","easy","moderate-hard","extremely-hard","easy-moderate","off"] },
        { label: "MC 06", days: ["hard","extremely-hard","easy","moderate-hard","extremely-hard","easy-moderate","off"] },
        { label: "MC 07", days: ["extremely-hard","extremely-hard","easy","hard","extremely-hard","easy","off"] },
        { label: "MC 08 · Deload", days: ["moderate","easy-moderate","easy","easy-moderate","moderate","easy","off"] },
      ],
      repSession: [
        { day: "Mon", title: "Lower Body — Maximal Strength",   intensity: "hard",            exercise: "Heavy Squat",                 prescription: "5×3 @ 85–90%"   },
        { day: "Tue", title: "Speed — Resisted Acceleration",   intensity: "extremely-hard", exercise: "Sled sprints",                prescription: "15% BW, 10–30m"  },
        { day: "Wed", title: "Recovery & Tempo",                intensity: "easy",            exercise: "Tempo runs",                  prescription: "6×200m @ 65%"   },
        { day: "Thu", title: "Upper Body — Strength & Power",   intensity: "moderate-hard",   exercise: "Bench, Pull, MedBall",        prescription: ""               },
        { day: "Fri", title: "Speed — Max Velocity",            intensity: "extremely-hard", exercise: "Flying 20s, fly-ins",         prescription: ""               },
        { day: "Sat", title: "Active Recovery / Tempo",          intensity: "easy-moderate",   exercise: "Tempo + drills",              prescription: ""               },
        { day: "Sun", title: "Off",                              intensity: "off",             exercise: "Rest",                        prescription: ""               },
      ],
    },
    {
      id: 3,
      name: "Realization",
      intensityKey: "extremely-hard",
      intensityLabel: "Peak",
      description:
        "Speed-led specific prep. Volumes drop, intensity climbs. Goal: highest CNS output, sharpest sprint mechanics, ready to peak.",
      color: "var(--meso-5)",
      microcycles: [
        { label: "MC 09", days: ["hard","extremely-hard","easy-moderate","hard","extremely-hard","easy-moderate","off"] },
        { label: "MC 10", days: ["hard","extremely-hard","easy","hard","extremely-hard","easy-moderate","off"] },
        { label: "MC 11", days: ["moderate-hard","extremely-hard","easy","moderate-hard","extremely-hard","easy","off"] },
      ],
      repSession: [
        { day: "Mon", title: "Lower Body — Power",              intensity: "hard",            exercise: "Cluster Squat",               prescription: "4×(3×2)"        },
        { day: "Tue", title: "Speed — Acceleration",            intensity: "extremely-hard", exercise: "Block starts",                prescription: "6×30m"          },
        { day: "Wed", title: "Tempo + Mobility",                intensity: "easy-moderate",   exercise: "Tempo + drills",              prescription: "4×150m"         },
        { day: "Thu", title: "Upper Body — Power",              intensity: "hard",            exercise: "Bench, Pull, throws",         prescription: ""               },
        { day: "Fri", title: "Speed — Max Velocity",            intensity: "extremely-hard", exercise: "Flying 30s",                  prescription: "@ 95–100%"      },
        { day: "Sat", title: "Active Recovery",                 intensity: "easy-moderate",   exercise: "Tempo + plyos",               prescription: ""               },
        { day: "Sun", title: "Off",                              intensity: "off",             exercise: "Rest",                        prescription: ""               },
      ],
    },
    {
      id: 4,
      name: "Taper",
      intensityKey: "moderate-hard",
      intensityLabel: "Sharp",
      description:
        "Volume cut hard, intensity preserved. CNS arrives fresh on race day. Every session is short and crisp.",
      color: "var(--meso-7)",
      microcycles: [
        { label: "MC 12", days: ["moderate","extremely-hard","easy","easy-moderate","extremely-hard","off"] },
      ],
      repSession: [
        { day: "Mon", title: "Primer — Light Power",            intensity: "moderate",        exercise: "Squat",                       prescription: "3×3 @ 75%"      },
        { day: "Tue", title: "Speed — Crisp Sprints",           intensity: "extremely-hard", exercise: "Sprints",                     prescription: "4×30m @ 100%"   },
        { day: "Wed", title: "Mobility & Walk",                 intensity: "easy",            exercise: "Walk, soft tissue",           prescription: ""               },
        { day: "Thu", title: "Activation",                      intensity: "easy-moderate",   exercise: "Drills + sprints",            prescription: "2×30m"          },
        { day: "Fri", title: "Race / Time Trial",                intensity: "extremely-hard", exercise: "100m + 200m",                 prescription: ""               },
        { day: "Sat", title: "Off",                              intensity: "off",             exercise: "Rest",                        prescription: ""               },
      ],
    },
  ],

  // Methods with rationale + citations (the WHY of the program).
  // Each method's `parameters` MUST match the names of `parameters` above —
  // this is how the PDF groups methods under the parameter they improve.
  methods: [
    {
      name: "Heavy Compound Strength (>85% 1RM)",
      parameters: ["Maximal Strength", "Acceleration"],
      rationale: "Heavy resistance training above 85% 1RM is the most reliable driver of maximal force production. For Maximal Strength, it directly raises the squat/deadlift ceiling. For Acceleration, that strength transfers into horizontal force output in the first three steps — the squat-to-30m correlation is one of the most replicated findings in the sprint literature.",
      citations: [
        "Suchomel, Nimphius & Stone (2016). The Importance of Muscular Strength in Athletic Performance. Sports Medicine, 46(10).",
        "Seitz et al. (2014). Increases in Lower-Body Strength Transfer Positively to Sprint Performance. Sports Medicine, 44(12).",
      ],
    },
    {
      name: "Resisted Sprint (Sled Towing, 10–20% BW)",
      parameters: ["Acceleration"],
      rationale: "Sled loads of 10–20% BW preserve sprint mechanics while overloading the horizontal force vector — the dominant vector in the first three steps. Loading higher (>30% BW) shifts joint angles and reduces specificity. We dose this method only in the Transmutation and Realization blocks, where converting capacity to specific output is the priority.",
      citations: [
        "Morin et al. (2017). Very-Heavy Sled Training for Improving Horizontal-Force Output in Soccer Players. IJSPP, 12(6).",
      ],
    },
    {
      name: "Reactive Plyometrics (Drop & Depth Jumps)",
      parameters: ["Reactive Strength", "Maximal Speed"],
      rationale: "RSI correlates strongly with maximum velocity sprinting — the late-race phase where ground-contact times drop below 100ms. Short-contact plyometrics train the fast SSC that separates a 10.7 athlete from a 10.4 one. We prescribe depth-jump heights from 30–45cm based on RSI testing, and the volume tapers as the block intensifies to keep the contact times sharp, not fatigued.",
      citations: [
        "Healy et al. (2018). Reactive Strength Index: A Poor Indicator of Reactive Strength? IJSPP, 13(6).",
      ],
    },
    {
      name: "Maximum Velocity Sprinting (Flying 20–30s)",
      parameters: ["Maximal Speed"],
      rationale: "Top-end speed is trainable only by running near top-end speed. Fly-ins with a 20–30m run-up let Lena hit 95–100% of max velocity for 2–3 seconds at a time, which is the exact stimulus needed to lift the velocity ceiling. We always pair these with full recovery (>4 min) so each rep is a quality rep — fatigued reps reinforce the wrong mechanics.",
      citations: [
        "Haugen et al. (2019). The Training Characteristics of World-Class Sprinters. IJSPP, 14(6).",
      ],
    },
    {
      name: "Tempo Runs (60–75% max, extensive)",
      parameters: ["Maximal Speed", "Acceleration"],
      rationale: "Sub-maximal tempo runs build the aerobic base that supports recovery between high-intensity reps and between sessions. They are not a speed stimulus — they are the floor that makes the speed stimulus possible. Dosed only on low-CNS days to avoid interference with the speed and strength priorities.",
      citations: [
        "Mero et al. (1992). Biomechanics of sprint running. Sports Medicine, 13(6).",
      ],
    },
  ],
};

// ---------------------------------------------------------------------
// Helpers — derive plan-wide stats from the (data-driven) mesocycles.
// ---------------------------------------------------------------------
function planTotals(plan) {
  let microcycles = 0, days = 0, sessions = 0;
  for (const m of plan.mesocycles) {
    microcycles += m.microcycles.length;
    for (const mc of m.microcycles) {
      days += mc.days.length;
      sessions += mc.days.filter((d) => d !== "off").length;
    }
  }
  return { microcycles, days, sessions, mesocycles: plan.mesocycles.length };
}

// Average intensity rank of a microcycle — for the per-microcycle strip.
// Maps intensity keys → 0..7 numeric rank, then averages, then maps back.
const INTENSITY_ORDER = [
  "off", "deload", "easy", "easy-moderate", "moderate",
  "moderate-hard", "hard", "extremely-hard"
];
function microIntensityKey(microcycle) {
  // Drop "off" days from the average so a rest day at the end of the
  // microcycle doesn't drag the whole bar down.
  const ranks = microcycle.days
    .map((d) => INTENSITY_ORDER.indexOf(d))
    .filter((r) => r > 0); // exclude "off"
  if (ranks.length === 0) return "off";
  const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  return INTENSITY_ORDER[Math.round(avg)];
}

function intensityColor(key) {
  return `var(--intensity-${key})`;
}
function intensityLabel(key) {
  return ({
    "off":             "Off",
    "deload":          "Deload",
    "easy":            "Easy",
    "easy-moderate":   "Easy–Mod",
    "moderate":        "Moderate",
    "moderate-hard":   "Mod–Hard",
    "hard":            "Hard",
    "extremely-hard":  "Extremely Hard",
  })[key] || key;
}

// Generate microcycle date strings (May 31 - Jun 6 (7d)) by walking forward
// from plan.startDate. Mutates each microcycle to add `dateRange`.
(function annotateDates() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Parse "Mon, Jan 12 2026" → Date
  function parse(s) {
    const m = s.match(/(\w{3}),?\s+(\w{3})\s+(\d+)\s+(\d+)/);
    if (!m) return new Date();
    return new Date(`${m[2]} ${m[3]}, ${m[4]}`);
  }
  function fmt(d) { return `${months[d.getMonth()]} ${d.getDate()}`; }
  let cursor = parse(samplePlan.plan.startDate);
  for (const meso of samplePlan.mesocycles) {
    const mesoStart = new Date(cursor);
    for (const mc of meso.microcycles) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + mc.days.length - 1);
      mc.dateRange = `${fmt(start)} – ${fmt(end)}`;
      cursor.setDate(cursor.getDate() + mc.days.length);
    }
    const mesoEnd = new Date(cursor);
    mesoEnd.setDate(mesoEnd.getDate() - 1);
    meso.dateRange = `${fmt(mesoStart)} – ${fmt(mesoEnd)}`;
  }
})();

window.samplePlan = samplePlan;
window.planTotals = planTotals;
window.microIntensityKey = microIntensityKey;
window.intensityColor = intensityColor;
window.intensityLabel = intensityLabel;
window.A4 = { w: 794, h: 1123 };
