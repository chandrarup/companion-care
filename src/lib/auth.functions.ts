import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const creds = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(200) });

/** Create an account and return a session. */
export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => creds.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signAccessToken } = await import("@/integrations/db/auth.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password });
    if (error || !created?.user) {
      return { error: error?.code === "23505" ? "An account with that email already exists." : "Could not create account." } as const;
    }
    return { token: await signAccessToken(created.user.id, created.user.email) } as const;
  });

export const signInFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => creds.parse(d))
  .handler(async ({ data }) => {
    const { getPool } = await import("@/integrations/db/pool.server");
    const { checkPassword, signAccessToken } = await import("@/integrations/db/auth.server");
    const { rows } = await getPool().query("SELECT id, email, password_hash FROM auth.users WHERE email = $1", [data.email.toLowerCase()]);
    const u = rows[0];
    const ok = u?.password_hash ? await checkPassword(data.password, u.password_hash) : false;
    if (!ok) return { error: "Incorrect email or password." } as const;
    return { token: await signAccessToken(u.id, u.email) } as const;
  });

const uploadSchema = z.object({
  bucket: z.string().max(64),
  path: z.string().min(1).max(512),
  base64: z.string(),
  contentType: z.string().max(100).optional(),
  upsert: z.boolean().optional(),
});

/** Store a file (RLS on storage.objects checks household membership from the path). */
export const uploadFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => uploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const body = Buffer.from(data.base64, "base64");
    if (body.length > 15 * 1024 * 1024) return { error: "File too large (15MB max)." } as const;
    const { error } = await context.supabase.storage.from(data.bucket).upload(data.path, body, { contentType: data.contentType, upsert: data.upsert });
    return error ? ({ error: error.message } as const) : ({ path: data.path } as const);
  });
