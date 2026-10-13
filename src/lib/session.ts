import { jwtVerify, SignJWT } from "jose";

export type Role = "admin" | "field";
export type SessionPayload = { userId: number; role: Role; name: string };

export const SESSION_COOKIE = "pintu_session";
const MAX_AGE = 60 * 60 * 24 * 7;

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, key(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};

export const homeFor = (role: Role) => (role === "admin" ? "/admin" : "/lapangan");
