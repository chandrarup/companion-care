import type { Database } from "@/integrations/supabase/types";
import { safeDbError } from "./safe-errors";

export type Section =
  | "photos"
  | "symptom_logs"
  | "episodes"
  | "cues"
  | "fingerprint"
  | "physician_summary"
  | "training"
  | "family_circle";

export type Role = Database["public"]["Enums"]["membership_role"];

/** Resolve the caller's household + role. Throws if not a member. */
export async function getCallerMembership(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("household_id, role, permissions")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw safeDbError(error);
  if (!data) throw new Error("No household for user");
  return data as { household_id: string; role: Role; permissions: Record<string, "read" | "write"> };
}

/** 'write' | 'read' | null — applies role-based defaults. */
export function sectionAccess(role: Role, perms: Record<string, any>, section: Section): "write" | "read" | null {
  if (role === "primary_caregiver") return "write";
  if (role === "clinician") return section === "physician_summary" ? "read" : null;
  const v = perms?.[section];
  if (v === "read" || v === "write") return v;
  return null;
}

/** Throws 403 if the caller lacks the required level for the section. */
export async function requireSection(
  supabase: any,
  userId: string,
  section: Section,
  level: "read" | "write",
): Promise<{ householdId: string; role: Role }> {
  const m = await getCallerMembership(supabase, userId);
  const access = sectionAccess(m.role, m.permissions ?? {}, section);
  const ok = access === "write" || (access === "read" && level === "read");
  if (!ok) {
    const err: any = new Error(`Forbidden: missing ${level} access to ${section}`);
    err.status = 403;
    throw err;
  }
  return { householdId: m.household_id, role: m.role };
}

/** Check whether a record is past the household's edit-lock window. */
export async function isLocked(supabase: any, householdId: string, createdAt: string): Promise<boolean> {
  const { data } = await supabase
    .from("households")
    .select("edit_lock_days")
    .eq("id", householdId)
    .maybeSingle();
  const days = data?.edit_lock_days ?? 3;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() < cutoff;
}

export function isLockedClient(createdAt: string, editLockDays: number): boolean {
  const cutoff = Date.now() - editLockDays * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() < cutoff;
}