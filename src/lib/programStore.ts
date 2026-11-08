/**
 * Training programs: one Supabase row per program (table program_records, see
 * supabase/migrations/20261108_program_records.sql).
 *
 * Until 2026-11 all programs of a coach shared ONE row (training_programs.data = { programs: [...] }).
 * Every save rewrote all of them (~2 MB), loads started to time out, and one bad save could take
 * every program with it (2026-11-01). Now a save writes only the program that changed.
 *
 * The old shared row stays untouched as a frozen backup. It is still read when it changed since this
 * browser last looked (a tab running the old code may still write it): of every program in it, the
 * newer version wins and is copied into its own row. The first load copies everything over.
 *
 * Before the SQL has been run (table missing), everything works as before on the shared row
 * ("legacy" mode), so deploying this never depends on the migration having run.
 *
 * Safety rules (see feedback-data-safety):
 * - nothing is saved before the programs have really been loaded (a failed load blocks saving)
 * - a save writes one program; it can't drop any other program
 * - saves of the same program run one after another, the newest last (no older version can land
 *   after a newer one)
 * - deleting keeps the program's row with a deletion mark, so it can always be brought back
 */
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type { TrainingProgram } from '@/hooks/useTrainingPrograms';

const TABLE = 'program_records';
const LEGACY_TABLE = 'training_programs';
/** Newest change of the old shared row this browser has already copied over (per coach) */
const legacySeenKey = (userId: string) => `programRecordsLegacySeen_${userId}`;
const LOAD_ATTEMPTS = 3;
/** Programs fetched at the same time while loading (each is one request) */
const PARALLEL_FETCHES = 4;

export type ProgramStoreStatus = 'idle' | 'loading' | 'loaded' | 'failed';

export interface ProgramStoreState {
  userId: string | null;
  status: ProgramStoreStatus;
  /** 'rows': one row per program. 'legacy': the old shared row (SQL not run yet) */
  mode: 'rows' | 'legacy';
  programs: TrainingProgram[];
  /** Programs deleted on purpose: id → when */
  deleted: Record<string, string>;
}

/** Thrown by a save before the programs were loaded — nothing was saved */
export class ProgramsNotLoadedError extends Error {
  constructor() {
    super('Your programs have not been loaded yet — nothing was saved');
    this.name = 'ProgramsNotLoadedError';
  }
}

interface LegacyData {
  version?: number;
  programs?: TrainingProgram[];
  deletedProgramIds?: string[];
}

let state: ProgramStoreState = { userId: null, status: 'idle', mode: 'rows', programs: [], deleted: {} };
const listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;

function setState(next: Partial<ProgramStoreState>) {
  state = { ...state, ...next };
  listeners.forEach(fn => fn());
}

export function getProgramStoreState(): ProgramStoreState {
  return state;
}

export function subscribeProgramStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// As times, not text: the database returns "…+00:00" (and may drop trailing zeros), the app "…Z"
const time = (s: string | null | undefined) => {
  const t = s ? Date.parse(s) : NaN;
  return Number.isNaN(t) ? 0 : t;
};
const newer = (a: string | null | undefined, b: string | null | undefined) => time(a) > time(b);

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /program_records/.test(error.message ?? '') && /not find|does not exist/i.test(error.message ?? '');
}

async function withRetries<T>(what: string, run: () => Promise<{ data: T; error: { code?: string; message?: string } | null }>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await run();
    if (!error) return data;
    if (isMissingTable(error)) throw error; // SQL not run yet — expected, handled by the caller
    console.error(`[programStore] ${what} failed (attempt ${attempt}):`, error);
    if (attempt >= LOAD_ATTEMPTS) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
}

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...await Promise.all(items.slice(i, i + size).map(run)));
  }
  return results;
}

let loadFailedWarned = false;
function warnLoadFailed() {
  if (loadFailedWarned) return;
  loadFailedWarned = true;
  toast({
    title: 'Your programs could not be loaded',
    description: 'Changes to programs cannot be saved right now, so nothing gets overwritten. Check the connection and reload the page.',
    variant: 'destructive',
    duration: 15000,
  });
}

let notLoadedWarnedAt = 0;
function warnNotLoaded() {
  if (Date.now() - notLoadedWarnedAt < 5000) return;
  notLoadedWarnedAt = Date.now();
  toast({ title: 'Still loading your programs', description: 'This change was not saved — please try again in a moment.', variant: 'destructive' });
}

// ─── Writing rows ─────────────────────────────────────────────────────────────

function rowFor(userId: string, program: TrainingProgram, deletedAt: string | null = null) {
  return {
    coach_user_id: userId,
    id: program.id,
    data: program,
    last_modified_at: program.lastModifiedAt || null,
    deleted_at: deletedAt,
    updated_at: new Date().toISOString(),
  };
}

async function writeRow(userId: string, program: TrainingProgram, deletedAt: string | null): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(rowFor(userId, program, deletedAt), { onConflict: 'coach_user_id,id' });
  if (error) throw error;
}

// Per program: the version waiting to be written. A program's writes run one after another and
// only its newest version is written — an older one can never land after a newer one.
const queued = new Map<string, { program: TrainingProgram; deletedAt: string | null; waiters: Array<{ resolve: () => void; reject: (e: unknown) => void }> }>();
const writing = new Set<string>();

function queueWrite(userId: string, program: TrainingProgram, deletedAt: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const entry = queued.get(program.id);
    if (entry) {
      entry.program = program;
      entry.deletedAt = deletedAt;
      entry.waiters.push({ resolve, reject });
    } else {
      queued.set(program.id, { program, deletedAt, waiters: [{ resolve, reject }] });
    }
    void drain(userId, program.id);
  });
}

async function drain(userId: string, id: string) {
  if (writing.has(id)) return;
  writing.add(id);
  try {
    for (let entry = queued.get(id); entry; entry = queued.get(id)) {
      queued.delete(id);
      try {
        try {
          await writeRow(userId, entry.program, entry.deletedAt);
        } catch {
          await new Promise(resolve => setTimeout(resolve, 1500));
          await writeRow(userId, entry.program, entry.deletedAt); // one retry (e.g. a network hiccup)
        }
        entry.waiters.forEach(w => w.resolve());
      } catch (err) {
        console.error('[programStore] save failed:', err);
        entry.waiters.forEach(w => w.reject(err));
      }
    }
  } finally {
    writing.delete(id);
  }
}

// Legacy mode: the whole list in the old shared row, written one save at a time
let legacyChain: Promise<void> = Promise.resolve();
function writeLegacy(userId: string): Promise<void> {
  const run = async () => {
    const data: LegacyData = { version: 1, programs: state.programs, deletedProgramIds: Object.keys(state.deleted) };
    const { error } = await supabase.from(LEGACY_TABLE)
      .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
  };
  const next = legacyChain.then(run, run);
  legacyChain = next.catch(() => {});
  return next;
}

// ─── Loading ──────────────────────────────────────────────────────────────────

async function readLegacy(userId: string): Promise<LegacyData | null> {
  const row = await withRetries('loading the old program list', async () =>
    await supabase.from(LEGACY_TABLE).select('data').eq('user_id', userId).maybeSingle());
  return (row?.data as LegacyData | undefined) ?? null;
}

async function loadLegacyMode(userId: string) {
  const legacy = await readLegacy(userId);
  const deletedIds = legacy?.deletedProgramIds ?? [];
  setState({
    mode: 'legacy',
    status: 'loaded',
    programs: (legacy?.programs ?? []).filter(p => p?.id && !deletedIds.includes(p.id)),
    deleted: Object.fromEntries(deletedIds.map(id => [id, ''])),
  });
}

async function loadRowsMode(userId: string): Promise<boolean> {
  type Meta = { id: string; last_modified_at: string | null; deleted_at: string | null };
  let metas: Meta[];
  try {
    metas = await withRetries('loading the program list', async () =>
      await supabase.from(TABLE).select('id, last_modified_at, deleted_at').eq('coach_user_id', userId)) as Meta[];
  } catch (err) {
    if (isMissingTable(err as { code?: string; message?: string })) return false; // SQL not run yet
    throw err;
  }

  const live = metas.filter(m => !m.deleted_at);
  const loaded = await inBatches(live, PARALLEL_FETCHES, async meta => {
    const row = await withRetries(`loading program ${meta.id}`, async () =>
      await supabase.from(TABLE).select('data').eq('coach_user_id', userId).eq('id', meta.id).single());
    return (row as { data: TrainingProgram }).data;
  });
  const byId = new Map<string, TrainingProgram>(loaded.filter(p => p?.id).map(p => [p.id, p]));
  const deleted: Record<string, string> = Object.fromEntries(metas.filter(m => m.deleted_at).map(m => [m.id, m.deleted_at as string]));
  const metaById = new Map(metas.map(m => [m.id, m]));

  // The old shared row: copy over what is newer there (all of it on the first load)
  const legacyMeta = await withRetries('checking the old program list', async () =>
    await supabase.from(LEGACY_TABLE).select('updated_at').eq('user_id', userId).maybeSingle()) as { updated_at: string | null } | null;
  const legacyChangedAt = legacyMeta?.updated_at ?? '';
  let seen = '';
  try { seen = localStorage.getItem(legacySeenKey(userId)) ?? ''; } catch { /* no browser storage */ }

  if (legacyMeta && (metas.length === 0 || newer(legacyChangedAt, seen))) {
    // Must succeed on the first copy: without it the list would be empty (saving stays blocked)
    const legacy = await readLegacy(userId);
    const legacyDeleted = new Set(legacy?.deletedProgramIds ?? []);
    const toCopy: TrainingProgram[] = [];
    (legacy?.programs ?? []).forEach(p => {
      if (!p?.id) return;
      const meta = metaById.get(p.id);
      if (!meta && legacyDeleted.has(p.id)) return;
      if (meta?.deleted_at && !newer(p.lastModifiedAt, meta.deleted_at)) return; // deleted since
      if (meta && !meta.deleted_at && !newer(p.lastModifiedAt, meta.last_modified_at)) return; // row is as new
      toCopy.push(p);
    });
    const results = await inBatches(toCopy, PARALLEL_FETCHES, async p => {
      try { await writeRow(userId, p, null); return true; } catch (err) { console.error('[programStore] copy failed:', p.id, err); return false; }
    });
    toCopy.forEach(p => { byId.set(p.id, p); delete deleted[p.id]; });
    if (toCopy.length > 0) console.info(`[programStore] copied ${toCopy.length} program(s) from the old program list`);
    // Only remembered when everything got copied — otherwise the next load tries again
    if (results.every(Boolean)) {
      try { localStorage.setItem(legacySeenKey(userId), legacyChangedAt); } catch { /* fine, copied again next time */ }
    }
  }

  // The old browser copy of the whole list doesn't fit any more and isn't used
  try { localStorage.removeItem('trainingPrograms_sb_cache'); } catch { /* ignore */ }
  setState({ mode: 'rows', status: 'loaded', programs: [...byId.values()], deleted });
  return true;
}

/** Loads the coach's programs once per tab (again after a failed load) */
export function ensureProgramsLoaded(userId: string): Promise<void> {
  if (state.userId !== userId) {
    state = { userId, status: 'idle', mode: 'rows', programs: [], deleted: {} };
    loadPromise = null;
  }
  if (state.status === 'loaded') return Promise.resolve();
  if (loadPromise) return loadPromise;
  setState({ status: 'loading' });
  loadPromise = (async () => {
    try {
      const rows = await loadRowsMode(userId);
      if (!rows) await loadLegacyMode(userId);
    } catch (err) {
      console.error('[programStore] load failed:', err);
      if (state.userId === userId) setState({ status: 'failed' });
      warnLoadFailed();
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

/** Logged out: forget the programs */
export function resetProgramStore() {
  state = { userId: null, status: 'idle', mode: 'rows', programs: [], deleted: {} };
  loadPromise = null;
  listeners.forEach(fn => fn());
}

// ─── Changing programs ────────────────────────────────────────────────────────

function requireLoaded(): string {
  if (!state.userId || state.status !== 'loaded') {
    warnNotLoaded();
    throw new ProgramsNotLoadedError();
  }
  return state.userId;
}

/** Saves (adds or replaces) programs. The list in this tab updates at once; resolves when stored. */
export async function putPrograms(programs: TrainingProgram[]): Promise<void> {
  if (programs.length === 0) return;
  const userId = requireLoaded();
  const ids = new Set(programs.map(p => p.id));
  const deleted = { ...state.deleted };
  programs.forEach(p => { delete deleted[p.id]; });
  setState({ programs: [...state.programs.filter(p => !ids.has(p.id)), ...programs], deleted });
  if (state.mode === 'legacy') return writeLegacy(userId);
  await Promise.all(programs.map(p => queueWrite(userId, p, null)));
}

/** Deletes a program on purpose — its row stays, marked as deleted, so it can be brought back */
export async function markProgramDeleted(id: string): Promise<void> {
  const userId = requireLoaded();
  const program = state.programs.find(p => p.id === id);
  if (!program) return;
  const deletedAt = new Date().toISOString();
  setState({ programs: state.programs.filter(p => p.id !== id), deleted: { ...state.deleted, [id]: deletedAt } });
  if (state.mode === 'legacy') return writeLegacy(userId);
  await queueWrite(userId, program, deletedAt);
}

/** Changes every program the updater changes (returns the same object when nothing changed) */
export async function updateAllPrograms(updater: (program: TrainingProgram) => TrainingProgram): Promise<number> {
  if (!state.userId || state.status !== 'loaded') {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return 0;
    await ensureProgramsLoaded(data.user.id);
  }
  if (state.status !== 'loaded') throw new ProgramsNotLoadedError();
  const changed = state.programs.map(updater).filter((next, i) => next !== state.programs[i]);
  await putPrograms(changed);
  return changed.length;
}
