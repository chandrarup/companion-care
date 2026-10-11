import { getRequest } from "@tanstack/react-start/server";

// Tiny in-memory sliding-window limiter for the public (no-login) demo endpoints.
const hits = new Map<string, number[]>();

export function clientIp(): string {
  const h = getRequest()?.headers;
  return (h?.get("cf-connecting-ip") || h?.get("x-forwarded-for")?.split(",")[0] || h?.get("x-real-ip") || "unknown").trim();
}

/** true = allowed. */
export function allow(bucket: string, limit: number, windowMs: number): boolean {
  const key = `${bucket}:${clientIp()}`;
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
