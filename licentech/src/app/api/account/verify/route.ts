import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession, hashPassword } from "@/lib/auth";
import { hmac } from "@/lib/crypto";
import { decryptTotpSecret, verifyTotp } from "@/lib/totp";
import { prisma } from "@/lib/prisma";
import { phoneE164 } from "@/lib/validation";

const common = { code: z.string().regex(/^(?:\d{6}|[A-Fa-f0-9]{16})$/) };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("email"), newEmail: z.string().trim().toLowerCase().email().max(120), ...common }),
  z.object({ action: z.literal("phone"), newPhone: phoneE164, ...common }),
  z.object({ action: z.literal("password"), newPassword: z.string().min(10).max(72), ...common }),
  z.object({ action: z.literal("delete"), ...common }),
]);

async function consumeAuthorization(
  tx: Prisma.TransactionClient,
  userId: string,
  step: number | null,
  recoveryCodeId: string | null,
) {
  if (recoveryCodeId) {
    const used = await tx.totpRecoveryCode.updateMany({
      where: { id: recoveryCodeId, userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!used.count) return false;
    await tx.user.update({
      where: { id: userId },
      data: { totpFailedAttempts: 0, totpLockedUntil: null },
    });
    return true;
  }
  if (step === null) return false;
  const used = await tx.user.updateMany({
    where: {
      id: userId,
      OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: BigInt(step) } }],
    },
    data: { totpLastUsedStep: BigInt(step), totpFailedAttempts: 0, totpLockedUntil: null },
  });
  return used.count === 1;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      role: true,
      totpSecretEnc: true,
      totpEnabledAt: true,
      totpLastUsedStep: true,
      totpFailedAttempts: true,
      totpLockedUntil: true,
    },
  });
  if (!user) return NextResponse.json({ error: "La sesión ya no es válida." }, { status: 401 });
  if (!user.totpEnabledAt || !user.totpSecretEnc) {
    return NextResponse.json({ error: "Primero activa una app autenticadora desde tu perfil." }, { status: 403 });
  }
  if (parsed.data.action === "delete" && user.role === "ADMIN") {
    return NextResponse.json({ error: "Por seguridad, una cuenta administradora no se puede eliminar desde el perfil." }, { status: 403 });
  }
  const code = parsed.data.code.toUpperCase();
  const step = /^\d{6}$/.test(code) ? verifyTotp(decryptTotpSecret(user.totpSecretEnc), code) : null;
  const recoveryCode = step === null && /^[A-F0-9]{16}$/.test(code)
    ? await prisma.totpRecoveryCode.findFirst({
      where: { userId: session.userId, codeHash: hmac(`${session.userId}:${code}`), usedAt: null },
      select: { id: true },
    })
    : null;
  if (!recoveryCode && user.totpLockedUntil && user.totpLockedUntil > new Date()) {
    return NextResponse.json({ error: "Se bloquearon temporalmente los códigos. Intenta más tarde." }, { status: 429 });
  }
  if (step === null && !recoveryCode) {
    const attempts = user.totpFailedAttempts + 1;
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        totpFailedAttempts: { increment: 1 },
        ...(attempts >= 5 ? { totpLockedUntil: new Date(Date.now() + 15 * 60_000), totpFailedAttempts: 0 } : {}),
      },
    });
    return NextResponse.json({
      error: attempts >= 5 ? "Demasiados intentos. Espera 15 minutos y vuelve a probar." : "El código no es válido.",
    }, { status: attempts >= 5 ? 429 : 400 });
  }
  if (step !== null && user.totpLastUsedStep !== null && BigInt(step) <= user.totpLastUsedStep) {
    return NextResponse.json({ error: "Ese código ya fue utilizado. Espera al siguiente código de tu app." }, { status: 400 });
  }

  const request = parsed.data;
  if (request.action === "email" && await prisma.user.findUnique({ where: { email: request.newEmail }, select: { id: true } })) {
    return NextResponse.json({ error: "Ese correo ya está registrado." }, { status: 409 });
  }
  if (request.action === "phone" && await prisma.user.findUnique({ where: { phone: request.newPhone }, select: { id: true } })) {
    return NextResponse.json({ error: "Ese teléfono ya está registrado." }, { status: 409 });
  }

  try {
    if (request.action === "email") {
      await prisma.$transaction(async (tx) => {
        if (!await consumeAuthorization(tx, session.userId, step, recoveryCode?.id ?? null)) throw new Error("ACCOUNT_AUTHORIZATION_USED");
        await tx.user.update({ where: { id: session.userId }, data: { email: request.newEmail } });
      });
      return NextResponse.json({ ok: true, message: "Correo actualizado. Usa el correo nuevo para iniciar sesión." });
    }
    if (request.action === "phone") {
      await prisma.$transaction(async (tx) => {
        if (!await consumeAuthorization(tx, session.userId, step, recoveryCode?.id ?? null)) throw new Error("ACCOUNT_AUTHORIZATION_USED");
        await tx.user.update({
          where: { id: session.userId },
          data: { phone: request.newPhone, phoneVerifiedAt: null },
        });
      });
      return NextResponse.json({ ok: true, message: "Teléfono actualizado. Quedará marcado como no verificado hasta comprobarlo por SMS." });
    }
    if (request.action === "password") {
      const passwordHash = await hashPassword(request.newPassword);
      await prisma.$transaction(async (tx) => {
        if (!await consumeAuthorization(tx, session.userId, step, recoveryCode?.id ?? null)) throw new Error("ACCOUNT_AUTHORIZATION_USED");
        await tx.user.update({ where: { id: session.userId }, data: { passwordHash } });
      });
      return NextResponse.json({ ok: true, message: "Contraseña actualizada." });
    }

    await prisma.$transaction(async (tx) => {
      if (!await consumeAuthorization(tx, session.userId, step, recoveryCode?.id ?? null)) throw new Error("ACCOUNT_AUTHORIZATION_USED");
      await tx.order.updateMany({
        where: { userId: session.userId },
        data: {
          buyerName: "Cuenta eliminada",
          buyerEmail: `deleted-${session.userId}@account.invalid`,
          buyerPhone: "",
          activationEmail: null,
          accessTokenHash: null,
        },
      });
      await tx.walletTopUp.updateMany({
        where: { userId: session.userId },
        data: { userId: null, proofContent: null, proofMimeType: null },
      });
      await tx.walletTransaction.updateMany({
        where: { userId: session.userId },
        data: { userId: null },
      });
      await tx.user.delete({ where: { id: session.userId } });
    });
    cookies().set("session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ese correo o teléfono ya está registrado." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "ACCOUNT_AUTHORIZATION_USED") {
      return NextResponse.json({ error: "El código ya fue utilizado. Espera al siguiente código." }, { status: 409 });
    }
    throw error;
  }
}
