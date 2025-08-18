export interface TrainingGoalData {
  overarchingGoal: string;
  subGoal: string;
  quality: string;
  trainingMethod: string;
}

export const trainingData: TrainingGoalData[] = [
  // Sprint ability goals
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Start technique", trainingMethod: "Block starts 6–10 × 10–20 m @90–100% with full recovery (2–4 min), 2–3×/wk; emphasize set-up, shin angles, first 2 steps; video feedback each rep" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Reaction time", trainingMethod: "Simple→choice reaction starts (light/sound cues): 8–12 reps, 2–3×/wk; 10–20 s between reps; add false-start control drills" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Initial RFD (0–100 ms)", trainingMethod: "Max-intent isometrics (IMTP or iso-squat): 3–6 × 3–5 s, 2×/wk; pair with unloaded jumps 4–6 × 3–5 @ full intent (2–3 min rest)" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Horizontal impulse at 1st–3rd step", trainingMethod: "Heavy resisted sprints 10–20 m with 30–50% v-decrement: 4–8 reps, 2×/wk; 2–4 min rest; posture cue 'push long'" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Shin angle management", trainingMethod: "Wall drills (A-march/lean): 3–5 × 20–30 contacts, 2–3×/wk; progress to 3-step build-outs 6–10 reps" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Intermuscular coordination (hip–knee–ankle)", trainingMethod: "Dribble to 10–20 m & wicket runs 3–5 × 20–30 m, 2×/wk; maintain front-side mechanics" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Motor unit recruitment & firing rate", trainingMethod: "Heavy resistance training >85% 1RM (squat/hinge): 3–6 × ≤5 reps, 2×/wk; 2–4 min rest; rotate front/back/hinge" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Trunk stiffness & bracing", trainingMethod: "Anti-extension/anti-rotation isometrics 3–5 × 20–40 s, 2–3×/wk; add heavy carries 4–6 × 20–40 m" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Arm swing timing", trainingMethod: "Seated/standing arm-swing drills 4–6 × 10–15 cycles, 2×/wk; integrate into 10–20 m starts" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Block start & reaction", quality: "Psychological arousal & attentional focus", trainingMethod: "Pre-performance routine practice 1–2×/wk (breath cues, visualization 5–8 min) before starts; 6–10 blocked then 6–10 random starts" },
  
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Horizontal force production", trainingMethod: "Resisted sprints 10–20 m with 10–30% v-decrement: 3–6 reps, 2×/wk; pair with heavy trap-bar deadlift 3–5 × 2–5 @85–95% 1RM" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Force orientation (horizontal vs vertical)", trainingMethod: "Sled pulls/pushes with torso lean: 4–8 × 10–20 m, 2×/wk; aim constant shin angle; 2–3 min rest" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Step length–frequency balance", trainingMethod: "Wicket runs 4–6 × 20–30 m, 2×/wk; adjust spacing to target contact time and projection" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Early-phase RFD", trainingMethod: "Isometric mid-thigh pull 3–5 × 3–5 s + jump squats 20–40% 1RM 4–6 × 3–5, 2×/wk" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Hip extensor strength", trainingMethod: "Back or front squat 3–6 × 3–6 @80–92% 1RM, 2×/wk; hinge pattern (RDL) 3–5 × 4–6 @70–85%" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Ankle plantarflexor stiffness", trainingMethod: "Isometric calf raises 4–5 × 30–45 s (straight/bent knee), 3×/wk; progress to pogo series 4–6 × 20–30 contacts" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Front-side mechanics", trainingMethod: "A/B-skips & dribbles 3–5 × 20–30 m, 2×/wk; integrate into 3–5 × 10–20 m accelerations" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Interlimb coordination", trainingMethod: "Alternating step drills & wall cycles 3–5 × 10–15 cycles, 2×/wk; immediate transfer to sprints" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Technique under load", trainingMethod: "Resisted accelerations (light–moderate) 6–10 × 10–20 m, 2×/wk; cue posture & projection" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 0–10 m", quality: "Tendon elasticity", trainingMethod: "Low-amplitude pogos 4–6 × 20–30 contacts, 2–3×/wk; progress to drop jumps (20–30 cm) 3–5 × 5–8" },

  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 10–30 m", quality: "Net impulse per step", trainingMethod: "Unresisted 20–30 m accelerations 4–8 reps, 2×/wk with full recovery; pair with heavy sled 10–20 m 3–5 reps" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 10–30 m", quality: "Progressive body angle rise", trainingMethod: "10–30 m build-ups with posture checkpoints: 6–10 reps, 2×/wk; 2–4 min rest" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 10–30 m", quality: "Hamstring eccentric strength", trainingMethod: "Nordic hamstring 3–4 × 4–6, 2×/wk; long-length RDL 3–4 × 6–8 @65–80% 1RM" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 10–30 m", quality: "Gluteus maximus power", trainingMethod: "Hip thrust 3–5 × 3–6 @80–90% 1RM, 2×/wk; add banded hip extension 3–4 × 8–12" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 10–30 m", quality: "Step-to-step variability control", trainingMethod: "Laser/gates approaches with step audit: 6–10 reps, 1–2×/wk; constraint drills for consistent projection" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 10–30 m", quality: "Stretch–shortening cycle utilization", trainingMethod: "Loaded jumps (trap-bar jump) 20–40% 1RM 4–6 × 3–5, 2×/wk; pogo→bound progressions" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 10–30 m", quality: "Technical rhythm", trainingMethod: "Metronome wicket runs 4–6 × 20–30 m, 2×/wk" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Acceleration 10–30 m", quality: "Braking minimization", trainingMethod: "Coaching cueing + video; wicket spacing to prevent overstriding; 6–10 runs, 2×/wk" },

  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Very short ground contact time", trainingMethod: "Fly sprints 20–30 m @98–100% vmax: 4–8 reps, 2×/wk; 3–5 min rest; aim tc < 120–140 ms" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Step frequency optimization", trainingMethod: "Wicket runs 4–6 × 20–30 m (tight spacing), 2×/wk; cadence targets" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Functional leg stiffness", trainingMethod: "Drop jumps 20–40 cm 4–6 × 5–8, 2×/wk; RSIST ankle/knee 3–5 × 3–5 s" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Vertical force at speed", trainingMethod: "Heavy partial squats 3–5 × 3–5 @85–95% 1RM, 1–2×/wk; fly sprints as above" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Hip flexor velocity", trainingMethod: "High-knee switch drills 4–6 × 10–15 cycles, 2×/wk; resisted band switches 3–4 × 8–12" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Hip extensor velocity", trainingMethod: "Light sled runs 20–30 m (≤10% v-dec) 4–8 reps, 2×/wk with max intent" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Ankle stiffness", trainingMethod: "Ankling/pogos 4–6 × 20–30 contacts, 2–3×/wk; isometric calf 4–5 × 30–45 s" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Elastic energy return", trainingMethod: "Bounding series 3–5 × 20–30 m, 1–2×/wk; technical emphasis" },
  { overarchingGoal: "Improving sprint ability", subGoal: "Max velocity development", quality: "Technical posture and pelvis control", trainingMethod: "Posture drills (A-run posture holds) 3–5 × 20–30 m, 2×/wk; cues neutral pelvis" },

  // Change of Direction goals
  { overarchingGoal: "Improving change of direction (COD) ability", subGoal: "Deceleration capacity", quality: "High braking force eccentrically", trainingMethod: "Decel runs 10–20 m → stick: 4–6 × 3–5, 2×/wk; eccentric split squats 3–5 × 4–6 @70–85% with 3–4 s lowering" },
  { overarchingGoal: "Improving change of direction (COD) ability", subGoal: "Deceleration capacity", quality: "Rate of force absorption", trainingMethod: "Drop landings 20–40 cm 3–5 × 4–6, 2×/wk; cue 'quiet fast feet'" },
  { overarchingGoal: "Improving change of direction (COD) ability", subGoal: "Deceleration capacity", quality: "Stiffness modulation", trainingMethod: "Isometric mid-range lunges 3–5 × 20–40 s, 2×/wk; progress to reactive hops" },
  { overarchingGoal: "Improving change of direction (COD) ability", subGoal: "Deceleration capacity", quality: "Trunk–hip control", trainingMethod: "Anti-rotation/lateral core 3–4 × 8–12 + carries 4–6 × 20–40 m, 2–3×/wk" },
  { overarchingGoal: "Improving change of direction (COD) ability", subGoal: "Deceleration capacity", quality: "Foot placement precision", trainingMethod: "Cone-braking patterns 6–10 × 10–20 m, 2×/wk; video foot strike" },

  // Muscle Mass goals
  { overarchingGoal: "Increasing muscle mass", subGoal: "Global hypertrophy (whole body)", quality: "Positive protein balance (training-induced MPS)", trainingMethod: "RT 10–20 hard sets/muscle/wk @ 6–20 reps, 30–85% 1RM; distribute 2–4×/wk; protein 1.6–2.2 g/kg/day (note, nutrition outside training scope)" },
  { overarchingGoal: "Increasing muscle mass", subGoal: "Global hypertrophy (whole body)", quality: "Mechanical tension tolerance", trainingMethod: "Compound lifts 3–5 × 6–10 @ 70–85% 1RM, 2–4×/wk; proximity to failure 0–2 RIR" },
  { overarchingGoal: "Increasing muscle mass", subGoal: "Global hypertrophy (whole body)", quality: "Stretch-mediated signaling", trainingMethod: "Long-length partials (e.g., incline DB press deep): 3–5 × 8–12, 2–3×/wk" },
  { overarchingGoal: "Increasing muscle mass", subGoal: "Global hypertrophy (whole body)", quality: "Fiber hypertrophy (type I and II)", trainingMethod: "Mixed loading: 3–5 × 5–8 @ 80–85% + 2–4 × 12–20 @ 30–50%, 2–4×/wk" },

  { overarchingGoal: "Increasing muscle mass", subGoal: "Regional hypertrophy (lower body)", quality: "Quadriceps cross-sectional area", trainingMethod: "Back/front squat or leg press 3–5 × 6–12 @ 65–85% 1RM, 2–3×/wk" },
  { overarchingGoal: "Increasing muscle mass", subGoal: "Regional hypertrophy (lower body)", quality: "Hamstrings cross-sectional area", trainingMethod: "RDL/Nordic 3–4 × 6–10, 2×/wk; long-length bias" },
  { overarchingGoal: "Increasing muscle mass", subGoal: "Regional hypertrophy (lower body)", quality: "Gluteal cross-sectional area", trainingMethod: "Hip thrust 3–5 × 6–12 @ 70–85%, 2–3×/wk; step-ups 3–4 × 8–12" },

  // Strength goals
  { overarchingGoal: "Increasing muscle strength", subGoal: "Maximal dynamic strength (1RM)", quality: "Myofibrillar hypertrophy", trainingMethod: "Heavy compound RT 3–6 × 3–6 @ 80–90% 1RM, 2–3×/wk" },
  { overarchingGoal: "Increasing muscle strength", subGoal: "Maximal dynamic strength (1RM)", quality: "Neural drive (recruitment/firing)", trainingMethod: "Singles/doubles @ 90–95% 1RM 3–6 total lifts, 1–2×/wk; long rest 3–5 min" },
  { overarchingGoal: "Increasing muscle strength", subGoal: "Maximal dynamic strength (1RM)", quality: "Intermuscular coordination", trainingMethod: "Competition lifts 4–6 × 1–3 @ 85–92% 1RM, 2×/wk; pause/tempo variants" },

  { overarchingGoal: "Increasing muscle strength", subGoal: "Rate of force development", quality: "Early-phase neural drive", trainingMethod: "Ballistic lifts 20–40% 1RM 4–6 × 3–5, 2×/wk; contrast with heavy sets" },
  { overarchingGoal: "Increasing muscle strength", subGoal: "Rate of force development", quality: "Tendon stiffness", trainingMethod: "Short high-intent isometrics 4–6 × 3–5 s, 2–3×/wk" },
  { overarchingGoal: "Increasing muscle strength", subGoal: "Rate of force development", quality: "Explosive coordination", trainingMethod: "Olympic lift derivatives 4–6 × 2–3 @ 60–80%, 2×/wk" },

  // Running goals
  { overarchingGoal: "Running – short distance performance (400–800 m)", subGoal: "Speed reserve & maximal velocity", quality: "Maximal sprint speed", trainingMethod: "Fly 20–30 m: 4–8 reps @98–100% vmax, 1–2×/wk; 3–5 min rest" },
  { overarchingGoal: "Running – short distance performance (400–800 m)", subGoal: "Speed reserve & maximal velocity", quality: "Step frequency", trainingMethod: "Wicket runs 4–6 × 20–30 m, 1–2×/wk" },
  { overarchingGoal: "Running – short distance performance (400–800 m)", subGoal: "Speed reserve & maximal velocity", quality: "Step length", trainingMethod: "Acceleration buildups 6–10 × 30–60 m, 1–2×/wk" },

  { overarchingGoal: "Running – short distance performance (400–800 m)", subGoal: "Anaerobic capacity & glycolytic power", quality: "Glycolytic enzyme activity", trainingMethod: "Special endurance I: 3–5 × 200–300 m @ 93–97%, 1×/wk; 6–12 min rest" },
  { overarchingGoal: "Running – short distance performance (400–800 m)", subGoal: "Anaerobic capacity & glycolytic power", quality: "Buffering capacity", trainingMethod: "Sets of 3–4 × 150–200 m with 2–3 min rest, 1×/wk" },

  { overarchingGoal: "Running – middle distance performance (1500–5000 m)", subGoal: "Aerobic power (VO2max)", quality: "Cardiac output", trainingMethod: "VO2max intervals 5 × 3 min or 6 × 2 min @ 95–100% vVO2max, 1–2×/wk" },
  { overarchingGoal: "Running – middle distance performance (1500–5000 m)", subGoal: "Aerobic power (VO2max)", quality: "Capillarization", trainingMethod: "Z2 volume 30–90 min, 2–4×/wk" },
  { overarchingGoal: "Running – middle distance performance (1500–5000 m)", subGoal: "Aerobic power (VO2max)", quality: "Mitochondrial density", trainingMethod: "Tempo 20–40 min @ LT, 1–2×/wk" },

  // Throwing goals
  { overarchingGoal: "Increasing throwing ability", subGoal: "Release speed", quality: "Proximal-to-distal sequencing", trainingMethod: "Med-ball scoop/rotational throws 6–10 × 2–3, 2–3×/wk; full intent, 2–3 min rest" },
  { overarchingGoal: "Increasing throwing ability", subGoal: "Release speed", quality: "Trunk rotational power", trainingMethod: "Heavy rotational MB (3–6 kg) 4–6 × 3–5, 2×/wk; add cable chops 3–4 × 6–10" },
  { overarchingGoal: "Increasing throwing ability", subGoal: "Release speed", quality: "Hip–shoulder separation", trainingMethod: "Separation drills with bands 3–4 × 6–10, 2×/wk; cue delayed upper-body" },

  { overarchingGoal: "Increasing throwing ability", subGoal: "Accuracy/consistency", quality: "Motor control under speed", trainingMethod: "Submax to max target throws 5–8 × 5–8/wk; constrain to hit zones" },
  { overarchingGoal: "Increasing throwing ability", subGoal: "Accuracy/consistency", quality: "Visual targeting", trainingMethod: "Quiet eye drills 2–3 × 5–8 min, 2×/wk; integrate into target throws" },

  // Olympic Weightlifting goals
  { overarchingGoal: "Improving Olympic weightlifting performance", subGoal: "Snatch total", quality: "Second-pull power", trainingMethod: "Snatch pulls 4–6 × 2–3 @ 90–110% of snatch, 2×/wk" },
  { overarchingGoal: "Improving Olympic weightlifting performance", subGoal: "Snatch total", quality: "Pull-under speed", trainingMethod: "Tall snatch/snatch balance 5–8 × 2–3 light–moderate, 2–3×/wk" },
  { overarchingGoal: "Improving Olympic weightlifting performance", subGoal: "Snatch total", quality: "Overhead mobility", trainingMethod: "Thoracic/shoulder ER mobility 3 × 30–45 s, 3×/wk" },

  { overarchingGoal: "Improving Olympic weightlifting performance", subGoal: "Clean & jerk total", quality: "First-pull strength", trainingMethod: "Clean deadlift 3–5 × 3–5 @ 90–110% clean, 2×/wk" },
  { overarchingGoal: "Improving Olympic weightlifting performance", subGoal: "Clean & jerk total", quality: "Front squat strength", trainingMethod: "Front squat 3–5 × 2–5 @ 80–92% 1RM, 2×/wk" },

  // Sport-specific endurance goals
  { overarchingGoal: "Football-specific endurance (American football)", subGoal: "Drive-to-drive repeatability", quality: "Alactic power", trainingMethod: "10–12 × 5–10 s position sprints, 2×/wk; full rest 2–3 min" },
  { overarchingGoal: "Football-specific endurance (American football)", subGoal: "Drive-to-drive repeatability", quality: "Aerobic recovery", trainingMethod: "Tempo runs 8–12 × 100–150 m @ 70–75% with 45–60 s rest, 2×/wk" },

  { overarchingGoal: "Soccer-specific endurance", subGoal: "High-speed running exposure", quality: "Aerobic power", trainingMethod: "4 × 4 min @ 90–95% HRmax, 1×/wk" },
  { overarchingGoal: "Soccer-specific endurance", subGoal: "High-speed running exposure", quality: "Speed reserve", trainingMethod: "Fly 20–30 m 4–8 reps, 1×/wk" },

  { overarchingGoal: "Rugby-specific endurance", subGoal: "Repeat-effort ability (collision + sprint)", quality: "Aerobic recovery", trainingMethod: "SSG/collision games 4–6 × 2–4 min, 2×/wk" },
  { overarchingGoal: "Rugby-specific endurance", subGoal: "Repeat-effort ability (collision + sprint)", quality: "Alactic power", trainingMethod: "10–12 × 5–10 s sprints, 2×/wk" },

  { overarchingGoal: "Basketball-specific endurance", subGoal: "Transition play repeatability", quality: "Repeated sprint ability with COD", trainingMethod: "Court shuttles 10–20 m 3–4 sets × 6–10 reps, 2×/wk" },

  // Core/trunk strength goals
  { overarchingGoal: "Improving core/trunk strength", subGoal: "Anti-extension capacity", quality: "Isometric trunk torque", trainingMethod: "Front/ab wheel planks 3–5 × 20–40 s, 2–3×/wk" },
  { overarchingGoal: "Improving core/trunk strength", subGoal: "Anti-extension capacity", quality: "Ribcage–pelvis alignment", trainingMethod: "90/90 breathing + dead bug 3–4 × 6–10, 3×/wk" },
  { overarchingGoal: "Improving core/trunk strength", subGoal: "Anti-rotation capacity", quality: "Oblique strength", trainingMethod: "Pallof press 3–4 × 8–12/side, 2–3×/wk" },
  { overarchingGoal: "Improving core/trunk strength", subGoal: "Rotational power", quality: "Hip–shoulder separation", trainingMethod: "MB rotational throws 4–6 × 3–5, 2×/wk" },

  // Jumping ability goals
  { overarchingGoal: "Improving dunking ability (basketball)", subGoal: "Approach speed & rhythm", quality: "Curvilinear approach running", trainingMethod: "Approach runs with curve 6–10 reps @80–90%, 2×/wk" },
  { overarchingGoal: "Improving dunking ability (basketball)", subGoal: "Take-off reactive strength", quality: "Reactive strength index (RSI)", trainingMethod: "Drop/bounce jumps 4–6 × 5–8 (20–40 cm), 2×/wk" },
  { overarchingGoal: "Improving dunking ability (basketball)", subGoal: "Hip–knee power at take-off", quality: "Rate of force development", trainingMethod: "Max-intent isometrics 3–6 × 3–5 s + loaded jumps 20–40% 1RM 4–6 × 3–5, 2×/wk" },

  { overarchingGoal: "Improving high jump ability", subGoal: "Approach curve & speed", quality: "Curve running technique", trainingMethod: "Curvilinear approaches 6–10 reps @80–90%, 2×/wk" },
  { overarchingGoal: "Improving high jump ability", subGoal: "Take-off power & stiffness", quality: "Rate of force development", trainingMethod: "IMTP/split-squat isos 4–6 × 3–5 s, 2×/wk" },

  { overarchingGoal: "Improving long jump ability", subGoal: "Approach speed & accuracy", quality: "Max velocity reserve", trainingMethod: "Fly 20–30 m 4–8 reps, 2×/wk" },
  { overarchingGoal: "Improving long jump ability", subGoal: "Take-off conversion (horizontal→vertical)", quality: "Penultimate step preparation", trainingMethod: "Penultimate drop-ins 6–10 jumps, 2×/wk" },

  { overarchingGoal: "Improving triple jump ability", subGoal: "Phase distribution (hop–step–jump)", quality: "Leg stiffness modulation", trainingMethod: "Bounce series 4–6 × 20–30 m, 2–3×/wk" },
  { overarchingGoal: "Improving triple jump ability", subGoal: "Ground contact quality in each phase", quality: "Short ground contact with adequate impulse", trainingMethod: "Drop jumps 4–6 × 5–8 (20–40 cm), 2×/wk; aim tc < 200 ms" },

  // Cycling goals
  { overarchingGoal: "Cycling – short distance performance (1–4 min)", subGoal: "Peak aerobic power & W′", quality: "VO2 kinetics", trainingMethod: "30/15s × 10–20 @ MAP, 1–2×/wk" },
  { overarchingGoal: "Cycling – short distance performance (1–4 min)", subGoal: "Seated/standing torque at high power", quality: "Hip extensor strength", trainingMethod: "Heavy RT (deadlift/squat) 3–5 × 3–6 @ 80–90% 1RM, 2×/wk" },

  { overarchingGoal: "Cycling – middle distance performance (4–40 min)", subGoal: "Functional threshold/critical power", quality: "Mitochondrial respiration", trainingMethod: "2 × 20 min or 3 × 12–15 min @ 95–100% FTP, 2–3×/wk" },
  { overarchingGoal: "Cycling – long distance performance (≥40 min)", subGoal: "Endurance & durability", quality: "Fat oxidation", trainingMethod: "Z2 rides 60–180 min, 2–4×/wk; occasional 'low glycogen' (advanced)" },

  // Swimming goals
  { overarchingGoal: "Swimming – short distance performance (50–200 m)", subGoal: "Start & turn speed", quality: "Block reaction time", trainingMethod: "Start drills 8–12 reps with full recovery, 2–3×/wk" },
  { overarchingGoal: "Swimming – short distance performance (50–200 m)", subGoal: "Stroke rate × length at high speed", quality: "Upper-limb power", trainingMethod: "Power paddles 8–12 × 25 m @ fast, 2×/wk" },

  { overarchingGoal: "Swimming – middle distance performance (200–800 m)", subGoal: "Aerobic power & VO2 kinetics", quality: "Stroke-specific economy", trainingMethod: "Pull buoy/paddles aerobic sets 20–40 min, 2×/wk" },
  { overarchingGoal: "Swimming – long distance performance (≥1500 m/open water)", subGoal: "Economy & durability", quality: "Technique stability", trainingMethod: "Long aerobic continuous 30–60 min with form cues, 2–3×/wk" },
];

// Helper functions to get unique values
export const getUniqueOverarchingGoals = (): string[] => {
  return Array.from(new Set(trainingData.map(item => item.overarchingGoal))).sort();
};

export const getUniqueSubGoals = (): string[] => {
  return Array.from(new Set(trainingData.map(item => `${item.overarchingGoal} - ${item.subGoal}`))).sort();
};

export const getUniqueQualities = (): string[] => {
  return Array.from(new Set(trainingData.map(item => item.quality))).sort();
};

export const getUniqueTrainingMethods = (): string[] => {
  return Array.from(new Set(trainingData.map(item => item.trainingMethod))).sort();
};

// Helper functions to get filtered data based on selections
export const getSubGoalsForOverarchingGoal = (overarchingGoal: string): string[] => {
  return Array.from(new Set(
    trainingData
      .filter(item => item.overarchingGoal === overarchingGoal)
      .map(item => item.subGoal)
  )).sort();
};

export const getQualitiesForSubGoal = (subGoal: string): string[] => {
  return Array.from(new Set(
    trainingData
      .filter(item => item.subGoal === subGoal)
      .map(item => item.quality)
  )).sort();
};

export const getMethodsForQuality = (quality: string): string[] => {
  return Array.from(new Set(
    trainingData
      .filter(item => item.quality === quality)
      .map(item => item.trainingMethod)
  )).sort();
};