/**
 * Speech-to-text for dictated anamnesis notes: Mistral Voxtral (EU), through the ai-proxy edge
 * function (the API key stays on the server).
 *
 * The recording is put into the coach's private anamnesis folder in storage for the moment of the
 * transcription only: the edge function hands Mistral a link valid for 10 minutes and deletes the
 * file right after (and this code deletes it again in case the function could not). Only the text
 * is kept. No upload-size limit of the edge function applies this way.
 */
import { supabase } from '@/lib/supabase';

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/ai-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

export async function transcribeDictation(
  audio: Blob,
  /** athleteLocalId: the athlete's folder; without one (AI chat, onboarding) the coach's _dictation folder */
  opts: { coachUserId: string; athleteLocalId?: string; language?: 'de' | 'en' },
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const folder = opts.athleteLocalId || '_dictation';
  const path = `anamnesis/${opts.coachUserId}/${folder}/dictation_${Date.now()}.${extensionFor(audio.type)}`;
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(path, audio, { contentType: audio.type || 'audio/webm', upsert: false });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': ANON_KEY,
        'x-target': 'mistral-transcribe',
      },
      body: JSON.stringify({ path, ...(opts.language ? { language: opts.language } : {}) }),
    });
    if (!response.ok) throw new Error(`Transcription failed (${response.status}): ${await response.text()}`);
    const data = await response.json() as { text?: string };
    return (data.text ?? '').trim();
  } finally {
    // The function deletes the audio already; this is the safety net
    await supabase.storage.from('documents').remove([path]).catch(() => undefined);
  }
}
