// Direct Google Gemini API via its OpenAI-compatible endpoint.
// Model is configurable: set GEMINI_MODEL (default below).
const DEFAULT_MODEL = "gemini-3.8-flash";

export function hasGeminiKey() {
  return !!process.env.GEMINI_API_KEY;
}

/** POST a chat-completions style body; returns the raw fetch Response. */
export function geminiChat(body: Record<string, unknown>, timeoutMs = 10_000): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.GEMINI_MODEL || DEFAULT_MODEL, ...body }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
