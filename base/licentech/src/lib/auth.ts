import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers"; // Next.js 14 (síncrono)
import { prisma } from "./prisma";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

export async function createSession(user: { id: string; role: "USER" | "ADMIN" }) {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  cookies().set("session", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession() {
  const t = cookies().get("session")?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret());
    return { userId: payload.sub as string, role: payload.role as "USER" | "ADMIN" };
  } catch { return null; }
}

// Verifica el rol contra la BD (el JWT puede estar desactualizado si se revoca un admin)
export async function requireAdmin() {
  const s = await getSession();
  if (!s) return null;
  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { role: true } });
  return u?.role === "ADMIN" ? s : null;
}
