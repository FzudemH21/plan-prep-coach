import { sendMessage } from '@/utils/anthropicApi';
import type { Message } from '@/utils/anthropicApi';

/** Compress a chat thread when it grows past this many messages. */
export const COMPRESSION_THRESHOLD = 20;

/** Keep this many recent messages verbatim after compression. */
const KEEP_RECENT = 6;

const SYSTEM_PROMPT = `You are a concise note-taker. The user will give you a transcript of a sports-science planning conversation between a coach and an AI assistant. Summarize it in 250 words or fewer. Focus on: decisions made, training methods chosen, specific values (duration, weeks, volume, sets, reps, intensity), key athlete constraints or health factors mentioned, open questions, and the reasoning behind key choices. Be specific — preserve exact numbers, method names, and dates where relevant.`;

/**
 * Compress a message thread.
 *
 * When the thread length exceeds COMPRESSION_THRESHOLD, all but the
 * last KEEP_RECENT messages are summarised into a single assistant
 * message prefixed with "[Earlier conversation compressed — summary]".
 * This keeps the context window small while preserving continuity.
 *
 * On failure the function falls back to trimming (keeping only
 * KEEP_RECENT messages) so the conversation never grows unbounded.
 */
export async function compressConversation(messages: Message[]): Promise<Message[]> {
  if (messages.length < COMPRESSION_THRESHOLD) return messages;

  const toCompress = messages.slice(0, messages.length - KEEP_RECENT);
  const toKeep = messages.slice(messages.length - KEEP_RECENT);

  const transcript = toCompress
    .map(m => `${m.role === 'user' ? 'Coach' : 'AI'}: ${m.content}`)
    .join('\n\n');

  try {
    const summary = await sendMessage(
      [{ role: 'user', content: transcript }],
      SYSTEM_PROMPT,
      'claude-haiku-4-5-20251001',
      512,
    );
    return [
      {
        role: 'assistant' as const,
        content: `[Earlier conversation compressed — summary]\n\n${summary}`,
      },
      ...toKeep,
    ];
  } catch {
    // Compression failed — trim to recent only so the thread stays bounded
    return toKeep;
  }
}
