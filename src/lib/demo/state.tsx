import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type DemoRole = "patient" | "caregiver";

type DemoState = {
  active: boolean;
  role: DemoRole | null;
  setRole: (r: DemoRole | null) => void;
  exit: () => void;
};

const Ctx = createContext<DemoState | null>(null);
const STORAGE_KEY = "companion.demo.v1";

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DemoRole | null>(() => {
    if (typeof window === "undefined") return null;
    try { return (window.localStorage.getItem(STORAGE_KEY) as DemoRole | null) || null; } catch { return null; }
  });

  const setRole = useCallback((r: DemoRole | null) => {
    setRoleState(r);
    try {
      if (r) window.localStorage.setItem(STORAGE_KEY, r);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const exit = useCallback(() => setRole(null), [setRole]);

  const value = useMemo(() => ({ active: !!role, role, setRole, exit }), [role, setRole, exit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}

/** Convenience to detect whether the URL is under /demo without router import. */
export function useIsDemoRoute() {
  const [is, setIs] = useState(() => typeof window !== "undefined" && window.location.pathname.startsWith("/demo"));
  useEffect(() => {
    const update = () => setIs(window.location.pathname.startsWith("/demo"));
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return is;
}
