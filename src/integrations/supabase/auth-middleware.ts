import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/** Verifies the bearer JWT and exposes a user-scoped (RLS-enforced) DB client. */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");
  const token = authHeader.slice(7);
  if (!token) throw new Error("Unauthorized: No token provided");

  const { verifyAccessToken } = await import("../db/auth.server");
  const { createUserClient } = await import("../db/client.server");
  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw new Error("Unauthorized: Invalid token");
  }
  return next({
    context: {
      supabase: createUserClient(claims.sub),
      userId: claims.sub,
      claims: claims as { sub: string; email?: string; iss?: string },
    },
  });
});
