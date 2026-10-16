import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hmac } from "@/lib/crypto";
import { phoneCO } from "@/lib/validation";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const parsed = z.object({ phone: phoneCO, code: z.string().regex(/^\d{6}$/) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { phone, code } = parsed.data;

  const rec = await prisma.phoneCode.findFirst({
    where: { userId: s.userId, phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!rec || rec.attempts >= 5) return NextResponse.json({ error: "Código vencido o bloqueado, pide uno nuevo" }, { status: 400 });

  const expected = Buffer.from(hmac(`${s.userId}:${phone}:${code}`));
  const ok = timingSafeEqual(expected, Buffer.from(rec.codeHash));
  if (!ok) {
    await prisma.phoneCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
  }
  try {
    await prisma.$transaction([
      prisma.phoneCode.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: s.userId }, data: { phone, phoneVerifiedAt: new Date() } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ese celular ya está en uso" }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
