import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSection } from "./permissions";
import { safeDbError } from "./safe-errors";

const addSchema = z.object({ text: z.string().min(1).max(500) });
const idSchema = z.object({ id: z.string().uuid() });

export const listConcerns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "physician_summary", "read");
    const { data, error } = await context.supabase
      .from("caregiver_concerns")
      .select("id, text, resolved_at, created_at")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw safeDbError(error);
    return { concerns: data ?? [] };
  });

export const addConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "physician_summary", "write");
    const { data: row, error } = await context.supabase
      .from("caregiver_concerns")
      .insert({ household_id: householdId, created_by: context.userId, text: data.text })
      .select("id, text, resolved_at, created_at")
      .single();
    if (error) throw safeDbError(error);
    return row;
  });

export const resolveConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSection(context.supabase, context.userId, "physician_summary", "write");
    const { error } = await context.supabase
      .from("caregiver_concerns")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

export const deleteConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireSection(context.supabase, context.userId, "physician_summary", "write");
    const { error } = await context.supabase
      .from("caregiver_concerns")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw safeDbError(error);
    return { ok: true };
  });