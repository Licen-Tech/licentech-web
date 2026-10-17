import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hmac } from "@/lib/crypto";
import { phoneE164 } from "@/lib/validation";
import { sendSms } from "@/lib/sms";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const parsed = z.object({ phone: phoneE164 }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Celular inválido" }, { status: 400 });
  const { phone } = parsed.data;

  const last = await prisma.phoneCode.findFirst({ where: { userId: s.userId }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < 60_000)
    return NextResponse.json({ error: "Espera 1 minuto para pedir otro código" }, { status: 429 });

  const code = randomInt(100000, 1000000).toString();
  await prisma.phoneCode.create({
    data: { userId: s.userId, phone, codeHash: hmac(`${s.userId}:${phone}:${code}`), expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  await sendSms(phone, `LicenTech Colombia: tu código es ${code}. Vence en 10 minutos.`);
  return NextResponse.json({ ok: true });
}
