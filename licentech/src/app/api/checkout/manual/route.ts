import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createOrderAccess } from "@/lib/order-access";
import { manualCheckoutSchema } from "@/lib/validation";
import { normalizeCheckoutItems, resolveCheckoutItems } from "@/lib/checkout";
import { checkoutPrice } from "@/lib/checkout-pricing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No pudimos leer los datos del pago." }, { status: 400 });
  let submittedItems: unknown;
  const itemsValue = form.get("items");
  if (typeof itemsValue === "string") {
    try {
      submittedItems = JSON.parse(itemsValue);
    } catch {
      return NextResponse.json({ error: "No pudimos leer los productos del carrito." }, { status: 400 });
    }
  }
  const parsed = manualCheckoutSchema.safeParse(submittedItems
    ? { items: submittedItems, paymentMethod: form.get("paymentMethod") }
    : {
        productId: form.get("productId"),
        quantity: Number(form.get("quantity")),
        activationEmail: form.get("activationEmail") || undefined,
        rentalOptionId: form.get("rentalOptionId") || undefined,
        paymentMethod: form.get("paymentMethod"),
      });
  if (!parsed.success) {
    console.error("Checkout manual: datos inválidos", parsed.error.issues);
    return NextResponse.json({ error: "Revisa los datos del pedido (producto, cantidad, método de pago y correo de la cuenta del software)." }, { status: 400 });
  }

  try {
    const lines = normalizeCheckoutItems(parsed.data);
    const [user, resolved, method] = await Promise.all([
      session ? prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }) : null,
      resolveCheckoutItems(lines),
      prisma.paymentMethodConfig.findUnique({ where: { code: parsed.data.paymentMethod } }),
    ]);
    if (session && !user) return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });
    const methodCode = parsed.data.paymentMethod;
    const configuredFromEnvironment = !method
      && ((methodCode === "NEQUI" && Boolean(process.env.NEQUI_DESTINATION?.trim()))
        || (methodCode === "BREB" && Boolean(process.env.BREB_KEY?.trim())));
    if (!method?.active && !configuredFromEnvironment) {
      return NextResponse.json({ error: "Este método de pago no está disponible." }, { status: 404 });
    }
    if (!resolved.lines) return NextResponse.json({ error: resolved.error }, { status: 400 });

    const reference = `LT-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const access = createOrderAccess(reference, new URL(req.url).origin);
    const subtotalCop = resolved.lines.reduce((sum, line) => sum + line.unitPriceCop * line.quantity, 0);
    const amountCop = checkoutPrice(subtotalCop).totalCop;
    await prisma.order.create({
      data: {
        reference,
        userId: user?.id,
        buyerName: "Pendiente de datos",
        buyerEmail: `pendiente-${reference.toLowerCase()}@licentech.invalid`,
        buyerPhone: "Pendiente de datos",
        activationEmail: resolved.lines[0]?.activationEmail,
        accessTokenHash: access.accessTokenHash,
        productId: resolved.lines[0].productId,
        quantity: resolved.lines.reduce((sum, line) => sum + line.quantity, 0),
        amountCop,
        paymentMethod: methodCode,
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

    return NextResponse.json({
      reference,
      trackingUrl: access.trackingUrl,
      paymentLabel: method?.label ?? (methodCode === "NEQUI" ? "Nequi" : "Bre-B"),
      instructions: methodCode === "NEQUI" && process.env.NEQUI_DESTINATION?.trim()
        ? `Transfiere el total al número Nequi: ${process.env.NEQUI_DESTINATION.trim()}.`
        : methodCode === "BREB" && process.env.BREB_KEY?.trim()
          ? `Transfiere el total a la llave Bre-B: ${process.env.BREB_KEY.trim()}.`
          : method?.instructions ?? "",
    }, { status: 201 });
  } catch (error) {
    console.error("Checkout manual: error inesperado", error);
    const detail = error instanceof Error ? error.message : "";
    return NextResponse.json({
      error: detail.startsWith("APP_URL")
        ? detail
        : "No pudimos registrar tu pedido por un error del servidor. Inténtalo de nuevo en unos minutos.",
    }, { status: 500 });
  }
}
