import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { pseSchema } from "@/lib/validation";
import { createPseTransaction } from "@/lib/wompi";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Inicia sesión para comprar" }, { status: 401 });
  const parsed = pseSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const [user, product] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: s.userId } }),
    prisma.product.findUnique({ where: { id: d.productId } }),
  ]);
  if (!product?.active) return NextResponse.json({ error: "Producto no disponible" }, { status: 404 });
  // Opcional: exigir celular verificado antes de comprar
  // if (!user.phoneVerifiedAt) return NextResponse.json({ error: "Verifica tu celular" }, { status: 403 });

  const stock = await prisma.license.count({ where: { productId: product.id, status: "AVAILABLE" } });
  if (stock < d.quantity) return NextResponse.json({ error: "Stock insuficiente" }, { status: 409 });

  // El precio SIEMPRE sale de la BD, nunca del cliente
  const amountCop = product.priceCop * d.quantity;
  const reference = `LT-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const order = await prisma.order.create({
    data: { reference, userId: user.id, productId: product.id, quantity: d.quantity, amountCop },
  });

  try {
    const tx = await createPseTransaction({
      reference, amountCop, email: user.email, userType: d.userType,
      idType: d.idType, idNumber: d.idNumber, bankCode: d.bankCode,
      description: `${product.name} ${product.version}`,
    });
    await prisma.order.update({ where: { id: order.id }, data: { wompiTxId: tx.id } });
    return NextResponse.json({ url: tx.url }); // el frontend redirige al banco
  } catch (e) {
    console.error(e);
    await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "No pudimos iniciar el pago, intenta de nuevo" }, { status: 502 });
  }
}
