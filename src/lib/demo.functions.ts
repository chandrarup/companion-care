import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeDbError } from "./safe-errors";

/** Create a throwaway demo auth user and return credentials so the client can sign in. */
export const createDemoSession = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const id = crypto.randomUUID().slice(0, 8);
  const email = `demo-${id}@demo.companion.app`;
  const password = crypto.randomUUID() + "Aa1!";
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { demo: true, display_name: "María Herrera" },
  });
  if (error || !data?.user) throw safeDbError(error, "createUser failed");
  await supabaseAdmin
    .from("users")
    .upsert({ id: data.user.id, email, display_name: "María Herrera" }, { onConflict: "id" });
  return { email, password };
});

/** Wipe any existing demo households and seed a fresh one owned by the current user. */
export const loadDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { wipeDemoHouseholds, seedDemoHousehold } = await import("./demo.server");

    // Remove the current user from any non-demo household membership? No — leave alone.
    // But the current user can only belong to one household at a time (UI enforces it).
    // Soft-delete any existing memberships for this user so seed can attach them.
    await supabaseAdmin
      .from("memberships")
      .delete()
      .eq("user_id", context.userId);

    await wipeDemoHouseholds(supabaseAdmin, context.userId);
    const out = await seedDemoHousehold(supabaseAdmin, context.userId);
    return { ok: true, householdId: out.householdId };
  });

export const resetDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { wipeDemoHouseholds } = await import("./demo.server");
    await supabaseAdmin.from("memberships").delete().eq("user_id", context.userId);
    const wiped = await wipeDemoHouseholds(supabaseAdmin, context.userId);
    return { ok: true, wiped };
  });

/** Ask Companion Care — checks the demo_responses cache first. */
const askSchema = z.object({
  question: z.string().min(1).max(2000),
  mode: z.enum(["caregiver", "patient"]).default("caregiver"),
});

/** Maps cached-response labels to Learn video symptom_tags so the chat can offer "Watch (2 min)". */
const LABEL_TO_VIDEO_TAG: Record<string, string> = {
  afternoon_insight: "agitation",
  what_to_do_now: "agitation",
  repetition: "repetition",
  appetite: "appetite_change",
  sleep: "sleep",
};

export const askCompanion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => askSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("demo_responses")
      .select("label, keywords, answer, tag, mode, priority")
      .order("priority", { ascending: true });

    const q = data.question.toLowerCase();
    const candidates = (rows ?? []).filter((r: any) => {
      if (data.mode === "patient") {
        // Patient Mode: only reminiscence-type entries
        if (r.tag !== "reminiscence") return false;
        if (r.mode === "caregiver") return false;
      } else {
        // Caregiver Mode: never serve reminiscence
        if (r.mode === "patient") return false;
      }
      return (r.keywords as string[]).some((kw) => q.includes(kw.toLowerCase()));
    });

    if (candidates.length > 0) {
      const hit = candidates[0];
      return {
        answer: hit.answer as string,
        tag: hit.tag as string,
        label: hit.label as string,
        video_tag: LABEL_TO_VIDEO_TAG[hit.label as string] ?? null,
        cached: true,
      };
    }

    // No cached answer: ask Gemini, grounded in what Backboard remembers about this household.
    if (process.env.GEMINI_API_KEY) {
      try {
        const { getCallerMembership } = await import("./permissions");
        const { geminiChat } = await import("./gemini.server");
        const { recall } = await import("./backboard.server");
        const m = await getCallerMembership(context.supabase, context.userId);
        const memories = await recall(m.household_id, data.question, "both", 6);
        const system =
          data.mode === "patient"
            ? "You are a warm, gentle companion for a person with early dementia. Reply in 1-2 short sentences and end with a gentle question. No medical advice."
            : `You help a family caregiver of a person with dementia. Be practical, kind and concise (under 120 words).
Rules: never diagnose, never recommend or change medication, never give clinical advice; for anything clinical or urgent, tell them to contact the care team or emergency services.
Known about this person:\n${memories.map((x) => `- ${x}`).join("\n") || "- (nothing saved yet)"}`;
        const resp = await geminiChat({
          messages: [{ role: "system", content: system }, { role: "user", content: data.question }],
          max_tokens: 1500,
          reasoning_effort: "low",
        });
        if (resp.ok) {
          const j = (await resp.json()) as any;
          const answer = (j?.choices?.[0]?.message?.content ?? "").trim();
          if (answer) return { answer, tag: "ai", label: null, video_tag: null, cached: false };
        }
      } catch (e) {
        console.error("askCompanion AI fallback failed:", e);
      }
    }

    return {
      answer:
        data.mode === "patient"
          ? "I'm here with you."
          : "I don't have an answer for that yet. For anything clinical, please ask Dr. Alvarez.",
      tag: "fallback",
      label: null,
      video_tag: null,
      cached: false,
    };
  });