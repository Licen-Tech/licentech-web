import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrderAccess } from "@/lib/order-access";
import { walletCheckoutSchema } from "@/lib/validation";
import { fulfillOrder } from "@/lib/fulfillment";
import { normalizeCheckoutItems, resolveCheckoutItems } from "@/lib/checkout";
import { checkoutPrice } from "@/lib/checkout-pricing";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para pagar con saldo." }, { status: 401 });
  const parsed = walletCheckoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const lines = normalizeCheckoutItems(parsed.data);
  const [user, resolved] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, phone: true } }),
    resolveCheckoutItems(lines),
  ]);
  if (!user) return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });
  if (!resolved.lines) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const subtotalCop = resolved.lines.reduce((sum, line) => sum + line.unitPriceCop * line.quantity, 0);
  const amountCop = checkoutPrice(subtotalCop).totalCop;
  const reference = `LT-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const access = createOrderAccess(reference);
  const order = await prisma.$transaction(async (tx) => {
    const charged = await tx.user.updateMany({
      where: { id: user.id, walletBalanceCop: { gte: amountCop } },
      data: { walletBalanceCop: { decrement: amountCop } },
    });
    if (!charged.count) return null;
    const created = await tx.order.create({
      data: {
        reference,
        userId: user.id,
        buyerName: user.name,
        buyerEmail: user.email,
        buyerPhone: user.phone ?? "No indicado",
        activationEmail: resolved.lines[0]?.activationEmail,
        accessTokenHash: access.accessTokenHash,
        productId: resolved.lines[0].productId,
        quantity: resolved.lines.reduce((sum, line) => sum + line.quantity, 0),
        amountCop,
        status: "REVIEW",
        paymentMethod: "WALLET",
        items: {
          create: resolved.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPriceCop: line.unitPriceCop,
            activationEmail: line.activationEmail,
            rentalDuration: line.rentalDuration,
            rentalUnit: line.rentalUnit,
          })),
        },
      },
    });
    await tx.walletTransaction.create({
      data: { userId: user.id, amountCop: -amountCop, description: `Compra ${reference}`, orderId: created.id },
    });
    return created;
  });
  if (!order) return NextResponse.json({ error: "No tienes saldo suficiente para esta compra." }, { status: 409 });

  const result = await fulfillOrder(order.id, undefined, "WALLET");
  if (result === "no_stock") {
    await prisma.$transaction(async (tx) => {
      const refundExists = await tx.walletTransaction.findFirst({
        where: { orderId: order.id, amountCop: { gt: 0 } },
        select: { id: true },
      });
      if (refundExists) return;
      await tx.user.update({ where: { id: user.id }, data: { walletBalanceCop: { increment: amountCop } } });
      await tx.walletTransaction.create({
        data: { userId: user.id, amountCop, description: `Reintegro por falta de stock ${reference}`, orderId: order.id },
      });
    });
  }

  return NextResponse.json({ reference, trackingUrl: access.trackingUrl, result }, { status: 201 });
}
