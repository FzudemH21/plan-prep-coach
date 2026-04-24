export interface Message {
  role: "user" | "assistant";
  content: string;
}

const API_URL = "https://api.anthropic.com/v1/messages";

function getApiKey(): string {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!key) throw new Error("VITE_ANTHROPIC_API_KEY is not set");
  return key;
}

export async function sendMessage(
  messages: Message[],
  systemPrompt: string,
  model = "claude-opus-4-6"
): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const textBlock = data.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text in API response");
  return textBlock.text;
}
