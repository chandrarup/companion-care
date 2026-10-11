// node --env-file=.env scripts/test-isolation.mjs
// For every user with a household: act as that user (role `authenticated`, RLS on) and verify they can see
// NOTHING that belongs to another household — for reads, and that cross-household writes are rejected.
import pg from "pg";
const url = process.env.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
const c = new pg.Client({ connectionString: url, ssl: /tsdb\.cloud|sslmode/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined });
await c.connect();

const members = (await c.query("select user_id, household_id from memberships where deleted_at is null")).rows;
const households = [...new Set(members.map((m) => m.household_id))];
console.log(`${members.length} members across ${households.length} households`);
if (households.length < 2) { console.log("Need >= 2 households to test isolation"); process.exit(2); }

const TABLES = ["patient_profile", "media", "daily_logs", "episodes", "cues", "fingerprint_insights", "physician_summaries", "caregiver_concerns", "household_invitations", "memberships"];
let failures = 0;
const as = async (userId, fn) => {
  await c.query("BEGIN");
  try {
    await c.query(`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '${userId}'`);
    return await fn();
  } finally { await c.query("ROLLBACK"); }
};

for (const m of members) {
  await as(m.user_id, async () => {
    const hh = (await c.query("select count(*)::int n from households where id <> $1", [m.household_id])).rows[0].n;
    if (hh) { failures++; console.log(`FAIL user ${m.user_id.slice(0, 8)} sees ${hh} foreign households`); }
    for (const t of TABLES) {
      const n = (await c.query(`select count(*)::int n from ${t} where household_id <> $1`, [m.household_id])).rows[0].n;
      if (n) { failures++; console.log(`FAIL user ${m.user_id.slice(0, 8)} sees ${n} foreign rows in ${t}`); }
    }
    const nl = (await c.query("select count(*)::int n from log_symptoms ls join daily_logs d on d.id = ls.daily_log_id where d.household_id <> $1", [m.household_id])).rows[0].n;
    if (nl) { failures++; console.log(`FAIL foreign log_symptoms: ${nl}`); }
    const so = (await c.query("select count(*)::int n from storage.objects where name not like $1", [m.household_id + "/%"])).rows[0].n;
    if (so) { failures++; console.log(`FAIL user ${m.user_id.slice(0, 8)} sees ${so} foreign storage objects`); }
  });
  // writes into someone else's household must be rejected
  const other = households.find((h) => h !== m.household_id);
  for (const [label, sql, args] of [
    ["insert daily_log", "insert into daily_logs (household_id, created_by) values ($1, $2)", [other, m.user_id]],
    ["update foreign patient_profile", "update patient_profile set display_name = 'hacked' where household_id = $1", [other]],
    ["join foreign household", "insert into memberships (household_id, user_id, role) values ($1, $2, 'family')", [other, m.user_id]],
  ]) {
    await c.query("BEGIN");
    let ok = false;
    try {
      await c.query(`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '${m.user_id}'`);
      const r = await c.query(sql, args);
      ok = r.rowCount > 0; // an update that touched 0 rows is also safe
    } catch { ok = false; }
    await c.query("ROLLBACK");
    if (ok) { failures++; console.log(`FAIL user ${m.user_id.slice(0, 8)} could ${label}`); }
  }
}
console.log(failures === 0 ? "PASS: every user sees only their own household; cross-household writes rejected" : `${failures} FAILURE(S)`);
await c.end();
process.exit(failures ? 1 : 0);
