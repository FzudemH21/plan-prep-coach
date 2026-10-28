/**
 * planStrategy — the plan's strategy document (stored as `planNotes` in the macrocycle data, shared by
 * every wizard step). It is free-form Markdown that grows out of the conversation with the AI: the
 * chat is the brainstorming, the document the result. When the AI replaces the document, the text
 * before is kept as a version (`planNotesHistory`, newest first) so a rewrite can be undone.
 */

export interface PlanNotesVersion {
  text: string;
  /** ISO time the version was put aside */
  savedAt: string;
  /** Why it was put aside: the AI rewrote the document, or an older version was restored */
  reason: 'ai-rewrite' | 'restore';
}

const MAX_VERSIONS = 20;

/** Older plans have no history (or something unreadable) */
export function readNotesHistory(value: unknown): PlanNotesVersion[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is PlanNotesVersion => !!v && typeof v.text === 'string' && typeof v.savedAt === 'string');
}

/** Puts `previous` aside as a version (not when empty or the same as the newest version) */
export function withNotesVersion(history: PlanNotesVersion[] | undefined, previous: string, reason: PlanNotesVersion['reason']): PlanNotesVersion[] {
  const list = readNotesHistory(history);
  if (!previous.trim() || list[0]?.text === previous) return list;
  return [{ text: previous, savedAt: new Date().toISOString(), reason }, ...list].slice(0, MAX_VERSIONS);
}

/** The AI's set_plan_notes action: append adds a line, replace rewrites (the old text becomes a version) */
export function applyNotesAction(
  notes: string, history: PlanNotesVersion[] | undefined, action: { notes: string; mode?: 'append' | 'replace' },
): { notes: string; history: PlanNotesVersion[] } {
  if (action.mode === 'replace') {
    return { notes: action.notes, history: withNotesVersion(history, notes, 'ai-rewrite') };
  }
  return { notes: [notes, action.notes].filter(Boolean).join('\n'), history: readNotesHistory(history) };
}

/** Restoring an older version keeps the current text as a version too */
export function restoreNotesVersion(notes: string, history: PlanNotesVersion[] | undefined, version: PlanNotesVersion): { notes: string; history: PlanNotesVersion[] } {
  return { notes: version.text, history: withNotesVersion(history, notes, 'restore') };
}

/** What "Write up from our conversation" sends to the AI chat */
export const WRITE_UP_PROMPT =
  'Please write up the plan strategy from our conversation so far: condense what we discussed and decided — together with the current '
  + 'strategy document and the plan data — into ONE clean strategy document. Choose headings that fit the content (no fixed template), '
  + 'bullet points, **bold** for key decisions, numbers and criteria. Only what we discussed, decided or what is in the plan — nothing new '
  + 'of your own; mark points that are still open as open. Keep the language we have been using. Then apply it with set_plan_notes '
  + 'mode "replace" (the previous version is kept and can be restored).';

/** The document as context for the AI on every wizard page */
export function strategyContext(notes: string | undefined): string {
  return notes?.trim()
    ? `Plan strategy document (free-form, written by the coach together with you — the goals, reasoning, phases and criteria agreed so far; build on it, keep it consistent):\n${notes.trim()}`
    : '';
}
