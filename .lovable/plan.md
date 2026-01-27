
Problem
- Copying microcycle setups and copying mesocycle setups brings over the exercises/sections, but the superset links (SS1 badges / linked chain) disappear in the copied target.

What I found (root cause)
- In src/components/microcycle-planning/EnhancedExerciseDistribution.tsx, both copy handlers correctly build a “newSupersets” object and populate it with remapped exercise IDs and section IDs.
- But after doing that, both handlers then “clear target days” by deleting newSupersets[targetDate] for all target dates right before calling onSupersetsChange(...).
- That deletion step wipes out the supersets that were just copied, so the target ends up with no supersets even though the mapping logic itself is correct.

Scope of fix
- Fix both:
  - handleCopyFromPreviousMicrocycle (microcycle-to-microcycle copy)
  - handleCopyFromPreviousMesocycle (mesocycle-to-mesocycle copy)

Implementation approach
A) Microcycle copy (handleCopyFromPreviousMicrocycle)
1) Compute targetDates early (already available via targetDays).
2) Clear existing supersets for those targetDates BEFORE copying:
   - const newSupersets = { ...supersets };
   - targetDates.forEach(date => delete newSupersets[date]);
3) Run the existing “copy supersets” loop to populate newSupersets[targetDate] with remapped exercise IDs and (sectionId or __unsectioned__) keys.
4) Remove the later deletion block that currently runs after the copy loop (the one that deletes newSupersets[date] again).

Why this works
- It preserves the intent (“overwrite target’s supersets”) while not deleting the newly created superset mappings.

B) Mesocycle copy (handleCopyFromPreviousMesocycle)
1) Before starting the per-microcycle loop, determine all dates belonging to the target mesocycle (same logic currently used later via currentMesocycleDays + targetDates).
2) Clear existing supersets for those dates BEFORE copying:
   - const newSupersets: SupersetMapping = { ...supersets };
   - targetDates.forEach(date => delete newSupersets[date]);
3) Keep the existing “STEP 3: Copy supersets” loop (which fills newSupersets[targetDate] per day).
4) Remove the later deletion block that currently runs right before applying changes (it currently wipes out the freshly copied entries).

Testing checklist (what I will verify in the preview)
1) Microcycle copy test
- In a microcycle, create a section and two exercises in a superset (SS1 shows).
- Use “Copy from previous microcycle”.
- Confirm in the target microcycle:
  - SS1 badges appear on the copied exercises
  - the chain/linked behavior between exercises is preserved
  - unlinking/linking still works after copy

2) Mesocycle copy test
- In Mesocycle 1, create sections + supersets on Day 1/Day 2.
- Use “Copy mesocycle setup” to Mesocycle 2.
- Confirm in Mesocycle 2:
  - copied exercises remain in their sections
  - SS1 badges appear and represent the copied superset relationships
  - Step 2 (Training Calendar) also shows the same superset grouping for those sessions

3) Overwrite behavior
- If the target already had supersets, confirm they are replaced by the copied ones (not merged).

Files to change
- src/components/microcycle-planning/EnhancedExerciseDistribution.tsx
  - Adjust ordering/removal of “delete newSupersets[targetDate]” in:
    - handleCopyFromPreviousMicrocycle
    - handleCopyFromPreviousMesocycle

Optional follow-up (not required for this fix, but related)
- There are other copy/paste pathways (e.g., paste section/session/day/week in MicrocyclePlanningPage.tsx) where superset remapping rules are inconsistent. After this is fixed, we can unify those so supersets behave consistently across every copy/paste feature.
