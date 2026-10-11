import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeDbError } from "./safe-errors";

/**
 * Recompute the trigger fingerprint for the caller's household.
 * Counts co-occurrences of (antecedent -> symptom) across log_symptoms + episodes
 * over a rolling window. Surfaces patterns at or above household.min_evidence.
 * Stores results in fingerprint_insights (preserves prior dismissals).
 */
export const recomputeFingerprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { recomputeFingerprintInline } = await import("./fingerprint.server");
    return recomputeFingerprintInline(context.supabase, context.userId);
  });

export const listInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: m } = await supabase
      .from("memberships")
      .select("household_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!m) return { insights: [], minEvidence: 4 };
    const householdId = m.household_id as string;
    const { data: h } = await supabase
      .from("households")
      .select("min_evidence")
      .eq("id", householdId)
      .maybeSingle();
    const { data, error } = await supabase
      .from("fingerprint_insights")
      .select("id, insight, created_at, updated_at")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw safeDbError(error);
    return { insights: data ?? [], minEvidence: (h?.min_evidence as number) ?? 4 };
  });

const dismissSchema = z.object({ id: z.string().uuid() });

export const dismissInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dismissSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fingerprint_insights")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });
