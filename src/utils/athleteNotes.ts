/**
 * A test's note as the athlete sees it. The LSI goal of a goal per side is the coach's calculation
 * (smaller ÷ larger side), not a task for the athlete: since 2026-11-23 it is kept in the test's
 * coach-only `coachNote`; older tests still carry it in the note as "Goal: LSI …" — that part is
 * left out for the athlete.
 */
export function athleteVisibleNotes(notes: string | null | undefined): string | undefined {
  if (!notes) return undefined;
  const kept = notes
    .split(' · ')
    .filter(part => !/^\s*Goal: LSI\b/i.test(part))
    .join(' · ')
    .trim();
  return kept || undefined;
}
