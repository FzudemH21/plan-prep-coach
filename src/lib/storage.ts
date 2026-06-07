import { supabase } from './supabase';

const BUCKET = 'documents';

export async function uploadFile(path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function downloadFile(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

// ── Chat file upload ──────────────────────────────────────────────────────────
// Stores chat attachments under chat/{connectionId}/{timestamp}_{filename}
// in the same documents bucket (private — accessed via signed URLs).

export interface ChatAttachmentMeta {
  name: string;
  type: 'image' | 'video' | 'document';
  mimeType: string;
  path: string;
  size: number;
}

export async function uploadChatFile(
  connectionId: string,
  file: File
): Promise<ChatAttachmentMeta> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `chat/${connectionId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const type: 'image' | 'video' | 'document' = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
    ? 'video'
    : 'document';
  return { name: file.name, type, mimeType: file.type, path, size: file.size };
}
