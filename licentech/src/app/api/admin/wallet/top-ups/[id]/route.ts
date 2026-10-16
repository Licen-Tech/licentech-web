import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return new Response("No autorizado", { status: 403 });
  const topUp = await prisma.walletTopUp.findUnique({
    where: { id: params.id },
    select: { proofContent: true, proofMimeType: true, reference: true },
  });
  if (!topUp?.proofContent || !topUp.proofMimeType) return new Response("Comprobante no encontrado", { status: 404 });
  return new Response(topUp.proofContent, {
    headers: {
      "Content-Type": topUp.proofMimeType,
      "Content-Disposition": `inline; filename="${topUp.reference}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const topUp = await tx.walletTopUp.findUnique({ where: { id: params.id } });
    if (!topUp || topUp.status !== "REVIEW") return false;
    const claimed = await tx.walletTopUp.updateMany({
      where: { id: topUp.id, status: "REVIEW" },
      data: { status: body.action === "approve" ? "APPROVED" : "REJECTED", reviewedAt: new Date() },
    });
    if (!claimed.count) return false;
    if (body.action === "approve") {
      await tx.user.update({ where: { id: topUp.userId }, data: { walletBalanceCop: { increment: topUp.amountCop } } });
      await tx.walletTransaction.create({
        data: {
          userId: topUp.userId,
          amountCop: topUp.amountCop,
          description: `Recarga aprobada (${topUp.reference})`,
          topUpId: topUp.id,
        },
      });
    }
    return true;
  });
  if (!updated) return NextResponse.json({ error: "La recarga ya fue revisada o no existe." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
