import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOrderAccessValid } from "@/lib/order-access";
import { nequiProofDetailsSchema } from "@/lib/validation";
import { cop } from "@/lib/format";

export const runtime = "nodejs";

const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const proofTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function whatsappNumber() {
  const digits = process.env.SELLER_WHATSAPP?.replace(/\D/g, "");
  if (!digits || digits.length < 10 || digits.length > 15) return null;
  return digits.length === 10 ? `57${digits}` : digits;
}

export async function POST(
  req: Request,
  { params }: { params: { reference: string } },
) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      accessTokenHash: true,
      product: { select: { deliveryType: true, name: true } },
      items: {
        select: {
          productId: true,
          activationEmail: true,
          product: { select: { deliveryType: true, name: true } },
        },
      },
    },
  });

  if (!order || !isOrderAccessValid(token, order.accessTokenHash)) {
    return NextResponse.json({ error: "No pudimos validar el acceso a esta compra." }, { status: 404 });
  }
  if (!order.paymentMethod || order.paymentMethod === "CARD" || !["PENDING", "FAILED"].includes(order.status)) {
    return NextResponse.json({ error: "Esta compra no admite la carga de un comprobante en este momento." }, { status: 409 });
  }
  const phone = whatsappNumber();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el comprobante." }, { status: 400 });
  }

  const details = nequiProofDetailsSchema.safeParse({
    buyerName: form.get("buyerName"),
    buyerEmail: form.get("buyerEmail"),
    buyerPhone: form.get("buyerPhone"),
    activationEmail: form.get("activationEmail") || undefined,
  });
  if (!details.success) {
    return NextResponse.json({ error: "Revisa tu nombre, correo y WhatsApp de contacto." }, { status: 400 });
  }
  const manualLines = order.items.length
    ? order.items.filter((item) => item.product.deliveryType !== "LICENSE_KEY")
    : order.product.deliveryType !== "LICENSE_KEY" ? [{ activationEmail: null, product: order.product }] : [];
  if (manualLines.some((line) => !line.activationEmail) && !details.data.activationEmail) {
    return NextResponse.json({ error: "Indica el correo registrado en la cuenta del software para recibir la activación o los créditos." }, { status: 400 });
  }

  const proof = form.get("proof");
  if (!(proof instanceof File)) {
    return NextResponse.json({ error: "Selecciona el comprobante de pago." }, { status: 400 });
  }
  if (!proofTypes.has(proof.type)) {
    return NextResponse.json({ error: "El comprobante debe ser JPG, PNG, WEBP o PDF." }, { status: 400 });
  }
  if (proof.size === 0 || proof.size > MAX_PROOF_SIZE) {
    return NextResponse.json({ error: "El comprobante no puede superar 5 MB." }, { status: 400 });
  }

  const fileName = proof.name.replace(/[^\w.-]/g, "_").slice(0, 120) || "comprobante";
  const content = Buffer.from(await proof.arrayBuffer());
  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status, paymentMethod: order.paymentMethod },
      data: {
        status: "REVIEW",
        buyerName: details.data.buyerName,
        buyerEmail: details.data.buyerEmail,
        buyerPhone: details.data.buyerPhone,
        activationEmail: details.data.activationEmail ?? manualLines[0]?.activationEmail,
        payerName: details.data.buyerName,
      },
    });
    if (!updated.count) return false;
    if (order.items.length === 1 && manualLines.length === 1 && details.data.activationEmail) {
      await tx.orderItem.updateMany({
        where: { orderId: order.id, productId: order.items[0].productId },
        data: { activationEmail: details.data.activationEmail },
      });
    }

    await tx.paymentProof.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, content, mimeType: proof.type, fileName },
      update: { content, mimeType: proof.type, fileName, createdAt: new Date() },
    });
    return true;
  });

  if (!saved) {
    return NextResponse.json({ error: "La compra ya fue actualizada. Recarga la página e inténtalo de nuevo." }, { status: 409 });
  }

  const orderDetails = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    select: {
      reference: true,
      amountCop: true,
      quantity: true,
      activationEmail: true,
      product: { select: { name: true } },
      items: { select: { quantity: true, activationEmail: true, product: { select: { name: true } } } },
    },
  });
  const orderLines = orderDetails.items.length ? orderDetails.items : [{
    quantity: orderDetails.quantity,
    activationEmail: orderDetails.activationEmail,
    product: orderDetails.product,
  }];
  const message = [
    `Hola, ya realicé el pago por ${order.paymentMethod} y cargué el comprobante.`,
    `Cliente: ${details.data.buyerName}`,
    ...orderLines.map((line) => `Servicio: ${line.product.name} x${line.quantity}${line.activationEmail ? ` · Cuenta: ${line.activationEmail}` : ""}`),
    `Total: ${cop.format(orderDetails.amountCop)}`,
    `Código de compra: ${orderDetails.reference}`,
    "Por favor, verifica el pago y ayúdame con la entrega.",
  ].join("\n");
  return NextResponse.json({
    whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null,
  });
}
