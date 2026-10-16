import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { paymentMethodConfigSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = paymentMethodConfigSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const current = await prisma.paymentMethodConfig.findUnique({ where: { id: params.id }, select: { code: true } });
  if (!current) return NextResponse.json({ error: "No encontramos el método de pago." }, { status: 404 });
  if (parsed.data.code !== current.code) return NextResponse.json({ error: "El código no se puede cambiar porque puede estar asociado a compras anteriores." }, { status: 409 });
  const updated = await prisma.paymentMethodConfig.updateMany({ where: { id: params.id }, data: parsed.data });
  if (!updated.count) return NextResponse.json({ error: "No encontramos el método de pago." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const method = await prisma.paymentMethodConfig.findUnique({ where: { id: params.id }, select: { code: true } });
  if (!method) return NextResponse.json({ error: "No encontramos el método de pago." }, { status: 404 });
  const [orders, topUps] = await Promise.all([
    prisma.order.count({ where: { paymentMethod: method.code } }),
    prisma.walletTopUp.count({ where: { paymentMethod: method.code } }),
  ]);
  if (orders || topUps) return NextResponse.json({ error: "Este método tiene historial. Desactívalo en lugar de eliminarlo." }, { status: 409 });
  const deleted = await prisma.paymentMethodConfig.deleteMany({ where: { id: params.id } });
  if (!deleted.count) return NextResponse.json({ error: "El método ya fue eliminado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
