/**
 * pseudonymize — no athlete names reach an AI provider (GDPR: data minimisation; promised in the
 * privacy notice and the anamnesis consent: "AI-assisted summary without my name").
 *
 * Every AI request goes through anthropicApi's proxy call (and ragPipeline's embeddings call).
 * Before sending, each known athlete name in the prompt and messages is replaced by a label
 * ("Athlete A", "Athlete B", …) — the AI still tells athletes apart; the reply is mapped back, so
 * the coach sees real names in the app. Known names come from the coach's athlete database
 * (kept current by useAthletes; loaded on demand if an AI call comes first).
 */
import { supabase } from '@/lib/supabase';

interface NameEntry {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
}

interface Mapping {
  /** Real-name patterns → label, longest first */
  forward: Array<{ re: RegExp; label: string }>;
  /** label → the athlete's display name, for mapping replies back */
  backward: Array<{ re: RegExp; name: string }>;
}

let entries: NameEntry[] | null = null;
let mapping: Mapping | null = null;
let loading: Promise<void> | null = null;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole words only (letters of any script), case-sensitive — "Mark" the name, not "mark" the word */
const wordRe = (phrase: string) => new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, 'gu');

function labelFor(i: number): string {
  // A … Z, then AA, AB, …
  let n = i;
  let s = '';
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return `Athlete ${s}`;
}

function buildMapping(list: NameEntry[]): Mapping {
  const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
  const forward: Array<{ phrase: string; label: string }> = [];
  const backward: Array<{ re: RegExp; name: string }> = [];
  sorted.forEach((a, i) => {
    const label = labelFor(i);
    const first = a.firstName?.trim() ?? '';
    const middle = a.middleName?.trim() ?? '';
    const last = a.lastName?.trim() ?? '';
    const full = [first, last].filter(Boolean).join(' ');
    const phrases = new Set<string>();
    if (first && middle && last) phrases.add(`${first} ${middle} ${last}`);
    if (first && last) { phrases.add(`${first} ${last}`); phrases.add(`${last}, ${first}`); phrases.add(`${last} ${first}`); }
    // Single names only when long enough not to hit ordinary short words
    if (first.length >= 3) phrases.add(first);
    if (last.length >= 3) phrases.add(last);
    phrases.forEach(p => forward.push({ phrase: p, label }));
    if (full) backward.push({ re: wordRe(escapeRe(label)), name: full });
  });
  // Longest first, so "Anna Maria Schmidt" wins over "Anna"
  forward.sort((x, y) => y.phrase.length - x.phrase.length);
  return {
    forward: forward.map(f => ({ re: wordRe(escapeRe(f.phrase).replace(/ /g, '\\s+')), label: f.label })),
    // Longest label first, so "Athlete AB" is restored before "Athlete A"
    backward: backward.sort((x, y) => y.re.source.length - x.re.source.length),
  };
}

/** Keep the known names current (called by useAthletes whenever the athlete list changes) */
export function setAthleteNamesForAI(list: NameEntry[]): void {
  entries = list.filter(a => a.firstName || a.lastName);
  mapping = buildMapping(entries);
}

/** Load the names if no page has provided them yet */
export async function ensureAthleteNamesLoaded(): Promise<void> {
  if (entries) return;
  if (!loading) {
    loading = (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('athlete_database').select('data').eq('user_id', user.id).maybeSingle();
      const athletes = ((data?.data as { athletes?: NameEntry[] } | null)?.athletes) ?? [];
      if (!entries) setAthleteNamesForAI(athletes);
    })().finally(() => { loading = null; });
  }
  await loading;
}

/** Real names → labels */
export function pseudonymizeText(text: string): string {
  if (!mapping || !text) return text;
  let out = text;
  for (const { re, label } of mapping.forward) out = out.replace(re, label);
  return out;
}

/** Labels → real names (for replies shown in the app) */
export function restoreNames(text: string): string {
  if (!mapping || !text) return text;
  let out = text;
  for (const { re, name } of mapping.backward) out = out.replace(re, name);
  return out;
}

type Block = { type?: string; text?: string; [k: string]: unknown };
type Message = { role: string; content: string | Block[] };

const scrubBlocks = (blocks: Block[]): Block[] =>
  blocks.map(b => (b && b.type === 'text' && typeof b.text === 'string' ? { ...b, text: pseudonymizeText(b.text) } : b));

/** A Messages API request body with every text part pseudonymized (images/documents untouched) */
export function pseudonymizeRequest(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  if (typeof body.system === 'string') out.system = pseudonymizeText(body.system);
  else if (Array.isArray(body.system)) out.system = scrubBlocks(body.system as Block[]);
  if (Array.isArray(body.messages)) {
    out.messages = (body.messages as Message[]).map(m => ({
      ...m,
      content: typeof m.content === 'string' ? pseudonymizeText(m.content) : Array.isArray(m.content) ? scrubBlocks(m.content) : m.content,
    }));
  }
  return out;
}
