// Backboard.io long-term memory. Gemini stays the chat model; Backboard remembers
// the person's life story and past conversations and recalls them per turn.
// Docs: POST /assistants, POST /assistants/{id}/memories, POST /assistants/{id}/memories/search,
//       POST /threads/messages (send_to_llm="false" + memory="Auto" => fact extraction only).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { patientSafeText } from "./guardrails";

const BASE = "https://app.backboard.io/api";

export const hasBackboardKey = () => !!process.env.BACKBOARD_API_KEY;

async function bb(path: string, body: unknown, method = "POST") {
  const key = process.env.BACKBOARD_API_KEY;
  if (!key) throw new Error("Missing BACKBOARD_API_KEY");
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) throw new Error(`Backboard ${path} failed (${resp.status})`);
  return resp.json() as Promise<any>;
}

/** Patient-safe life-story facts. Anything a patient must not hear (loss, diagnosis, medicine, triggers) is excluded. */
export function profileFacts(p: Record<string, any> | null): string[] {
  if (!p) return [];
  const name = p.preferred_name || p.display_name || "The patient";
  const out: string[] = [];
  const add = (s: string | null | undefined) => {
    const t = s && patientSafeText(s);
    if (t) out.push(t);
  };
  add(p.biography && `${name}: ${p.biography}`);
  add(p.hometown && `${name} grew up in ${p.hometown}.`);
  add(p.profession && `${name}'s work or profession: ${p.profession}.`);
  add(p.culture_faith && `${name}'s culture and faith: ${p.culture_faith}.`);
  add(p.daily_routines && `${name}'s daily routine: ${p.daily_routines}`);
  const list = (label: string, v: unknown) => Array.isArray(v) && v.length && add(`${name} ${label}: ${v.join(", ")}.`);
  list("loves music by", p.music_preferences);
  list("likes", p.likes);
  list("feels calm and happy with", p.calming_strategies);
  list("has these happy memories", p.life_events);
  if (Array.isArray(p.languages) && p.languages.length) add(`${name} understands: ${p.languages.map((l: string) => (l === "es" ? "Spanish" : l === "en" ? "English" : l)).join(", ")}.`);
  if (Array.isArray(p.key_people)) {
    for (const k of p.key_people as any[]) if (k?.name) add(`${k.name} is ${name}'s ${k.relationship || "close person"}.`);
  }
  return out.slice(0, 40);
}

/** Caregiver-only facts (care memory): triggers, dislikes, diagnosis, medicines, conditions. Never shown to the patient. */
export function careFacts(p: Record<string, any> | null): string[] {
  if (!p) return [];
  const name = p.preferred_name || p.display_name || "The patient";
  const out: string[] = [];
  const list = (label: string, v: unknown) => Array.isArray(v) && v.length && out.push(`${name} ${label}: ${v.join(", ")}.`);
  list("can become upset by", p.known_triggers);
  list("dislikes", p.dislikes);
  list("has these conditions", p.conditions);
  list("takes these medications (names only)", p.medication_names);
  if (p.diagnosis_type) out.push(`${name}'s diagnosis: ${p.diagnosis_type}${p.diagnosis_date ? ` (since ${p.diagnosis_date})` : ""}${p.stage_self_select ? `; how things are going: ${p.stage_self_select}` : ""}.`);
  return out;
}

type Kind = "life" | "care";

async function createAssistant(name: string, prompt: string) {
  const created = await bb("/assistants", { name, system_prompt: prompt });
  return created.assistant_id as string;
}

/**
 * Two assistants per household, kept apart on purpose:
 *  - "life": the patient's life story (seeded from the profile). The only memory patient chat may use.
 *  - "care": caregiver-only notes (daily logs, what was said in chat). Never shown to the patient.
 */
export async function ensureAssistant(householdId: string, kind: Kind): Promise<{ assistantId: string; threadId: string | null }> {
  const col = kind === "life" ? "backboard_assistant_id" : "backboard_care_assistant_id";
  const { data: hh } = await supabaseAdmin
    .from("households")
    .select("backboard_assistant_id, backboard_care_assistant_id, backboard_thread_id, backboard_life_stale")
    .eq("id", householdId)
    .maybeSingle();
  let existing = hh?.[col] as string | null | undefined;

  // The patient profile changed since the life-story memory was built: rebuild it so answers use current facts.
  if (kind === "life" && existing && hh?.backboard_life_stale) {
    try { await bb(`/assistants/${existing}`, undefined, "DELETE"); } catch {}
    await supabaseAdmin.from("households").update({ backboard_assistant_id: null, backboard_life_stale: false }).eq("id", householdId);
    existing = null;
  }
  if (existing) return { assistantId: existing, threadId: kind === "care" ? (hh?.backboard_thread_id ?? null) : null };

  const assistantId = await createAssistant(
    `${kind}-${householdId.slice(0, 8)}`,
    kind === "life"
      ? "Life-story memory for a dementia companion. Only warm, positive facts about the person's life, family, music and preferences."
      : "Caregiver-only care log for a dementia companion: daily observations, symptoms, what helped, and what the person talked about.",
  );
  await supabaseAdmin.from("households").update({ [col]: assistantId, ...(kind === "life" ? { backboard_life_stale: false } : {}) }).eq("id", householdId);

  const { data: profile } = await supabaseAdmin.from("patient_profile").select("*").eq("household_id", householdId).maybeSingle();
  const facts = kind === "life" ? profileFacts(profile) : careFacts(profile);
  await Promise.allSettled(facts.map((content) => bb(`/assistants/${assistantId}/memories`, { content, metadata: { source: "profile" } })));
  return { assistantId, threadId: null };
}

async function search(assistantId: string, query: string, limit: number) {
  const r = await bb(`/assistants/${assistantId}/memories/search`, { query, limit });
  return ((r.memories ?? []) as any[]).filter((m) => (m.score ?? 1) > 0.3).map((m) => String(m.content));
}

/** Relevant remembered facts (empty on any failure — memory is best-effort). */
export async function recall(householdId: string, query: string, scope: "life" | "care" | "both" = "life", limit = 6): Promise<string[]> {
  if (!hasBackboardKey()) return [];
  try {
    const kinds: Kind[] = scope === "both" ? ["life", "care"] : [scope];
    const lists = await Promise.all(kinds.map(async (k) => search((await ensureAssistant(householdId, k)).assistantId, query, limit)));
    return [...new Set(lists.flat())].slice(0, limit * kinds.length);
  } catch (e) {
    console.warn("[backboard] recall failed:", (e as Error).message);
    return [];
  }
}

/** Store a caregiver-side note/exchange in the CARE memory; Backboard extracts durable facts. Never throws. */
export async function remember(householdId: string, text: string) {
  if (!hasBackboardKey() || !text.trim()) return;
  try {
    const { assistantId, threadId } = await ensureAssistant(householdId, "care");
    const r = await bb("/threads/messages", {
      assistant_id: assistantId,
      ...(threadId ? { thread_id: threadId } : {}),
      content: text.slice(0, 2000),
      memory: "Auto",
      send_to_llm: "false",
    });
    if (!threadId && r.thread_id) {
      await supabaseAdmin.from("households").update({ backboard_thread_id: r.thread_id }).eq("id", householdId);
    }
  } catch (e) {
    console.warn("[backboard] remember failed:", (e as Error).message);
  }
}

// ---- Shared, read-only demo memory (Rosa) -----------------------------------------
const DEMO_KEY = "backboard_demo_assistant:v2";
let demoAssistant: Promise<string> | null = null;

/** Lazily create + seed the demo patient's assistant once; its id is kept in Tiger so every server shares it. */
export function getDemoAssistantId(): Promise<string> {
  demoAssistant ??= (async () => {
    const { data } = await supabaseAdmin.from("app_kv").select("value").eq("key", DEMO_KEY).maybeSingle();
    if (data?.value) return data.value as string;
    const { ROSA_LIFE_FACTS } = await import("./demo/rosa-facts");
    const id = await createAssistant("demo-rosa-life-story", "Life-story memory for the demo patient Rosa Herrera (synthetic).");
    await Promise.all(ROSA_LIFE_FACTS.map((content) => bb(`/assistants/${id}/memories`, { content, metadata: { source: "demo-seed" } })));
    await supabaseAdmin.from("app_kv").upsert({ key: DEMO_KEY, value: id }, { onConflict: "key" });
    return id;
  })().catch((e) => {
    demoAssistant = null;
    throw e;
  });
  return demoAssistant;
}

/** Read-only: public demo visitors can never write to memory. */
export async function recallDemo(query: string, limit = 6): Promise<string[]> {
  if (!hasBackboardKey()) return [];
  try {
    return await search(await getDemoAssistantId(), query, limit);
  } catch (e) {
    console.warn("[backboard] demo recall failed:", (e as Error).message);
    return [];
  }
}
