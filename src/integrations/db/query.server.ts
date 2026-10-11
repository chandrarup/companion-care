/**
 * A small supabase-js-compatible query builder on top of node-postgres.
 * Covers the subset this app uses: select (incl. one level of embedded
 * relations), insert, update, delete, upsert, eq/neq/is/not/in/gt(e)/lt(e),
 * order, limit, single, maybeSingle and {count, head}.
 *
 * User-scoped clients run every statement inside a transaction as the
 * `authenticated` role with `request.jwt.claim.sub` set, so the Postgres
 * row-level-security policies from the original migrations still apply.
 * The admin client runs as the table owner (bypasses RLS).
 */
import type pg from "pg";
import { columnTypes, getPool } from "./pool.server";

type Rel = { kind: "one" | "many"; table: string; local: string; remote: string };
// parentTable -> embedName -> relation
const RELATIONS: Record<string, Record<string, Rel>> = {
  daily_logs: { log_symptoms: { kind: "many", table: "log_symptoms", local: "id", remote: "daily_log_id" } },
  cue_events: { cues: { kind: "one", table: "cues", local: "cue_id", remote: "id" } },
  log_symptoms: { daily_logs: { kind: "one", table: "daily_logs", local: "daily_log_id", remote: "id" } },
  memberships: {
    households: { kind: "one", table: "households", local: "household_id", remote: "id" },
    users: { kind: "one", table: "users", local: "user_id", remote: "id" },
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENT_RE = /^[a-z_][a-z0-9_]*$/i;
const ident = (s: string) => {
  if (!IDENT_RE.test(s)) throw new Error(`Invalid identifier: ${s}`);
  return `"${s}"`;
};

export type DbResult<T = any> = { data: T; error: { message: string; code?: string } | null; count?: number | null };

interface SelectNode { cols: string[]; embeds: { name: string; table: string; cols: string[]; inner: boolean }[] }

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseSelect(sel: string): SelectNode {
  const node: SelectNode = { cols: [], embeds: [] };
  for (const part of splitTop(sel || "*")) {
    const m = part.match(/^(?:([a-z_]+):)?([a-z_]+)(?::[a-z_]+)?(!inner)?\((.*)\)$/is);
    if (m) {
      // `alias:fkcol(cols)` (alias names the target table) or `table(cols)` / `table!inner(cols)`
      node.embeds.push({ name: m[1] ?? m[2], table: m[1] ?? m[2], cols: splitTop(m[4]), inner: !!m[3] });
    } else node.cols.push(part);
  }
  return node;
}

type Filter = { col: string; op: string; val: any };
type Mode = "select" | "insert" | "update" | "delete" | "upsert";

class Builder implements PromiseLike<DbResult> {
  private mode: Mode = "select";
  private selStr = "*";
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private lim?: number;
  private payload: any;
  private onConflict?: string;
  private wantRows = true;
  private countExact = false;
  private head = false;
  private singleMode: "one" | "maybe" | null = null;

  constructor(private table: string, private userId: string | null) {}

  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.selStr = cols;
    this.wantRows = true;
    if (opts?.count) this.countExact = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(rows: any) { this.mode = "insert"; this.payload = rows; this.wantRows = false; return this; }
  update(row: any) { this.mode = "update"; this.payload = row; this.wantRows = false; return this; }
  upsert(rows: any, opts?: { onConflict?: string }) { this.mode = "upsert"; this.payload = rows; this.onConflict = opts?.onConflict; this.wantRows = false; return this; }
  delete() { this.mode = "delete"; this.wantRows = false; return this; }

  eq(col: string, val: any) { this.filters.push({ col, op: "=", val }); return this; }
  neq(col: string, val: any) { this.filters.push({ col, op: "<>", val }); return this; }
  gt(col: string, val: any) { this.filters.push({ col, op: ">", val }); return this; }
  gte(col: string, val: any) { this.filters.push({ col, op: ">=", val }); return this; }
  lt(col: string, val: any) { this.filters.push({ col, op: "<", val }); return this; }
  lte(col: string, val: any) { this.filters.push({ col, op: "<=", val }); return this; }
  is(col: string, val: null | boolean) { this.filters.push({ col, op: "is", val }); return this; }
  in(col: string, vals: any[]) { this.filters.push({ col, op: "in", val: vals }); return this; }
  not(col: string, op: string, val: any) { this.filters.push({ col, op: `not ${op}`, val }); return this; }
  match(obj: Record<string, any>) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "one"; return this; }

  then<A = DbResult, B = never>(
    onF?: ((v: DbResult) => A | PromiseLike<A>) | null,
    onR?: ((e: any) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.exec().then(onF, onR);
  }

  // ---- SQL generation -------------------------------------------------
  private colExpr(col: string, params: any[], root: SelectNode): string {
    if (!col.includes(".")) return `t.${ident(col)}`;
    const [emb, c] = col.split(".");
    const rel = RELATIONS[this.table]?.[emb];
    if (!rel || rel.kind !== "one") throw new Error(`Unsupported embedded filter ${col}`);
    return `(SELECT x.${ident(c)} FROM ${ident(rel.table)} x WHERE x.${ident(rel.remote)} = t.${ident(rel.local)})`;
  }

  private whereSql(params: any[], root: SelectNode): string {
    const parts: string[] = [];
    for (const f of this.filters) {
      const c = this.colExpr(f.col, params, root);
      if (f.op === "is") parts.push(`${c} IS ${f.val === null ? "NULL" : f.val ? "TRUE" : "FALSE"}`);
      else if (f.op === "not is") parts.push(`${c} IS NOT ${f.val === null ? "NULL" : f.val ? "TRUE" : "FALSE"}`);
      else if (f.op === "in") { params.push(f.val); parts.push(`${c} = ANY($${params.length})`); }
      else if (f.op.startsWith("not ")) throw new Error(`Unsupported operator ${f.op}`);
      else { params.push(f.val); parts.push(`${c} ${f.op} $${params.length}`); }
    }
    for (const e of root.embeds) {
      if (!e.inner) continue;
      const rel = RELATIONS[this.table]?.[e.name];
      if (rel) parts.push(`EXISTS (SELECT 1 FROM ${ident(rel.table)} x WHERE x.${ident(rel.remote)} = t.${ident(rel.local)})`);
    }
    return parts.length ? " WHERE " + parts.join(" AND ") : "";
  }

  private colList(cols: string[], alias: string) {
    if (cols.length === 0 || (cols.length === 1 && cols[0] === "*")) return `${alias}.*`;
    return cols.map((c) => `${alias}.${ident(c.trim())}`).join(", ");
  }

  private selectList(node: SelectNode): string {
    const base = this.colList(node.cols, "t");
    const emb = node.embeds.map((e) => {
      const rel = RELATIONS[this.table]?.[e.name];
      if (!rel) throw new Error(`Unknown relation ${this.table}.${e.name}`);
      const inner = `SELECT ${this.colList(e.cols, "x")} FROM ${ident(rel.table)} x WHERE x.${ident(rel.remote)} = t.${ident(rel.local)}`;
      return rel.kind === "many"
        ? `COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM (${inner}) e), '[]'::jsonb) AS ${ident(e.name)}`
        : `(SELECT to_jsonb(e) FROM (${inner}) e) AS ${ident(e.name)}`;
    });
    const noBase = node.cols.length === 0 && node.embeds.length > 0;
    return [noBase ? "" : base, ...emb].filter(Boolean).join(", ");
  }

  private async encode(rows: any[]): Promise<{ cols: string[]; sqlRows: string[]; params: any[] }> {
    const types = await columnTypes(this.table);
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const params: any[] = [];
    const sqlRows = rows.map((r) =>
      "(" + cols.map((c) => {
        if (!(c in r)) return "DEFAULT";
        const t = types.get(c);
        let v = r[c];
        if (v === undefined) return "DEFAULT";
        if (t === "jsonb" || t === "json") { params.push(v === null ? null : JSON.stringify(v)); return `$${params.length}::${t}`; }
        params.push(v); return `$${params.length}`;
      }).join(", ") + ")",
    );
    return { cols, sqlRows, params };
  }

  private async build(): Promise<{ sql: string; params: any[]; root: SelectNode }> {
    const root = parseSelect(this.selStr);
    const T = ident(this.table);
    const params: any[] = [];
    let sql: string;
    const returning = () => (this.wantRows ? ` RETURNING ${this.colList(root.cols, "t")}` : "");

    if (this.mode === "select") {
      const w = this.whereSql(params, root);
      if (this.head) {
        sql = `SELECT count(*)::int AS count FROM ${T} t${w}`;
      } else {
        const ord = this.orders.length ? " ORDER BY " + this.orders.map((o) => `t.${ident(o.col)} ${o.asc ? "ASC" : "DESC"}`).join(", ") : "";
        const lim = this.lim != null ? ` LIMIT ${Math.max(0, Math.floor(this.lim))}` : this.singleMode ? " LIMIT 2" : "";
        sql = `SELECT ${this.selectList(root)} FROM ${T} t${w}${ord}${lim}`;
      }
    } else if (this.mode === "insert" || this.mode === "upsert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (rows.length === 0) return { sql: "", params, root };
      const enc = await this.encode(rows);
      sql = `INSERT INTO ${T} AS t (${enc.cols.map(ident).join(", ")}) VALUES ${enc.sqlRows.join(", ")}`;
      params.push(...enc.params);
      if (this.mode === "upsert") {
        const conflict = (this.onConflict ?? "id").split(",").map((c) => ident(c.trim())).join(", ");
        const sets = enc.cols.filter((c) => !(this.onConflict ?? "id").split(",").map((s) => s.trim()).includes(c));
        sql += sets.length
          ? ` ON CONFLICT (${conflict}) DO UPDATE SET ${sets.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(", ")}`
          : ` ON CONFLICT (${conflict}) DO NOTHING`;
      }
      sql += returning();
    } else if (this.mode === "update") {
      const types = await columnTypes(this.table);
      const sets: string[] = [];
      for (const [c, v] of Object.entries(this.payload as Record<string, any>)) {
        if (v === undefined) continue;
        const t = types.get(c);
        if (t === "jsonb" || t === "json") { params.push(v === null ? null : JSON.stringify(v)); sets.push(`${ident(c)} = $${params.length}::${t}`); }
        else { params.push(v); sets.push(`${ident(c)} = $${params.length}`); }
      }
      if (sets.length === 0) return { sql: "", params, root };
      const w = this.whereSql(params, root);
      sql = `UPDATE ${T} t SET ${sets.join(", ")}${w}${returning()}`;
    } else {
      const w = this.whereSql(params, root);
      sql = `DELETE FROM ${T} t${w}${returning()}`;
    }
    return { sql, params, root };
  }

  async exec(): Promise<DbResult> {
    let client: pg.PoolClient | undefined;
    try {
      const { sql, params } = await this.build();
      if (!sql) return { data: this.singleMode ? null : [], error: null, count: null };
      client = await getPool().connect();
      if (this.userId) {
        if (!UUID_RE.test(this.userId)) throw new Error("Invalid user id");
        await client.query(
          `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '${this.userId}'; SET LOCAL request.jwt.claim.role = 'authenticated';`,
        );
      }
      let res: pg.QueryResult;
      try {
        res = await client.query(sql, params);
        if (this.userId) await client.query("COMMIT");
      } catch (e) {
        if (this.userId) await client.query("ROLLBACK").catch(() => {});
        throw e;
      }
      if (this.mode === "select" && this.head) {
        return { data: null, error: null, count: res.rows[0]?.count ?? 0 };
      }
      const rows = this.wantRows || this.mode === "select" ? res.rows : [];
      const count = this.countExact ? res.rowCount : null;
      if (this.singleMode) {
        if (rows.length > 1) return { data: null, error: { message: "Multiple rows returned", code: "PGRST116" } };
        if (rows.length === 0) {
          return this.singleMode === "maybe" ? { data: null, error: null } : { data: null, error: { message: "No rows found", code: "PGRST116" } };
        }
        return { data: rows[0], error: null, count };
      }
      return { data: this.wantRows || this.mode === "select" ? rows : null, error: null, count };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e), code: e?.code } };
    } finally {
      client?.release();
    }
  }
}

export function makeQueryClient(userId: string | null) {
  return {
    from(table: string) {
      return new Builder(table, userId);
    },
  };
}
