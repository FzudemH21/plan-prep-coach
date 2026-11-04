/**
 * coachSettings — small per-coach settings shared by all the coach's devices (desktop + coach
 * mobile), in Supabase `coach_settings` (one row per coach: { data: { <key>: value } }).
 * Migration: supabase/migrations/20261104_coach_settings.sql. Without it (table missing) reads
 * return undefined and writes do nothing — callers keep their own local copy, as before.
 */
import { supabase } from '@/lib/supabase';

const TABLE = 'coach_settings';
let tableMissing = false;

function noteError(message: string) {
  if (/coach_settings|does not exist|schema cache/i.test(message)) {
    if (!tableMissing) console.warn('[coachSettings] table missing — run the migration 20261104_coach_settings.sql; settings stay on this device until then');
    tableMissing = true;
  } else {
    console.error('[coachSettings]', message);
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function readRow(uid: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from(TABLE).select('data').eq('coach_user_id', uid).maybeSingle();
  if (error) { noteError(error.message); return null; }
  return ((data as { data?: Record<string, unknown> } | null)?.data) ?? {};
}

/** One setting of the signed-in coach (undefined: not set, or no table / not signed in) */
export async function readCoachSetting<T>(key: string): Promise<T | undefined> {
  if (tableMissing) return undefined;
  const uid = await currentUserId();
  if (!uid) return undefined;
  const row = await readRow(uid);
  return (row?.[key] as T | undefined) ?? undefined;
}

/** Changes one setting from its current server value (the other settings in the row are kept) */
export async function updateCoachSetting<T>(key: string, update: (current: T | undefined) => T): Promise<void> {
  if (tableMissing) return;
  const uid = await currentUserId();
  if (!uid) return;
  const row = await readRow(uid);
  if (row === null) return; // read failed — never write over what we couldn't read
  const { error } = await supabase.from(TABLE).upsert(
    { coach_user_id: uid, data: { ...row, [key]: update(row[key] as T | undefined) }, updated_at: new Date().toISOString() },
    { onConflict: 'coach_user_id' },
  );
  if (error) noteError(error.message);
}
