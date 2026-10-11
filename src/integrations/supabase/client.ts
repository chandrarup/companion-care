// Browser-side session + storage client. Keeps the supabase-js-shaped surface
// (auth.getSession / onAuthStateChange / signInWithPassword / signOut,
// storage.from().upload) the UI already uses, backed by our own auth endpoints.
import { signInFn, signUpFn, uploadFileFn } from "@/lib/auth.functions";

const KEY = "companion.auth.token";
type Listener = (event: "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "INITIAL_SESSION", session: Session | null) => void;
export interface Session { access_token: string; user: { id: string; email?: string } }

const listeners = new Set<Listener>();

function decode(token: string): { sub: string; email?: string; exp?: number } | null {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch {
    return null;
  }
}

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem(KEY);
    if (!token) return null;
    const c = decode(token);
    if (!c || (c.exp && c.exp * 1000 < Date.now())) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return { access_token: token, user: { id: c.sub, email: c.email } };
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {}
  const s = readSession();
  listeners.forEach((l) => l(s ? "SIGNED_IN" : "SIGNED_OUT", s));
}

const fail = (message: string) => ({ data: { session: null, user: null }, error: { message } });

async function finish(r: { token?: string; error?: string }) {
  if (!r.token) return fail(r.error ?? "Authentication failed");
  setToken(r.token);
  const s = readSession();
  return { data: { session: s, user: s?.user ?? null }, error: null };
}

const toBase64 = async (blob: Blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
};

export const supabase = {
  auth: {
    async getSession() {
      return { data: { session: readSession() }, error: null };
    },
    async getUser() {
      const s = readSession();
      return s ? { data: { user: s.user }, error: null } : { data: { user: null }, error: { message: "Not signed in" } };
    },
    onAuthStateChange(cb: Listener) {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => { listeners.delete(cb); } } } };
    },
    async signInWithPassword(c: { email: string; password: string }) {
      return finish(await signInFn({ data: c }));
    },
    async signUp(c: { email: string; password: string }) {
      return finish(await signUpFn({ data: c }));
    },
    async signOut() {
      setToken(null);
      return { error: null };
    },
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: Blob, opts?: { contentType?: string; upsert?: boolean }) {
          const r = await uploadFileFn({
            data: { bucket, path, base64: await toBase64(file), contentType: opts?.contentType ?? file.type, upsert: opts?.upsert },
          });
          return "error" in r ? { data: null, error: { message: r.error } } : { data: { path }, error: null };
        },
      };
    },
  },
};

export function getStoredAccessToken() {
  return readSession()?.access_token;
}
