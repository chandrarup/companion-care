import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireSection, getCallerMembership, type Role, type Section } from "./permissions";
import { safeDbError } from "./safe-errors";

const ROLES = ["primary_caregiver", "family", "friend", "clinician"] as const;
const SECTIONS: Section[] = [
  "photos",
  "symptom_logs",
  "episodes",
  "cues",
  "fingerprint",
  "physician_summary",
  "training",
  "family_circle",
];

const permsSchema = z.record(z.string(), z.enum(["read", "write"]));

export const SECTION_LIST = SECTIONS;
export const DEFAULT_PERMISSIONS: Record<Role, Record<string, "read" | "write">> = {
  primary_caregiver: {},
  family: { photos: "read", training: "read", cues: "read" },
  friend: { photos: "read" },
  clinician: {},
};

export const listCircle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let m: Awaited<ReturnType<typeof getCallerMembership>>;
    try {
      m = await getCallerMembership(context.supabase, context.userId);
    } catch (error) {
      if (error instanceof Error && error.message === "No household for user") {
        return {
          myRole: "",
          members: [],
          invites: [],
        };
      }
      throw error;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: members }, { data: invites }] = await Promise.all([
      supabaseAdmin
        .from("memberships")
        .select("id, user_id, role, permissions, created_at, users:user_id(email)")
        .eq("household_id", m.household_id)
        .is("deleted_at", null),
      supabaseAdmin
        .from("household_invitations")
        .select("id, email, role, permissions, expires_at, accepted_at, created_at")
        .eq("household_id", m.household_id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);
    return {
      myRole: m.role,
      members: members ?? [],
      invites: invites ?? [],
    };
  });

const inviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(ROLES),
  permissions: permsSchema.default({}),
});

export const inviteToCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "family_circle", "write");
    if (data.role === "primary_caregiver") {
      throw new Error("Only one primary caregiver per household.");
    }
    const perms = data.role === "clinician" ? {} : data.permissions;
    const token = crypto.randomUUID() + "." + crypto.randomUUID();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("household_invitations")
      .insert({
        household_id: householdId,
        email: data.email.toLowerCase(),
        role: data.role,
        permissions: perms,
        token,
        invited_by: context.userId,
      })
      .select("id, token")
      .single();
    if (error) throw safeDbError(error);

    // Send magic-link sign-up to the invitee
    const origin =
      context.claims?.iss?.replace(/\/auth\/v1$/, "") ?? process.env.SUPABASE_URL ?? "";
    try {
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: `${origin}/auth?invite=${invite.token}`,
      });
    } catch (e) {
      console.warn("inviteUserByEmail failed (ok if user exists):", e);
    }
    return { id: invite.id };
  });

const updateSchema = z.object({
  membershipId: z.string().uuid(),
  permissions: permsSchema,
});

export const updateMemberPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "family_circle", "write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("memberships")
      .select("id, role, household_id")
      .eq("id", data.membershipId)
      .maybeSingle();
    if (!target || target.household_id !== householdId) throw new Error("Not found");
    if (target.role === "primary_caregiver") throw new Error("Cannot change primary caregiver permissions.");
    if (target.role === "clinician") throw new Error("Clinician access is fixed (read-only physician summary).");
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ permissions: data.permissions })
      .eq("id", data.membershipId);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

const removeSchema = z.object({ membershipId: z.string().uuid() });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => removeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "family_circle", "write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("memberships")
      .select("id, role, household_id")
      .eq("id", data.membershipId)
      .maybeSingle();
    if (!target || target.household_id !== householdId) throw new Error("Not found");
    if (target.role === "primary_caregiver") throw new Error("Cannot remove the primary caregiver.");
    const { error } = await supabaseAdmin
      .from("memberships")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.membershipId);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

const cancelSchema = z.object({ inviteId: z.string().uuid() });

export const cancelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cancelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "family_circle", "write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("household_invitations")
      .delete()
      .eq("id", data.inviteId)
      .eq("household_id", householdId);
    if (error) throw safeDbError(error);
    return { ok: true };
  });

const editLockSchema = z.object({ days: z.number().int().min(0).max(60) });

export const setEditLockDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => editLockSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { householdId } = await requireSection(context.supabase, context.userId, "family_circle", "write");
    const { error } = await context.supabase
      .from("households")
      .update({ edit_lock_days: data.days })
      .eq("id", householdId);
    if (error) throw safeDbError(error);
    return { ok: true, days: data.days };
  });