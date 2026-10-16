import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cardCheckoutSchema } from "@/lib/validation";
import { createWebCheckoutUrl } from "@/lib/wompi";
import { createOrderAccess } from "@/lib/order-access";
import { normalizeCheckoutItems, resolveCheckoutItems } from "@/lib/checkout";
import { checkoutPrice } from "@/lib/checkout-pricing";

export async function POST(req: Request) {
  const session = await getSession();

  const parsed = cardCheckoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

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
  const orderAccess = createOrderAccess(reference);
  let checkoutUrl: ReturnType<typeof createWebCheckoutUrl>;
  try {
    checkoutUrl = createWebCheckoutUrl(reference, amountCop, buyer.buyerEmail, orderAccess.trackingUrl);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      error: "Revisa que las llaves y secretos de Wompi sean válidos y pertenezcan todos al mismo entorno (Sandbox o Producción).",
    }, { status: 503 });
  }

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

  return NextResponse.json({ checkoutUrl });
}
