import { prisma } from "./prisma";
import { sendReceipt } from "./mail";

// Idempotente: se puede llamar varias veces (reintentos del webhook) sin entregar claves de más.
export async function fulfillOrder(orderId: string, wompiTxId: string, method?: string) {
  const outcome = await prisma.$transaction(async (tx) => {
    // 1) Solo el primer llamado logra pasar la orden de PENDING a PAID
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", wompiTxId, paymentMethod: method, paidAt: new Date() },
    });
    if (claimed.count === 0) return "already" as const;

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    // 2) Bloquea las filas elegidas; SKIP LOCKED evita que dos pagos simultáneos tomen la misma clave
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "License"
      WHERE "productId" = ${order.productId} AND status = 'AVAILABLE'
      ORDER BY "createdAt"
      LIMIT ${order.quantity}
      FOR UPDATE SKIP LOCKED`;

    if (rows.length < order.quantity) {
      await tx.order.update({ where: { id: orderId }, data: { status: "PAID_NO_STOCK" } });
      return "no_stock" as const;
    }
    await tx.license.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: "SOLD", orderId, soldAt: new Date() },
    });
    return "delivered" as const;
  });

  if (outcome === "delivered") await sendReceipt(orderId).catch((e) => console.error("Correo falló", orderId, e));
  if (outcome === "no_stock") console.error(`ORDEN PAGADA SIN STOCK: ${orderId} -> reponer o reembolsar`); // conecta aquí tu alerta (correo/Slack)
  return outcome;
}
