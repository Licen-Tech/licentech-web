import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { walletTopUpSchema } from "@/lib/validation";

export const runtime = "nodejs";
const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const proofTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para consultar tu saldo." }, { status: 401 });
  const [user, topUps, methods] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { walletBalanceCop: true } }),
    prisma.walletTopUp.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, amountCop: true, paymentMethod: true, reference: true, status: true, createdAt: true },
    }),
    prisma.paymentMethodConfig.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true, instructions: true },
    }),
  ]);
  if (!user) return NextResponse.json({ error: "La sesión no es válida." }, { status: 401 });
  return NextResponse.json({ balanceCop: user.walletBalanceCop, topUps, methods });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para recargar saldo." }, { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer la solicitud de recarga." }, { status: 400 });
  }
  const parsed = walletTopUpSchema.safeParse({
    amountCop: Number(form.get("amountCop")),
    paymentMethod: form.get("paymentMethod"),
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [user, method] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }),
    prisma.paymentMethodConfig.findUnique({ where: { code: parsed.data.paymentMethod }, select: { active: true } }),
  ]);
  if (!user) return NextResponse.json({ error: "La sesión no es válida." }, { status: 401 });
  if (!method?.active) return NextResponse.json({ error: "Este método de pago no está disponible." }, { status: 400 });

  const proof = form.get("proof");
  if (!(proof instanceof File) || !proofTypes.has(proof.type) || proof.size === 0 || proof.size > MAX_PROOF_SIZE) {
    return NextResponse.json({ error: "Adjunta un comprobante JPG, PNG, WEBP o PDF de máximo 5 MB." }, { status: 400 });
  }
  const reference = `LTW-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const topUp = await prisma.walletTopUp.create({
    data: {
      userId: user.id,
      amountCop: parsed.data.amountCop,
      paymentMethod: parsed.data.paymentMethod,
      reference,
      status: "REVIEW",
      proofContent: Buffer.from(await proof.arrayBuffer()),
      proofMimeType: proof.type,
    },
    select: { reference: true, status: true },
  });
  return NextResponse.json(topUp, { status: 201 });
}
