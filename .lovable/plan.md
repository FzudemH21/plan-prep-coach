

### What’s actually going wrong (confirmed from the code)
There are **two separate bugs** causing the timeline (and sometimes the whole macrocycle UI) to “disappear” when moving forward/backward in the wizard:

1) **Macrocycle “Next → Mesocycle” overwrites `macrocycleData` with an incomplete object**
- `MacrocyclePage.tsx` has a continuous-save `useEffect` that correctly writes:
  - `planDuration`
  - `smartGoals` (plural)
  - legacy `smartGoal` (for backward compatibility)
- But when you click **“Move on to Mesocycle”** (or **“Continue Anyway”** in the missing rationale dialog), `handleNext` manually saves a *different, older shape* of `macrocycleData` that **omits `planDuration` and `smartGoals`**.
- That manual save happens **right before navigation**, so it overwrites the correct data and Mesocycle sees missing dates/goals → wrong timeline, wrong mesocycle count.

2) **Going “Back to Macrocycle” can send MacrocyclePage to an invalid step number**
- `MesocyclePage.tsx` sets `macrocycleStep` to **5** as a fallback:
  ```ts
  const targetStep = savedStep ? parseInt(savedStep) : 5;
  ```
- But `MacrocyclePage.tsx` has `totalSteps = 3` and only renders steps 1–3.
- Result: Macrocycle loads `currentStep = 5`, renders **no step content**, and it looks like “absolutely no data at all” even if `macrocycleData` still exists.

---

### Fix overview
We’ll make wizard navigation robust by:
- Ensuring the **final “save before navigate” uses the same full schema** as the continuous save (so `planDuration` + `smartGoals` are never dropped).
- Ensuring the **macrocycle step number is always valid (1–3)** when navigating back.

---

### Changes to implement

#### A) `src/pages/MacrocyclePage.tsx` — stop overwriting `macrocycleData` with a partial payload
1. Create a small helper (inside the component) like:
   - `buildMacrocycleDataSnapshot({ completedAt?: string })`
   - It will return the same shape as the continuous-save `useEffect`:
     - `planName`
     - `selectedAthleteId`
     - `planDuration`
     - `smartGoals`
     - `smartGoal` (legacy) = merged with `planDuration` dates (same logic already used in the `useEffect`)
     - `subGoals`, `events`, `qualities`, `qualitiesBySubGoal`, `methodsByQuality`, `selectedTest`, `selectedEvent`
     - `selectedMethods: Array.from(selectedMethods)`
     - `manuallyAddedMethods`
     - `completedAt` or `lastUpdated` (keep both if helpful; but do not remove existing fields other parts might rely on)

2. Update **both** manual save locations to use this helper:
   - In `handleNext` when `currentStep === totalSteps`
   - In the “Continue Anyway” handler in the Missing Rationales dialog
   This guarantees `planDuration` + `smartGoals` survive the transition.

#### B) `src/pages/MacrocyclePage.tsx` — clamp invalid saved step numbers
3. In the “load saved step from localStorage” `useEffect`, clamp the loaded step:
   - Parse int
   - If invalid or out of range, fallback to `1` (or `totalSteps`), and also rewrite `localStorage.macrocycleStep` to the corrected value.
   This prevents “Step 5 of 3” situations and blank rendering.

---

#### C) `src/pages/MesocyclePage.tsx` — fix the fallback “Back to Macrocycle” step
4. Change the fallback from `5` to a valid macrocycle step:
   - default to `3` (last macrocycle step) or `1` (start)
   - also clamp parsed values into `[1, 3]` before writing to localStorage
   This prevents Mesocycle from ever sending Macrocycle to a non-existent step.

---

### Why this will fix your symptoms
- Mesocycle will now always receive `macrocycleData.planDuration.startDate/endDate/totalWeeks`, so:
  - Training Plan Overview timeline will match what you set in Macrocycle
  - Suggested mesocycle count won’t incorrectly default to 12 weeks / today’s date
- Going back to Macrocycle will no longer land on a non-existent step, so the UI won’t appear empty.

---

### Testing checklist (what I’ll verify after implementation)
1. **Forward timeline persistence**
   - Set start/end dates in Macrocycle Step 1
   - Go to Mesocycle
   - Confirm Training Plan Overview shows the correct start/end + weeks/days
   - Confirm mesocycle count aligns with your plan duration

2. **Backward persistence**
   - From Mesocycle Step 1, click “Back to Macrocycle”
   - Confirm Macrocycle shows the correct step and all previous inputs (goals, methods, timeline)

3. **Missing rationale path**
   - Add a manually added method without rationale
   - Click “Move on to Mesocycle” → get warning → “Continue Anyway”
   - Confirm timeline/goals still persist correctly

---

### Files involved
- `src/pages/MacrocyclePage.tsx`
  - Fix manual save payloads (include `planDuration` + `smartGoals`)
  - Clamp invalid `macrocycleStep` on load
- `src/pages/MesocyclePage.tsx`
  - Fix “Back to Macrocycle” fallback step from 5 → 3 (and clamp to 1–3)

