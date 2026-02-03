
## What’s happening (root cause)

Even though `handleAdHocMethodSelected()` correctly creates **empty** exercise parameters (based on Toolbox + default Sets), those empty parameters are getting **overwritten immediately after** the exercise is added.

The overwrite happens because `WorkoutSessionSheet` has a sync effect that rebuilds `workoutSections` from:

- `exercises` (Step 1 / distribution list), and
- `parameterValues` (which still contains the **assigned program’s method periodization values**)

When you add an exercise, `onDistributionChange()` updates `exercises`, which triggers this effect:

- `buildSectionsFromExercises(exercises, parameterValues)` runs
- it finds periodization `storedParams` for that method (e.g. LBRT Strength)
- it rebuilds the exercise parameters using those values
- result: you see the same “method periodization table” values again

So the problem is not the ad-hoc dialog anymore; it’s the **rebuild logic** that assumes method periodization is the “source of truth”.

---

## Goal (your requirement)

For exercises added via the Toolbox/ad-hoc flow in Athlete Calendar:

- Always show a **blank parameter grid**
- Sets should exist as rows (default 3, and you can add/remove sets)
- No values should be pulled from the assigned program’s method periodization table, even if the method exists there

---

## Fix approach (high-level)

We need to stop the “rebuild from periodization” step from clobbering the just-created blank parameters.

### Key idea
When the sheet rebuilds from distribution, it must **preserve existing in-memory exercise.parameters** (the blank ones we just created) instead of regenerating them from `parameterValues`.

Optionally (recommended), we should also make the reopen behavior stable by preferring the saved `workoutSections_*` snapshot when available.

---

## Implementation plan (code changes)

### 1) Preserve exercise IDs when rebuilding (critical for matching)
In `buildSectionsFromExercises()`, exercises are currently created with IDs like:

- `id: \`${ex.exerciseId}-${index}\``

That breaks stable matching (and also makes it impossible to reliably preserve parameters).

Change it to:

- `id: ex.id || \`${ex.exerciseId}-${index}\``

This ensures that when `handleAdHocMethodSelected()` creates new exercises with stable IDs, the rebuild can recognize and reuse them.

**File**
- `src/components/microcycle-planning/WorkoutSessionSheet.tsx`

---

### 2) Merge rebuild results with existing `workoutSections` (prevents “empty → overwritten”)
Update the sync effect that currently does:

- `setWorkoutSections(buildSectionsFromExercises(exercises, parameterValues))`

Instead, rebuild and then merge/overlay by exercise ID:

- If an exercise already exists in current `workoutSections`, keep its:
  - `parameters`
  - `notes`, `eachSide`
  - `autoCalculateWeight`, `autoCalculateTargetHR`
  - any other per-exercise runtime state
- Only generate parameters for *brand new* exercises not present yet.

This guarantees:
- The blank params created in `handleAdHocMethodSelected()` survive the distribution sync
- Adding a second exercise won’t wipe edits you already made in the first one (this also fixes a subtle “unsaved edits get wiped when adding another exercise” bug)

**File**
- `src/components/microcycle-planning/WorkoutSessionSheet.tsx`

---

### 3) Stop periodization defaults from being applied to ad-hoc-added exercises (recommended for correctness on reopen)
Right now, if you close/reopen, the sheet can still rebuild from `parameterValues` and reintroduce periodization values.

To prevent that robustly, add a lightweight marker on distribution entries created by the ad-hoc flow, for example:

- `parameterSource?: 'toolbox' | 'periodization'`

Then:
- In `handleAdHocMethodSelected()`, set `parameterSource: 'toolbox'` on the new distribution entries
- In `buildSectionsFromExercises()`, if `parameterSource === 'toolbox'`, generate params as:
  - Sets = 3 (or Toolbox set parameter name)
  - other Toolbox parameters = `''`
  - per-set keys = `''`
  - never read from `parameterValues`

This ensures:
- Even after a full rebuild (or reopen), Toolbox-added exercises remain blank

**Files**
- `src/components/microcycle-planning/WorkoutSessionSheet.tsx`
- `src/types/microcycle-planning.ts` (extend `ExerciseDistribution`)
  - (and update any local `ExerciseDistribution` interfaces that shadow it)

---

### 4) (Optional but recommended) Prefer saved `workoutSections_*` on open in Athlete Calendar context
The sheet already saves `workoutSections_${mesocycleId}_${dayDate}_${sessionIndex}` on Save.

But initialization currently ignores it whenever `exercises.length > 0`.

For Athlete Calendar, this localStorage snapshot is the only reliable way to persist *per-exercise* parameter grids independent of method-periodization.

So, when opening the sheet:
- if `sectionsKey` exists in localStorage, load it
- merge with current `exercises` distribution (add/remove exercises as needed)

This makes the experience consistent across sessions and reloads.

**File**
- `src/components/microcycle-planning/WorkoutSessionSheet.tsx`

---

## How we’ll verify the fix (manual test checklist)

1) Athlete Calendar → “Add Session” → open session sheet  
2) Add exercise → pick a method that IS in the assigned program periodization table (e.g. LBRT Strength)  
3) Confirm in the grid:
   - Sets shows (default 3)
   - all parameter cells are blank
   - no prefilled “80% / 5 reps / etc” values appear
4) Add a second exercise after editing the first:
   - confirm the first exercise’s edited values did not get wiped
5) Save, close, reopen:
   - confirm the blank grid / your entered values persist
6) Try a method NOT in the periodization table:
   - confirm it behaves identically (blank grid)

---

## Expected outcome

- Toolbox-selected methods in Athlete Calendar no longer “inherit” periodization-table values from the assigned program.
- You always start with a clean, editable grid (Sets + blank per-set cells), and can add sets and fill values freely.

---

<lov-actions>
<lov-suggestion message="Test end-to-end: Athlete Calendar → Add Session → add an exercise → select a toolbox method that exists in the assigned program (e.g., LBRT Strength) and confirm the grid stays blank (no periodization values), then add a 2nd exercise and confirm the 1st exercise’s edits aren’t wiped.">Verify end-to-end behavior</lov-suggestion>
<lov-suggestion message="Fix parameter visibility overrides so the parameters checked/unchecked in the Ad-Hoc Method dialog are actually respected per exercise (and persist on save/reopen).">Make parameter visibility per-exercise</lov-suggestion>
<lov-suggestion message="Add an explicit 'Template session' vs 'Ad-hoc session' indicator in the UI (and store it), so it’s always clear when a session should pull defaults vs start blank.">Label ad-hoc sessions</lov-suggestion>
<lov-suggestion message="Persist per-exercise parameter values into the athlete-assignment snapshot (instead of relying on workoutSections_* localStorage), so everything is stored in one place and avoids cross-assignment collisions.">Unify persistence in assignment snapshot</lov-suggestion>
</lov-actions>
