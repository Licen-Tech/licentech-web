import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeManualDelivery, fulfillOrder, retryManualDeliveryEmail } from "@/lib/fulfillment";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return new Response("No autorizado", { status: 403 });
  const proof = await prisma.paymentProof.findUnique({ where: { orderId: params.id } });
  if (!proof) return new Response("Comprobante no encontrado", { status: 404 });
  return new Response(proof.content, {
    headers: {
      "Content-Type": proof.mimeType,
      "Content-Disposition": `inline; filename="${proof.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !["approve", "reject", "complete", "resend"].includes(body.action)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (body.action === "approve") {
    const result = await fulfillOrder(params.id);
    if (result === "already") return NextResponse.json({ error: "La orden ya fue revisada." }, { status: 409 });
    return NextResponse.json({ result });
  }

  if (body.action === "complete") {
    const result = await completeManualDelivery(params.id);
    if (result.result === "not_found") return NextResponse.json({ error: "No encontramos la orden." }, { status: 404 });
    if (result.result !== "completed") return NextResponse.json({ error: "La orden no está pendiente de entrega manual." }, { status: 409 });
    return NextResponse.json({ result: result.result, emailSent: result.emailSent });
  }

  if (body.action === "resend") {
    const result = await retryManualDeliveryEmail(params.id);
    if (result === "not_found") return NextResponse.json({ error: "No encontramos la orden." }, { status: 404 });
    if (result === "not_ready") return NextResponse.json({ error: "La orden no está lista para enviar el correo." }, { status: 409 });
    if (result === "failed") return NextResponse.json({ error: "No se pudo enviar el correo. Revisa la configuración de correo e inténtalo de nuevo." }, { status: 502 });
    return NextResponse.json({ result: "sent" });
  }

  const rejected = await prisma.order.updateMany({
    where: { id: params.id, status: "REVIEW" },
    data: { status: "FAILED" },
  });
  if (!rejected.count) return NextResponse.json({ error: "La orden ya fue revisada." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
