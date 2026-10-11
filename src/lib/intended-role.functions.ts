import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeDbError } from "./safe-errors";

const roleSchema = z.object({ role: z.enum(["caregiver", "patient"]) });

export const setIntendedRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Only set if currently null — first chosen role sticks.
    const { data: row } = await supabase
      .from("users")
      .select("intended_role")
      .eq("id", userId)
      .maybeSingle();
    if (row?.intended_role) return { role: row.intended_role as "caregiver" | "patient" };
    const { error } = await supabase
      .from("users")
      .update({ intended_role: data.role })
      .eq("id", userId);
    if (error) throw safeDbError(error);
    return { role: data.role };
  });

export const getIntendedRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("users")
      .select("intended_role")
      .eq("id", userId)
      .maybeSingle();
    return { role: (data?.intended_role ?? null) as "caregiver" | "patient" | null };
  });