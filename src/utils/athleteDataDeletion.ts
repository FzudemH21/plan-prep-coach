/**
 * athleteDataDeletion — removes everything stored in Supabase for an athlete when the coach deletes
 * them (GDPR erasure): anamnesis records and their files, and — per athlete-app connection — the
 * test-result photos/videos and chat files, then the connection itself (which cascades to the
 * schedule, session logs, test results, check-ins and chat messages in the database).
 *
 * Files go first: the storage policies that let the coach delete them check the connection row.
 * Needs migration 20261001_coach_delete_athlete_files for the file deletes.
 */
import { supabase } from '@/lib/supabase';
import { ATHLETE_UPLOADS_BUCKET } from '@/utils/athleteUploads';

const DOCUMENTS_BUCKET = 'documents';

/** Every file path under a folder (folders nest: athlete-uploads/{connection}/{parameter}/…) */
async function listFilesRecursive(bucket: string, folder: string): Promise<string[]> {
  const paths: string[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: PAGE, offset });
    if (error || !data) break;
    for (const entry of data) {
      const path = `${folder}/${entry.name}`;
      // Folders come back without an id
      if (entry.id === null) paths.push(...await listFilesRecursive(bucket, path));
      else paths.push(path);
    }
    if (data.length < PAGE) break;
  }
  return paths;
}

/** Deletes every file under a folder; returns how many could not be deleted */
async function removeFolder(bucket: string, folder: string): Promise<number> {
  const paths = await listFilesRecursive(bucket, folder);
  let failed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) failed += batch.length;
    else failed += batch.length - (data?.length ?? 0);
  }
  return failed;
}

/** Files of an athlete-app connection: test-result photos/videos and chat files. Call before the
 *  connection row is deleted (the delete policies check it). Returns how many could not be deleted. */
export async function removeConnectionFiles(connectionId: string): Promise<number> {
  return (await removeFolder(ATHLETE_UPLOADS_BUCKET, connectionId))
    + (await removeFolder(DOCUMENTS_BUCKET, `chat/${connectionId}`));
}

export interface AthleteDeletionResult {
  /** Files that could not be deleted (e.g. migration not run yet) */
  filesFailed: number;
  /** Steps that failed, in plain words */
  errors: string[];
}

export async function deleteAthleteCloudData(coachUserId: string, athleteLocalId: string): Promise<AthleteDeletionResult> {
  const errors: string[] = [];
  let filesFailed = 0;

  // 1. Anamnesis records and their attachments
  filesFailed += await removeFolder(DOCUMENTS_BUCKET, `anamnesis/${coachUserId}/${athleteLocalId}`);
  const anamneses = await supabase
    .from('athlete_anamneses')
    .delete()
    .eq('coach_user_id', coachUserId)
    .eq('athlete_local_id', athleteLocalId);
  if (anamneses.error) errors.push(`anamnesis records: ${anamneses.error.message}`);

  // 2. Athlete-app connection(s): files first, then the row (cascades to all app data)
  const { data: connections, error: connError } = await supabase
    .from('athlete_connections')
    .select('id')
    .eq('athlete_local_id', athleteLocalId)
    .eq('coach_user_id', coachUserId);
  if (connError) errors.push(`athlete-app connection: ${connError.message}`);
  for (const { id } of (connections ?? []) as Array<{ id: string }>) {
    filesFailed += await removeConnectionFiles(id);
  }
  const deleted = await supabase
    .from('athlete_connections')
    .delete()
    .eq('athlete_local_id', athleteLocalId)
    .eq('coach_user_id', coachUserId);
  if (deleted.error) errors.push(`athlete-app data: ${deleted.error.message}`);

  return { filesFailed, errors };
}

/** Per-session data the athlete calendar keeps in this browser, scoped to an assignment ("…@{assignmentId}@…") */
export function removeAssignmentScopedLocalData(assignmentIds: string[]): void {
  if (assignmentIds.length === 0) return;
  try {
    const markers = assignmentIds.map(id => `@${id}@`);
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && markers.some(m => key.includes(m))) doomed.push(key);
    }
    doomed.forEach(key => localStorage.removeItem(key));
  } catch { /* storage unavailable — nothing to clean */ }
}
