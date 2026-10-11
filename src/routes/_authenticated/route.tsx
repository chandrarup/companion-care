import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/role.functions";
import { getIntendedRole } from "@/lib/intended-role.functions";

// Cache the role lookup per session so navigation between authenticated
// pages doesn't block on a server roundtrip every time.
let cachedRolePromise: Promise<{ role: string | null } | null> | null = null;
function getCachedRole() {
  if (!cachedRolePromise) {
    cachedRolePromise = (getMyRole() as Promise<{ role: string | null }>).catch(() => null);
  }
  return cachedRolePromise;
}

let cachedIntentPromise: Promise<{ role: "caregiver" | "patient" | null } | null> | null = null;
function getCachedIntent() {
  if (!cachedIntentPromise) {
    cachedIntentPromise = (getIntendedRole() as Promise<{ role: "caregiver" | "patient" | null }>).catch(() => null);
  }
  return cachedIntentPromise;
}

function hasStoredSession() {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem("companion.auth.token");
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    let user;
    try {
      const { data, error } = await supabase.auth.getUser();
      if ((error || !data.user) && !hasStoredSession()) throw redirect({ to: "/auth" });
      user = data.user;
    } catch (e) {
      if (isRedirect(e)) throw e;
      // If the auth client hiccups but a browser session exists, allow the
      // server functions to validate the token instead of bouncing to /auth.
      if (!hasStoredSession()) throw redirect({ to: "/auth" });
    }
    // Clinicians may only see the physician summary view. Use cached role so
    // we don't block every navigation on a server call.
    try {
      const r = await getCachedRole();
      if (r?.role === "clinician" && !location.pathname.startsWith("/summary")) {
        throw redirect({ to: "/summary" });
      }
    } catch (e) {
      if (isRedirect(e)) throw e;
      // ignore role lookup failures so the user can still load the app
    }
    // If the user signed up as a patient, send them to the patient home
    // instead of any caregiver page (they can still be deep-linked back by a
    // caregiver once invited).
    try {
      const intent = await getCachedIntent();
      if (intent?.role === "patient") {
        // /patient is outside _authenticated, so any nav under here for a
        // patient should bounce back to their home.
        throw redirect({ to: "/patient" });
      }
    } catch (e) {
      if (isRedirect(e)) throw e;
    }
    return { user };
  },
  component: () => <Outlet />,
});