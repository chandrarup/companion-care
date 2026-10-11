import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

function secret() {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_JWT_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
}

export async function signAccessToken(userId: string, email: string) {
  return new SignJWT({ email, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (!payload.sub) throw new Error("Unauthorized: No user ID found in token");
  return payload as typeof payload & { sub: string; email?: string };
}

/** Short-lived signed token that grants read access to one storage object. */
export async function signFileToken(bucket: string, path: string, ttlSeconds: number) {
  return new SignJWT({ b: bucket, p: path })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret());
}
export async function verifyFileToken(token: string) {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  return { bucket: payload.b as string, path: payload.p as string };
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** Opaque 3-hour token proving a demo visitor owns a temporary cloned voice. */
export async function signDemoVoiceToken(voiceId: string) {
  return new SignJWT({ dv: voiceId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("3h").sign(secret());
}
export async function verifyDemoVoiceToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.dv === "string" ? payload.dv : null;
  } catch {
    return null;
  }
}
