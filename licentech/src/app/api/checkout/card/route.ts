import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cardCheckoutSchema } from "@/lib/validation";
import { createWebCheckoutUrl } from "@/lib/wompi";
import { createOrderAccess } from "@/lib/order-access";
import { normalizeCheckoutItems, resolveCheckoutItems } from "@/lib/checkout";
import { checkoutPrice } from "@/lib/checkout-pricing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();

  const parsed = cardCheckoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos del comprador: nombre, correo y WhatsApp son obligatorios." }, { status: 400 });

  const lines = normalizeCheckoutItems(parsed.data);
  const [user, resolved] = await Promise.all([
    session ? prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }) : null,
    resolveCheckoutItems(lines),
  ]);
  if (session && !user) return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });
  if (!resolved.lines) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const buyer = parsed.data;

  const subtotalCop = resolved.lines.reduce((sum, line) => sum + line.unitPriceCop * line.quantity, 0);
  const amountCop = checkoutPrice(subtotalCop).totalCop;
  const reference = `LT-${Date.now()}-${randomBytes(4).toString("hex")}`;

  let orderAccess: ReturnType<typeof createOrderAccess>;
  let checkoutUrl: string;
  try {
    orderAccess = createOrderAccess(reference, new URL(req.url).origin);
    checkoutUrl = createWebCheckoutUrl(reference, amountCop, buyer.buyerEmail, orderAccess.trackingUrl);
  } catch (error) {
    // El detalle (qué variable falta) queda en los logs del servidor, no en la página del comprador.
    console.error("Error creando el checkout de Wompi:", error);
    return NextResponse.json({
      error: "El pago con tarjeta no está disponible en este momento. Usa el pago manual o inténtalo más tarde.",
    }, { status: 503 });
  }

  try {
    await prisma.order.create({
      data: {
        reference,
        userId: user?.id,
        buyerName: buyer.buyerName,
        buyerEmail: buyer.buyerEmail,
        buyerPhone: buyer.buyerPhone,
        activationEmail: resolved.lines[0]?.activationEmail,
        accessTokenHash: orderAccess.accessTokenHash,
        productId: resolved.lines[0].productId,
        quantity: resolved.lines.reduce((sum, line) => sum + line.quantity, 0),
        amountCop,
        paymentMethod: "CARD",
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
  } catch (error) {
    console.error("No se pudo guardar el pedido (tarjeta):", error);
    return NextResponse.json({ error: "No pudimos guardar tu pedido. Inténtalo de nuevo en unos minutos." }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl });
}
