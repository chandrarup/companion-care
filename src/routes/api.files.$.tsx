import { createFileRoute } from "@tanstack/react-router";

// Serves stored files (photos, greeting audio) for short-lived signed URLs.
export const Route = createFileRoute("/api/files/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) return new Response("Forbidden", { status: 403 });
        try {
          const { verifyFileToken } = await import("@/integrations/db/auth.server");
          const { getPool } = await import("@/integrations/db/pool.server");
          const { bucket, path } = await verifyFileToken(token);
          const { rows } = await getPool().query("SELECT data, metadata FROM storage.objects WHERE bucket_id = $1 AND name = $2", [bucket, path]);
          if (!rows[0]?.data) return new Response("Not found", { status: 404 });
          return new Response(rows[0].data, {
            headers: {
              "content-type": rows[0].metadata?.mimetype ?? "application/octet-stream",
              "cache-control": "private, max-age=300",
            },
          });
        } catch {
          return new Response("Forbidden", { status: 403 });
        }
      },
    },
  },
});
