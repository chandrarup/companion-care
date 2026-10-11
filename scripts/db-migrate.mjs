// Usage: node --env-file=.env scripts/db-migrate.mjs
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const client = new pg.Client({ connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""), ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
await client.connect();

const run = async (name, sql) => {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO public._migrations(name) VALUES ($1) ON CONFLICT DO NOTHING", [name]);
    await client.query("COMMIT");
    console.log("applied", name);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("FAILED", name, e.message);
    process.exit(1);
  }
};

await client.query(fs.readFileSync("db/00_bootstrap.sql", "utf8"));
const done = new Set((await client.query("SELECT name FROM public._migrations")).rows.map((r) => r.name));
const files = [
  ...fs.readdirSync("db/schema").sort().map((f) => path.join("db/schema", f)),
  ...(fs.existsSync("db/migrations") ? fs.readdirSync("db/migrations").sort().map((f) => path.join("db/migrations", f)) : []),
];
for (const f of files) {
  if (!done.has(path.basename(f))) await run(path.basename(f), fs.readFileSync(f, "utf8"));
}
await client.end();
console.log("done");
