import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCallerMembership } from "./permissions";

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const m = await getCallerMembership(context.supabase, context.userId);
      return { role: m.role as string, householdId: m.household_id as string };
    } catch {
      return { role: null, householdId: null };
    }
  });