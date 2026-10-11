// Deletes cloned demo voices older than 3 hours (from ElevenLabs and from our table). Run every 15 minutes on the server:
//   cd /opt/companion-care/tools && node --env-file=/etc/companion-care.env cleanup-demo-voices.mjs
// (deploy/setup-server.sh installs the `pg` package in /opt/companion-care/tools.)
// The app also does this opportunistically whenever someone clones a voice; this job makes the "deleted after a few hours" promise hold even when nobody does.
import pg from "pg";

const TTL_HOURS = 3;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query("SELECT id, voice_id FROM public.demo_voices WHERE created_at < now() - ($1 || ' hours')::interval", [TTL_HOURS]);
  let removed = 0;
  for (const r of rows) {
    const resp = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(r.voice_id)}`, { method: "DELETE", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    // 200 = deleted; 400/404/422 = unknown or already gone. Anything else: keep the row and retry next run.
    if (resp && (resp.ok || resp.status === 400 || resp.status === 404 || resp.status === 422)) {
      await client.query("DELETE FROM public.demo_voices WHERE id = $1", [r.id]);
      removed++;
    } else console.warn(`[cleanup] could not delete voice …${String(r.voice_id).slice(-4)} (status ${resp?.status ?? "no response"})`);
  }
  console.log(`${new Date().toISOString()} demo voices: ${rows.length} expired, ${removed} removed`);
} finally {
  await client.end();
}
