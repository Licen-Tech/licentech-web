import { prisma } from "@/lib/prisma";
import { verifyEvent, getTransaction } from "@/lib/wompi";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const event = await req.json().catch(() => null);
  if (!event || !verifyEvent(event)) return new Response("firma inválida", { status: 401 });
  if (event.event !== "transaction.updated") return new Response("ok");

  const t = event.data?.transaction;
  if (!t?.id || !t?.reference) return new Response("ok");
  const order = await prisma.order.findUnique({ where: { reference: t.reference } });
  if (!order) return new Response("ok"); // 200 para que Wompi no reintente referencias ajenas

  // No confiamos solo en el cuerpo del webhook: consultamos la transacción real y validamos monto/referencia
  let real: Awaited<ReturnType<typeof getTransaction>>;
  try {
    real = await getTransaction(t.id);
  } catch (error) {
    console.error("No se pudo consultar la transacción en Wompi", error);
    return new Response("error consultando transacción", { status: 502 }); // Wompi reintentará
  }
  if (real.reference !== order.reference || real.amount_in_cents !== order.amountCop * 100 || real.currency !== "COP") {
    console.error("Webhook con datos que no coinciden", order.reference);
    return new Response("datos no coinciden", { status: 400 });
  }

  if (real.status === "APPROVED") {
    await prisma.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "REVIEW", wompiTxId: real.id, paymentMethod: real.payment_method_type },
    });
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(real.status)) {
    await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED" } });
  }
  return new Response("ok");
}
