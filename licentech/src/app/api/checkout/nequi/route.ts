import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { nequiCheckoutSchema } from "@/lib/validation";
import { createOrderAccess } from "@/lib/order-access";
import { checkoutPrice } from "@/lib/checkout-pricing";

function whatsappNumber() {
  const digits = process.env.SELLER_WHATSAPP?.replace(/\D/g, "");
  if (!digits || digits.length < 10 || digits.length > 15) return null;
  return digits.length === 10 ? `57${digits}` : digits;
}

export async function POST(req: Request) {
  const session = await getSession();

  const destination = process.env.NEQUI_DESTINATION?.trim();
  const phone = whatsappNumber();
  if (!destination || !phone) {
    return NextResponse.json({ error: "El pago por Nequi aún no está configurado." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer los datos del pago." }, { status: 400 });
  }
  const parsed = nequiCheckoutSchema.safeParse({
    productId: form.get("productId"),
    quantity: Number(form.get("quantity")),
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [user, product] = await Promise.all([
    session ? prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }) : null,
    prisma.product.findUnique({ where: { id: parsed.data.productId } }),
  ]);
  if (session && !user) return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });
  if (!product?.active) return NextResponse.json({ error: "Producto no disponible" }, { status: 404 });
  if (product.deliveryType === "LICENSE_KEY") {
    const stock = await prisma.license.count({ where: { productId: product.id, status: "AVAILABLE" } });
    if (stock < parsed.data.quantity) return NextResponse.json({ error: "Stock insuficiente" }, { status: 409 });
  }

  const amountCop = checkoutPrice(product.priceCop * parsed.data.quantity).totalCop;
  const reference = `LT-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const orderAccess = createOrderAccess(reference);

  await prisma.order.create({
    data: {
      reference,
      userId: user?.id,
      buyerName: "Pendiente de datos",
      buyerEmail: `pendiente-${reference.toLowerCase()}@licentech.invalid`,
      buyerPhone: "Pendiente de datos",
      accessTokenHash: orderAccess.accessTokenHash,
      productId: product.id,
      quantity: parsed.data.quantity,
      amountCop,
      status: "PENDING",
      paymentMethod: "NEQUI",
    },
  });

  return NextResponse.json({
    reference,
    trackingUrl: orderAccess.trackingUrl,
    destination,
    whatsappPhone: phone,
  }, { status: 201 });
}
