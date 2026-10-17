import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { checkPassword, createSession } from "@/lib/auth";

const DUMMY_HASH = bcrypt.hashSync("dummy-password", 12); // iguala el tiempo de respuesta si el correo no existe

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = await checkPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  await createSession(user);
  return NextResponse.json({ ok: true, redirectTo: user.role === "ADMIN" ? "/admin" : "/" });
}
