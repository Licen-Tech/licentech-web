import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const cartSchema = z.object({
  productIds: z.array(z.string().cuid()).min(1).max(10),
});

export async function POST(req: Request) {
  const parsed = cartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "El carrito no contiene productos válidos." }, { status: 400 });

  const products = await prisma.product.findMany({
    where: { id: { in: Array.from(new Set(parsed.data.productIds)) }, active: true },
    select: {
      id: true,
      slug: true,
      name: true,
      priceCop: true,
      deliveryType: true,
      creditAmount: true,
      _count: { select: { licenses: { where: { status: "AVAILABLE" } } } },
      rentalOptions: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { quantity: "asc" }],
        select: { id: true, quantity: true, unit: true, priceCop: true },
      },
    },
  });
  return NextResponse.json(products.map(({ _count, ...product }) => ({
    ...product,
    availableStock: product.deliveryType === "LICENSE_KEY" ? _count.licenses : null,
  })));
}
