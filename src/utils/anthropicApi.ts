import { supabase } from '@/lib/supabase';

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

async function proxyFetch(body: unknown): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  return fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(body),
  });
}

async function extractText(response: Response): Promise<string> {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI proxy error ${response.status}: ${error}`);
  }
  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text in API response');
  return textBlock.text;
}

export async function sendMessage(
  messages: Message[],
  systemPrompt: string,
  model = "claude-haiku-4-5",
  maxTokens = 4096,
): Promise<string> {
  const response = await proxyFetch({
    model,
    max_tokens: maxTokens,
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
  model = "claude-sonnet-4-5"
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
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content }],
  });
  return extractText(response);
}
