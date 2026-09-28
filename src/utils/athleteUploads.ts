/**
 * Files athletes attach to test results (photos / videos), stored in the private storage bucket
 * "athlete-uploads" under "{athleteConnectionId}/…" (see migration 20260928_athlete_test_attachments).
 * The athlete can write only to their own folder; the athlete and their coach can read.
 */
import { supabase } from '@/lib/supabase';

export const ATHLETE_UPLOADS_BUCKET = 'athlete-uploads';
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB, same as the bucket limit

/** Uploads the files; returns the stored paths of the ones that succeeded and the names that failed */
export async function uploadTestAttachments(
  connectionId: string,
  parameterId: string,
  files: File[],
): Promise<{ paths: string[]; failed: string[] }> {
  const paths: string[] = [];
  const failed: string[] = [];
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) { failed.push(file.name); continue; }
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
    const path = `${connectionId}/${parameterId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName}`;
    const { error } = await supabase.storage
      .from(ATHLETE_UPLOADS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) failed.push(file.name);
    else paths.push(path);
  }
  return { paths, failed };
}

/** Short-lived link to view an attachment (private bucket) */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ATHLETE_UPLOADS_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

/** File name shown for a stored attachment path (strips folders and the upload prefix) */
export function attachmentLabel(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/^\d+-[a-z0-9]{5}-/, '');
}

export const isVideoPath = (path: string) => /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i.test(path);
