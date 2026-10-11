import { getPool } from "./pool.server";
import { makeQueryClient } from "./query.server";
import { hashPassword, signFileToken } from "./auth.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Run a query as the user (RLS applies) or as owner (admin). */
async function withRole<T>(userId: string | null, fn: (q: (sql: string, p?: any[]) => Promise<any>) => Promise<T>) {
  const client = await getPool().connect();
  try {
    if (userId) {
      if (!UUID_RE.test(userId)) throw new Error("Invalid user id");
      await client.query(
        `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '${userId}'; SET LOCAL request.jwt.claim.role = 'authenticated';`,
      );
    }
    try {
      const out = await fn((sql, p) => client.query(sql, p));
      if (userId) await client.query("COMMIT");
      return out;
    } catch (e) {
      if (userId) await client.query("ROLLBACK").catch(() => {});
      throw e;
    }
  } finally {
    client.release();
  }
}

function storageApi(userId: string | null) {
  return {
    from(bucket: string) {
      return {
        async upload(path: string, body: Buffer | Uint8Array, opts?: { contentType?: string; upsert?: boolean }) {
          try {
            await withRole(userId, (q) =>
              q(
                `INSERT INTO storage.objects (bucket_id, name, owner, metadata, data)
                 VALUES ($1, $2, $3, $4::jsonb, $5)
                 ${opts?.upsert ? "ON CONFLICT (bucket_id, name) DO UPDATE SET data = EXCLUDED.data, metadata = EXCLUDED.metadata, updated_at = now()" : ""}`,
                [bucket, path, userId, JSON.stringify({ mimetype: opts?.contentType ?? "application/octet-stream", size: body.length }), Buffer.from(body)],
              ),
            );
            return { data: { path }, error: null };
          } catch (e: any) {
            return { data: null, error: { message: e?.message ?? "upload failed" } };
          }
        },
        async createSignedUrl(path: string, ttlSeconds: number) {
          try {
            // Visibility check goes through RLS for user clients.
            const rows = await withRole(userId, async (q) => (await q("SELECT 1 FROM storage.objects WHERE bucket_id = $1 AND name = $2", [bucket, path])).rows);
            if (rows.length === 0) return { data: null, error: { message: "Object not found" } };
            const token = await signFileToken(bucket, path, ttlSeconds);
            return { data: { signedUrl: `/api/files/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}?token=${token}` }, error: null };
          } catch (e: any) {
            return { data: null, error: { message: e?.message ?? "sign failed" } };
          }
        },
        async remove(paths: string[]) {
          try {
            await withRole(userId, (q) => q("DELETE FROM storage.objects WHERE bucket_id = $1 AND name = ANY($2)", [bucket, paths]));
            return { data: null, error: null };
          } catch (e: any) {
            return { data: null, error: { message: e?.message } };
          }
        },
      };
    },
  };
}

/** User-scoped client: same surface the app used from supabase-js, RLS enforced. */
export function createUserClient(userId: string) {
  return { ...makeQueryClient(userId), storage: storageApi(userId) };
}

/** Owner client (bypasses RLS) + minimal auth.admin helpers. */
function createAdminClient() {
  return {
    ...makeQueryClient(null),
    storage: storageApi(null),
    auth: {
      admin: {
        async createUser(opts: { email: string; password?: string; email_confirm?: boolean; user_metadata?: Record<string, unknown> }) {
          try {
            const hash = opts.password ? await hashPassword(opts.password) : null;
            const { rows } = await getPool().query(
              "INSERT INTO auth.users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3::jsonb) RETURNING id, email",
              [opts.email.toLowerCase(), hash, JSON.stringify(opts.user_metadata ?? {})],
            );
            return { data: { user: rows[0] }, error: null };
          } catch (e: any) {
            return { data: null, error: { message: e?.message ?? "createUser failed", code: e?.code } };
          }
        },
        /** No mail server in this stack; the invite row + signup-time trigger attach the user. */
        async inviteUserByEmail(email: string, _opts?: unknown) {
          console.info(`[invite] ${email} will be attached to the household when they sign up with this email.`);
          return { data: null, error: null };
        },
      },
    },
  };
}

let _admin: ReturnType<typeof createAdminClient> | undefined;
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_, prop, receiver) {
    _admin ??= createAdminClient();
    return Reflect.get(_admin, prop, receiver);
  },
});
