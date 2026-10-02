import { supabase } from '@/lib/supabase';
import { ensureAthleteNamesLoaded, pseudonymizeRequest, restoreNames } from '@/utils/pseudonymize';

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/** A file block that can be attached to a message for document/image analysis. */
export interface FileAttachment {
  /** "document" for PDFs, "image" for image types */
  blockType: "document" | "image";
  /** MIME type, e.g. "application/pdf" or "image/jpeg" */
  mediaType: string;
  /** Base64-encoded file content */
  base64Data: string;
}

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/ai-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Every AI request goes through here — athlete names are replaced by labels before sending */
async function proxyFetch(body: Record<string, unknown>): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  await ensureAthleteNamesLoaded();

  return fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(pseudonymizeRequest(body)),
  });
}

async function extractText(response: Response): Promise<string> {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI proxy error ${response.status}: ${error}`);
  }
  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };
  // Newer models (Sonnet 5.5) may start with a thinking block — read the reply by block type
  const textBlock = data.content.find((b) => b.type === 'text' && b.text);
  if (!textBlock?.text) {
    if (data.stop_reason === 'refusal') throw new Error('The AI declined to answer this request.');
    if (data.stop_reason === 'max_tokens') throw new Error('The AI ran out of room before answering — please try again or ask for a shorter answer.');
    throw new Error('No text in API response');
  }
  // The reply refers to "Athlete A" etc. — show the real names in the app
  return restoreNames(textBlock.text);
}

export type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

/** The model used by every AI feature in the app */
export const AI_MODEL = "claude-sonnet-5-5";
/** Default thinking effort (Sonnet 5.5 thinks before answering; thinking is billed as output) */
export const AI_EFFORT: Effort = "high";
/** Thinking counts toward max_tokens — a low cap could leave no room for the answer itself */
const MIN_MAX_TOKENS = 16000;

export type Effort = "low" | "medium" | "high";

/** Request fields shared by every call: the model, room for thinking + answer, the effort */
function modelFields(model: string, maxTokens: number, effort?: Effort): Record<string, unknown> {
  const thinks = /^claude-(sonnet|opus)-5/.test(model);
  return {
    model,
    max_tokens: thinks ? Math.max(maxTokens, MIN_MAX_TOKENS) : maxTokens,
    ...(thinks ? { output_config: { effort: effort ?? AI_EFFORT } } : {}),
  };
}

export interface SendOptions {
  /** How much the model thinks before answering — defaults to AI_EFFORT */
  effort?: Effort;
}

export async function sendMessage(
  messages: Message[],
  systemPrompt: string | SystemBlock[],
  model: string = AI_MODEL,
  maxTokens = 4096,
  options: SendOptions = {},
): Promise<string> {
  const response = await proxyFetch({
    ...modelFields(model, maxTokens, options.effort),
    system: systemPrompt,
    messages,
  });
  return extractText(response);
}

/**
 * Send a single user message that may include a PDF or image attachment.
 * The file block is prepended before the text block so Claude reads the
 * document first, then the prompt.
 */
export async function sendMessageWithFile(
  textContent: string,
  attachment: FileAttachment | null,
  systemPrompt: string,
  model: string = AI_MODEL
): Promise<string> {
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "document"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  const content: ContentBlock[] = [];

  if (attachment) {
    content.push({
      type: attachment.blockType,
      source: {
        type: "base64",
        media_type: attachment.mediaType,
        data: attachment.base64Data,
      },
    } as ContentBlock);
  }

  content.push({ type: "text", text: textContent });

  const response = await proxyFetch({
    ...modelFields(model, 2048),
    system: systemPrompt,
    messages: [{ role: "user", content }],
  });
  return extractText(response);
}
