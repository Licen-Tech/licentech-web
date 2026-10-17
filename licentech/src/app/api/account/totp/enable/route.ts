import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hmac } from "@/lib/crypto";
import { decryptTotpSecret, verifyTotp } from "@/lib/totp";
import { prisma } from "@/lib/prisma";

const schema = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ingresa el código de 6 dígitos de tu app." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { totpEnabledAt: true, totpSetupSecretEnc: true, totpFailedAttempts: true, totpLockedUntil: true },
  });
  if (!user) return NextResponse.json({ error: "La sesión ya no es válida." }, { status: 401 });
  if (user.totpEnabledAt) return NextResponse.json({ error: "La app autenticadora ya está activada." }, { status: 409 });
  if (!user.totpSetupSecretEnc) return NextResponse.json({ error: "Primero solicita la configuración de la app." }, { status: 400 });
  if (user.totpLockedUntil && user.totpLockedUntil > new Date()) {
    return NextResponse.json({ error: "Se bloquearon temporalmente los códigos. Intenta más tarde." }, { status: 429 });
  }

  const step = verifyTotp(decryptTotpSecret(user.totpSetupSecretEnc), parsed.data.code);
  if (step === null) {
    const attempts = user.totpFailedAttempts + 1;
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        totpFailedAttempts: { increment: 1 },
        ...(attempts >= 5 ? { totpLockedUntil: new Date(Date.now() + 15 * 60_000), totpFailedAttempts: 0 } : {}),
      },
    });
    return NextResponse.json({
      error: attempts >= 5
        ? "Demasiados intentos. Espera 15 minutos y vuelve a probar."
        : "El código no es válido. Revisa que la hora del teléfono esté sincronizada.",
    }, { status: attempts >= 5 ? 429 : 400 });
  }
  const enabledAt = new Date();
  const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(8).toString("hex").toUpperCase());
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: session.userId, totpEnabledAt: null },
      data: {
        totpSecretEnc: user.totpSetupSecretEnc,
        totpSetupSecretEnc: null,
        totpEnabledAt: enabledAt,
        totpLastUsedStep: BigInt(step),
        totpFailedAttempts: 0,
        totpLockedUntil: null,
      },
    });
    if (result.count) {
      await tx.totpRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({ userId: session.userId, codeHash: hmac(`${session.userId}:${code}`) })),
      });
    }
    return result;
  });
  if (!updated.count) return NextResponse.json({ error: "La configuración ya fue completada." }, { status: 409 });
  return NextResponse.json({ ok: true, enabledAt, recoveryCodes });
}
