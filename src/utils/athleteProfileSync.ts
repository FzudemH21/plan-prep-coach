/**
 * Coach-side profile changes → the athlete-app copy of the profile (athlete_connections.profile_data).
 *
 * The athlete database copies profile_data back onto the coach's athlete record on every load (so
 * edits the athlete makes in the app show up for the coach). A coach change that only reached the
 * coach's record was therefore undone on the next load — e.g. "Apply to profile" from an anamnesis
 * form, or the profile edit in the coach mobile app. Every coach-side profile change goes through
 * here: only the changed fields are written, on top of the CURRENT profile_data read from Supabase
 * (a copy held in the page can be outdated and would put old values back).
 */
import { supabase } from '@/lib/supabase';
import type { AthleteProfileData } from '@/hooks/useAthleteConnections';
import type { Athlete } from '@/types/athlete';

type AthleteUpdates = Partial<Omit<Athlete, 'id' | 'createdAt'>>;

/** The profile_data fields that a coach-side athlete update changes (empty when none) */
export function profileDataPatch(athlete: Athlete, updates: AthleteUpdates): Partial<AthleteProfileData> {
  const merged = { ...athlete, ...updates };
  const patch: Partial<AthleteProfileData> = {};
  if ('firstName' in updates) patch.firstName = merged.firstName ?? undefined;
  if ('middleName' in updates) patch.middleName = merged.middleName;
  if ('lastName' in updates) patch.lastName = merged.lastName ?? undefined;
  if ('birthday' in updates) patch.birthday = merged.birthday;
  if ('sex' in updates) patch.sex = merged.sex;
  if ('sports' in updates || 'sport' in updates) {
    patch.sports = merged.sports ?? (merged.sport ? [merged.sport] : []);
  }
  if ('team' in updates) patch.team = merged.team;
  if ('occupation' in updates) patch.occupation = merged.occupation;
  if ('dailyActivityLevel' in updates) patch.dailyActivityLevel = merged.dailyActivityLevel;
  return patch;
}

/**
 * Merges `patch` into a connection's profile_data as it is in Supabase right now and saves it.
 * profile_data holds the profile, monitoring config, chat switch, metrics snapshot and branding —
 * writing a whole copy kept in a page would put back whatever changed since that copy was loaded.
 */
export async function patchConnectionProfileData(
  connectionId: string,
  patch: Partial<AthleteProfileData>,
): Promise<AthleteProfileData> {
  const { data: row, error } = await supabase
    .from('athlete_connections')
    .select('profile_data')
    .eq('id', connectionId)
    .single();
  if (error) throw error;
  const profileData: AthleteProfileData = { ...((row.profile_data as AthleteProfileData | null) ?? {}), ...patch };
  const { error: upErr } = await supabase
    .from('athlete_connections')
    .update({ profile_data: profileData })
    .eq('id', connectionId);
  if (upErr) throw upErr;
  return profileData;
}

/**
 * Writes the changed profile fields into the athlete's app connection(s), if there are any.
 * Returns the updated connections with their new profile_data (empty when nothing was written).
 */
export async function syncAthleteProfileToApp(
  athlete: Athlete,
  updates: AthleteUpdates,
): Promise<Array<{ connectionId: string; profileData: AthleteProfileData }>> {
  const patch = profileDataPatch(athlete, updates);
  if (Object.keys(patch).length === 0) return [];

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return [];

  const { data: rows, error } = await supabase
    .from('athlete_connections')
    .select('id')
    .eq('coach_user_id', userId)
    .eq('athlete_local_id', athlete.id);
  if (error) throw error;

  const written: Array<{ connectionId: string; profileData: AthleteProfileData }> = [];
  for (const row of rows ?? []) {
    const connectionId = row.id as string;
    written.push({ connectionId, profileData: await patchConnectionProfileData(connectionId, patch) });
  }
  return written;
}
