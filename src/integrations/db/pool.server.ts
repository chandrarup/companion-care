import pg from "pg";

// Return JS-friendly values like PostgREST/supabase-js did.
pg.types.setTypeParser(1082, (v) => v); // date -> 'YYYY-MM-DD'
pg.types.setTypeParser(1114, (v) => new Date(v.replace(" ", "T") + "Z").toISOString()); // timestamp
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // numeric
pg.types.setTypeParser(20, (v) => Number(v)); // int8

let _pool: pg.Pool | undefined;

/** Read inside functions only (env binds per-request on some runtimes). */
export function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing DATABASE_URL (Tiger Data connection string)");
    _pool = new pg.Pool({
      // pg treats sslmode=require as verify-full; strip it and pass the ssl option ourselves.
      connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
      max: 10,
      ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return _pool;
}

const typeCache = new Map<string, Map<string, string>>();
/** column -> data_type for a table (used to JSON-encode jsonb params). */
export async function columnTypes(table: string) {
  let m = typeCache.get(table);
  if (!m) {
    const { rows } = await getPool().query(
      "select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1",
      [table],
    );
    m = new Map(rows.map((r) => [r.column_name as string, r.data_type as string]));
    typeCache.set(table, m);
  }
  return m;
}
