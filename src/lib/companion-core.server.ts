import { buildSystemPrompt, checkReply, fallbackReply, screenInput, tidyReply, type Lang } from "./guardrails";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type CompanionResult = {
  reply: string;
  flag?: "distress";
  source: "screen" | "model" | "retry" | "fallback";
  violations?: string[];
};

// Quotas are per model, so on 429/5xx fall through to the next one before giving up.
const MODELS = () =>
  [...new Set([process.env.GEMINI_COMPANION_MODEL || "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-flash-lite"])];

async function ask(messages: { role: string; content: string }[]): Promise<string | null> {
  const { geminiChat } = await import("./gemini.server");
  for (let pass = 0; pass < 2; pass++) {
    for (const model of MODELS()) {
      try {
        const resp = await geminiChat({ model, messages, temperature: 0.6, max_tokens: 1500, ...(/lite/.test(model) ? {} : { reasoning_effort: "low" }) }, 5000);
        if (resp.ok) {
          const j = (await resp.json()) as any;
          const choice = j?.choices?.[0];
          const text = (choice?.message?.content ?? "").trim();
          // A reply cut off by the token limit (thinking models can burn the budget) is never spoken: try the next model.
          if (text && choice?.finish_reason !== "length") return text;
          console.warn(`[companion] ${model} unusable reply (finish_reason=${choice?.finish_reason})`);
          continue;
        }
        console.warn(`[companion] ${model} HTTP ${resp.status}`);
        if (resp.status !== 429 && resp.status < 500) return null; // our request is wrong; retrying won't help
      } catch (e) {
        console.warn(`[companion] ${model} error:`, (e as Error).message);
      }
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/**
 * Guarded companion reply. Facts = profile facts + recalled Backboard memories (patient-safe life story only).
 * Order: deterministic input screen -> model -> output check -> one retry with the violations named -> calm fallback.
 */
export async function generateCompanionReply(o: {
  lang: Lang; name: string; caregiver: string; facts: string[]; history: ChatTurn[]; userText: string;
}): Promise<CompanionResult> {
  const screened = screenInput(o.userText, o.lang, o.caregiver, o.name);
  if (screened) return { reply: screened.reply, flag: screened.flag, source: "screen" };

  const system = buildSystemPrompt({ lang: o.lang, name: o.name, caregiver: o.caregiver, facts: o.facts });
  const convo = [...o.history.slice(-10), { role: "user" as const, content: o.userText }];
  try {
    const first = await ask([{ role: "system", content: system }, ...convo]);
    if (first) {
      const tidy = tidyReply(first, o.lang);
      const bad = checkReply(tidy);
      if (bad.length === 0) return { reply: tidy, source: "model" };
      const second = await ask([
        { role: "system", content: system },
        ...convo,
        { role: "assistant", content: first },
        { role: "user", content: `[Internal note, not from ${o.name}] That reply broke these rules: ${bad.join("; ")}. Rewrite it so it follows every hard rule, in at most 2 short sentences ending with one gentle question.` },
      ]);
      if (second) {
        const t2 = tidyReply(second, o.lang);
        if (checkReply(t2).length === 0) return { reply: t2, source: "retry", violations: bad };
      }
      return { reply: fallbackReply(o.lang, o.userText.length), source: "fallback", violations: bad };
    }
  } catch (e) {
    console.error("[companion] generation failed:", (e as Error).message);
  }
  return { reply: fallbackReply(o.lang, o.userText.length), source: "fallback" };
}
