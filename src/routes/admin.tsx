import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loadDemoData, resetDemoData, createDemoSession } from "@/lib/demo.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Companion Care" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const load = useServerFn(loadDemoData);
  const reset = useServerFn(resetDemoData);
  const createSession = useServerFn(createDemoSession);
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [demoFlag, setDemoFlag] = useState(false);

  useEffect(() => {
    try {
      supabase.auth
        .getUser()
        .then(({ data }) => setSignedIn(!!data.user))
        .catch(() => setSignedIn(false));
    } catch {
      setSignedIn(false);
    }
    setDemoFlag(window.localStorage.getItem("companion.demo") === "1");
  }, []);

  async function handleLoad() {
    setBusy(true);
    try {
      if (!signedIn) {
        setStatus("Creating demo session…");
        const { email, password } = await createSession();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSignedIn(true);
      }
      setStatus("Seeding Rosa Herrera demo household…");
      await load();
      window.localStorage.setItem("companion.demo", "1");
      setDemoFlag(true);
      setStatus("✓ Demo loaded. Redirecting to Today…");
      setTimeout(() => navigate({ to: "/today" }), 800);
    } catch (e: any) {
      setStatus("Error: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setStatus("Removing demo data…");
    try {
      const r = await reset();
      setStatus(`✓ Removed ${r.wiped} demo household(s).`);
    } catch (e: any) {
      setStatus("Error: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  function toggleDemoBadge() {
    const next = !demoFlag;
    setDemoFlag(next);
    window.localStorage.setItem("companion.demo", next ? "1" : "0");
  }

  return (
    <main className="mx-auto max-w-xl p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Admin / Demo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hidden prototype tools. Loads a complete synthetic patient (Rosa Herrera) with
          two weeks of logs, photos, family circle, cues, and pre-computed insights.
        </p>
      </header>

      {signedIn === false && (
        <div className="rounded-md bg-muted p-3 text-sm">
          No sign-in needed — clicking <b>Load Demo Data</b> will create a temporary
          demo account as <b>María Herrera</b> (primary caregiver).
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleLoad}
          disabled={busy || signedIn === null}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground font-medium disabled:opacity-50"
        >
          Load Demo Data
        </button>
        <button
          onClick={handleReset}
          disabled={busy || signedIn === false}
          className="rounded-md border border-input px-4 py-2 font-medium disabled:opacity-50"
        >
          Reset Demo
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={demoFlag} onChange={toggleDemoBadge} />
        Show "demo" badge on cached AI answers
      </label>

      {status && <div className="rounded-md bg-muted p-3 text-sm">{status}</div>}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">What gets seeded</summary>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Household "Rosa Herrera Demo" (Spanish, 3-day edit lock)</li>
          <li>Patient profile with bio, routines, music, triggers</li>
          <li>6 placeholder photos with captions</li>
          <li>Family circle: María (you), Daniel, Dr. Alvarez</li>
          <li>14 daily logs, including 5 afternoon-agitation entries</li>
          <li>Cues (hydration, medication, appointment) with done/missed history</li>
          <li>3 training cards (Alzheimer's Association)</li>
          <li>Fingerprint recomputed — afternoon insight surfaced</li>
        </ul>
      </details>
    </main>
  );
}