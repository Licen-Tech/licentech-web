import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { productSchema } from "@/lib/validation";

const forbidden = () => NextResponse.json({ error: "No autorizado" }, { status: 403 });

export async function GET() {
  if (!(await requireAdmin())) return forbidden();
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { licenses: { where: { status: "AVAILABLE" } } } } },
  });
  return NextResponse.json(products.map(({ _count, ...p }) => ({ ...p, stock: _count.licenses })));
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return forbidden();
  const parsed = productSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    return NextResponse.json(await prisma.product.create({ data: parsed.data }), { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
    throw e;
  }
}
