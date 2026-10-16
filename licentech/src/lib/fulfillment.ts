import { prisma } from "./prisma";
import { sendReceipt } from "./mail";

// Solo se invoca tras la aprobación manual de una orden en revisión.
export async function fulfillOrder(orderId: string, wompiTxId?: string, method?: string) {
  const outcome = await prisma.$transaction(async (tx) => {
    // Solo una aprobación puede pasar la orden de REVIEW a PAID.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "REVIEW" },
      data: {
        status: "PAID",
        ...(wompiTxId ? { wompiTxId } : {}),
        ...(method ? { paymentMethod: method } : {}),
        paidAt: new Date(),
      },
    });
    if (claimed.count === 0) return "already" as const;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        product: { select: { deliveryType: true } },
        items: { include: { product: { select: { deliveryType: true } } } },
      },
    });

    const lines = order.items.length
      ? order.items
      : [{ productId: order.productId, quantity: order.quantity, product: order.product }];
    const licenseQuantities = new Map<string, number>();
    for (const line of lines) {
      if (line.product.deliveryType === "LICENSE_KEY") {
        licenseQuantities.set(line.productId, (licenseQuantities.get(line.productId) ?? 0) + line.quantity);
      }
    }
    if (!licenseQuantities.size) return "manual_pending" as const;

    const allocations: Array<{ productId: string; ids: string[] }> = [];
    for (const [productId, quantity] of Array.from(licenseQuantities.entries())) {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "License"
        WHERE "productId" = ${productId} AND status = 'AVAILABLE'
        ORDER BY "createdAt"
        LIMIT ${quantity}
        FOR UPDATE SKIP LOCKED`;
      if (rows.length < quantity) {
        await tx.order.update({ where: { id: orderId }, data: { status: "PAID_NO_STOCK" } });
        return "no_stock" as const;
      }
      allocations.push({ productId, ids: rows.map((row) => row.id) });
    }
    for (const allocation of allocations) {
      await tx.license.updateMany({
        where: { id: { in: allocation.ids } },
        data: { status: "SOLD", orderId, soldAt: new Date() },
      });
    }
    const hasManualLines = lines.some((line) => line.product.deliveryType !== "LICENSE_KEY");
    await tx.order.update({
      where: { id: orderId },
      data: hasManualLines
        ? {}
        : { deliveryStatus: "COMPLETED", deliveredAt: new Date() },
    });
    return hasManualLines ? "partial" as const : "delivered" as const;
  });

  if (outcome === "delivered" || outcome === "partial") await sendReceipt(orderId).catch((e) => console.error("Correo falló", orderId, e));
  if (outcome === "no_stock") console.error(`ORDEN PAGADA SIN STOCK: ${orderId} -> reponer o reembolsar`); // conecta aquí tu alerta (correo/Slack)
  return outcome;
}

export async function completeManualDelivery(orderId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        deliveryStatus: true,
        product: { select: { deliveryType: true } },
        items: { select: { product: { select: { deliveryType: true } } } },
      },
    });
    if (!order) return "not_found" as const;
    const hasManualLines = order.items.length
      ? order.items.some((item) => item.product.deliveryType !== "LICENSE_KEY")
      : order.product.deliveryType !== "LICENSE_KEY";
    if (order.status !== "PAID" || !hasManualLines) return "not_ready" as const;
    if (order.deliveryStatus === "COMPLETED") return "already" as const;

    const updated = await tx.order.updateMany({
      where: { id: orderId, status: "PAID", deliveryStatus: "PENDING" },
      data: { deliveryStatus: "COMPLETED", deliveredAt: new Date() },
    });
    return updated.count ? "completed" as const : "already" as const;
  });

  if (result !== "completed") return { result, emailSent: false };
  try {
    await sendReceipt(orderId);
    await prisma.order.update({ where: { id: orderId }, data: { emailSentAt: new Date() } });
    return { result, emailSent: true };
  } catch (error) {
    console.error("No se pudo enviar el correo de entrega", orderId, error);
    return { result, emailSent: false };
  }
}

export async function retryManualDeliveryEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      deliveryStatus: true,
      product: { select: { deliveryType: true } },
      items: { select: { product: { select: { deliveryType: true } } } },
    },
  });
  if (!order) return "not_found" as const;
  const hasManualLines = order.items.length
    ? order.items.some((item) => item.product.deliveryType !== "LICENSE_KEY")
    : order.product.deliveryType !== "LICENSE_KEY";
  if (order.status !== "PAID" || order.deliveryStatus !== "COMPLETED" || !hasManualLines) {
    return "not_ready" as const;
  }

  try {
    await sendReceipt(orderId);
    await prisma.order.update({ where: { id: orderId }, data: { emailSentAt: new Date() } });
    return "sent" as const;
  } catch (error) {
    console.error("No se pudo reenviar el correo de entrega", orderId, error);
    return "failed" as const;
  }
}
