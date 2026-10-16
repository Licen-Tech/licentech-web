import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { productSchema } from "@/lib/validation";

const forbidden = () => NextResponse.json({ error: "No autorizado" }, { status: 403 });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return forbidden();
  const parsed = productSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await prisma.product.update({ where: { id: params.id }, data: parsed.data }));
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return forbidden();
  // Con ventas históricas solo se archiva (no se pierde el historial de compras)
  if (await prisma.order.count({ where: { productId: params.id } })) {
    await prisma.product.update({ where: { id: params.id }, data: { active: false } });
    return NextResponse.json({ archived: true });
  }
  await prisma.$transaction([
    prisma.license.deleteMany({ where: { productId: params.id } }),
    prisma.product.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ deleted: true });
}
