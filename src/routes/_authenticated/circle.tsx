import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import {
  listCircle,
  inviteToCircle,
  updateMemberPermissions,
  removeMember,
  cancelInvite,
  setEditLockDays,
  SECTION_LIST,
  DEFAULT_PERMISSIONS,
} from "@/lib/circle.functions";

export const Route = createFileRoute("/_authenticated/circle")({
  head: () => ({ meta: [{ title: "Family circle — Companion Care" }] }),
  component: CirclePage,
});

const ROLE_LABELS: Record<string, string> = {
  primary_caregiver: "Primary caregiver",
  family: "Family",
  friend: "Friend",
  clinician: "Clinician (read-only summary)",
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, "read" | "write">;
  users: { email: string } | null;
};
type Invite = {
  id: string;
  email: string;
  role: string;
  permissions: Record<string, "read" | "write">;
  expires_at: string;
};

function CirclePage() {
  const listFn = useServerFn(listCircle);
  const inviteFn = useServerFn(inviteToCircle);
  const updateFn = useServerFn(updateMemberPermissions);
  const removeFn = useServerFn(removeMember);
  const cancelFn = useServerFn(cancelInvite);
  const lockFn = useServerFn(setEditLockDays);

  const [myRole, setMyRole] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"family" | "friend" | "clinician">("family");
  const [perms, setPerms] = useState<Record<string, "read" | "write">>(DEFAULT_PERMISSIONS.family);
  const [lockDays, setLockDays] = useState(3);

  const refresh = useCallback(async () => {
    try {
      const r: any = await listFn();
      setMyRole(r.myRole);
      setMembers(r.members ?? []);
      setInvites(r.invites ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load circle");
    }
  }, [listFn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (role === "clinician") setPerms({});
    else setPerms(DEFAULT_PERMISSIONS[role]);
  }, [role]);

  const isPrimary = myRole === "primary_caregiver";

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await inviteFn({ data: { email, role, permissions: perms } });
      setEmail("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  function togglePerm(target: Record<string, "read" | "write">, section: string): Record<string, "read" | "write"> {
    const next = { ...target };
    const cur = next[section];
    if (!cur) next[section] = "read";
    else if (cur === "read") next[section] = "write";
    else delete next[section];
    return next;
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-2">Family circle</h1>
      <p className="text-muted-foreground mb-6">
        Invite people and choose exactly what they can see. Clinicians only ever get read-only access to the physician summary.
      </p>

      {error && (
        <div className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {!isPrimary && (
        <div className="mb-6 rounded border border-border bg-muted/40 p-3 text-sm">
          You are signed in as <strong>{ROLE_LABELS[myRole] ?? myRole}</strong>. Only the primary caregiver can manage the circle.
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Members</h2>
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.id} className="rounded border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{m.users?.email ?? m.user_id}</div>
                  <div className="text-sm text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</div>
                </div>
                {isPrimary && m.role !== "primary_caregiver" && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Remove this member?")) return;
                      await removeFn({ data: { membershipId: m.id } });
                      await refresh();
                    }}
                    className="text-sm text-destructive underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              {(m.role === "family" || m.role === "friend") && isPrimary && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {SECTION_LIST.filter((s) => s !== "family_circle").map((s) => {
                    const v = m.permissions?.[s];
                    const label = v === "write" ? "edit" : v === "read" ? "view" : "no";
                    return (
                      <button
                        key={s}
                        type="button"
                        data-touch
                        onClick={async () => {
                          const next = togglePerm(m.permissions ?? {}, s);
                          await updateFn({ data: { membershipId: m.id, permissions: next } });
                          await refresh();
                        }}
                        className={
                          "px-3 py-1 rounded-full border text-sm " +
                          (v === "write"
                            ? "bg-primary text-primary-foreground border-primary"
                            : v === "read"
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background text-muted-foreground border-border")
                        }
                      >
                        {s.replace("_", " ")}: {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {invites.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Pending invitations</h2>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between rounded border border-border p-3">
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-sm text-muted-foreground">
                    {ROLE_LABELS[inv.role] ?? inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                  </div>
                </div>
                {isPrimary && (
                  <button
                    type="button"
                    onClick={async () => {
                      await cancelFn({ data: { inviteId: inv.id } });
                      await refresh();
                    }}
                    className="text-sm underline"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isPrimary && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Invite someone</h2>
          <form onSubmit={sendInvite} className="space-y-3 rounded border border-border p-3">
            <div>
              <label className="block text-sm mb-1" htmlFor="inv-email">Email</label>
              <input
                id="inv-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-input bg-background px-3 py-2"
                data-touch
              />
            </div>
            <div>
              <label className="block text-sm mb-1" htmlFor="inv-role">Role</label>
              <select
                id="inv-role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full rounded border border-input bg-background px-3 py-2"
                data-touch
              >
                <option value="family">Family</option>
                <option value="friend">Friend</option>
                <option value="clinician">Clinician (read-only summary)</option>
              </select>
            </div>
            {role !== "clinician" && (
              <div>
                <div className="text-sm mb-2">Sections this person can access:</div>
                <div className="flex flex-wrap gap-2">
                  {SECTION_LIST.filter((s) => s !== "family_circle").map((s) => {
                    const v = perms[s];
                    const label = v === "write" ? "edit" : v === "read" ? "view" : "no";
                    return (
                      <button
                        key={s}
                        type="button"
                        data-touch
                        onClick={() => setPerms((p) => togglePerm(p, s))}
                        className={
                          "px-3 py-1 rounded-full border text-sm " +
                          (v === "write"
                            ? "bg-primary text-primary-foreground border-primary"
                            : v === "read"
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background text-muted-foreground border-border")
                        }
                      >
                        {s.replace("_", " ")}: {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Tap a chip to cycle: no → view → edit → no.</p>
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
              data-touch
            >
              {busy ? "Sending…" : "Send invitation"}
            </button>
          </form>
        </section>
      )}

      {isPrimary && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Edit-lock window</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Daily logs and episodes become read-only after this many days.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={60}
              value={lockDays}
              onChange={(e) => setLockDays(parseInt(e.target.value || "0", 10))}
              className="w-24 rounded border border-input bg-background px-3 py-2"
              data-touch
            />
            <button
              type="button"
              onClick={async () => {
                await lockFn({ data: { days: lockDays } });
              }}
              className="px-3 py-2 rounded border border-border"
              data-touch
            >
              Save
            </button>
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        </section>
      )}
    </AppShell>
  );
}