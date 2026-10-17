import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decryptTotpSecret, encryptTotpSecret, createTotpSecret, totpSetupUri } from "@/lib/totp";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para configurar la app autenticadora." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, totpEnabledAt: true, totpSetupSecretEnc: true },
  });
  if (!user) return NextResponse.json({ error: "La sesión ya no es válida." }, { status: 401 });
  if (user.totpEnabledAt) return NextResponse.json({ error: "La app autenticadora ya está activada." }, { status: 409 });

  const secret = user.totpSetupSecretEnc
    ? decryptTotpSecret(user.totpSetupSecretEnc)
    : createTotpSecret();
  if (!user.totpSetupSecretEnc) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { totpSetupSecretEnc: encryptTotpSecret(secret) },
    });
  }
  return NextResponse.json(
    { secret, uri: totpSetupUri(secret, user.email) },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
