import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { cop } from "@/lib/format";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const label: Record<string, string> = {
  PENDING: "Esperando confirmación del pago",
  REVIEW: "Pago recibido; pendiente de verificación manual del administrador",
  PAID: "Pagado",
  PAID_NO_STOCK: "Pagado, sin stock: te contactaremos para reponer o reembolsar",
  FAILED: "Pago no completado",
};

export default async function Page() {
  const s = await getSession();
  if (!s) redirect("/login");
  const orders = await prisma.order.findMany({
    where: { userId: s.userId },
    orderBy: { createdAt: "desc" },
    include: { product: true, items: { include: { product: true } }, licenses: { include: { product: true } } },
  });
  const linesByOrder = new Map(orders.map((order) => [
    order.id,
    order.items.length ? order.items : [{ product: order.product, quantity: order.quantity }],
  ]));
  const waiting = orders.some((o) => ["PENDING", "REVIEW"].includes(o.status) && Date.now() - o.createdAt.getTime() < 30 * 60_000);
  const sellerPhoneDigits = process.env.SELLER_WHATSAPP?.replace(/\D/g, "");
  const sellerPhone = sellerPhoneDigits?.length === 10 ? `57${sellerPhoneDigits}` : sellerPhoneDigits;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mis compras</h1>
      {waiting && <AutoRefresh />}
      {orders.length === 0 && <p className="text-stone-500">Todavía no has comprado nada.</p>}
      {orders.map((o) => (
        <article key={o.id} className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="font-medium">
              {linesByOrder.get(o.id)?.map((line) => `${line.product.name} ${line.product.version} × ${line.quantity}`).join(" · ")}
            </div>
            <div className="font-semibold">{cop.format(o.amountCop)}</div>
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {o.reference} · {o.createdAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })}
          </div>
          <div className={`mt-2 text-sm ${o.status === "PAID" ? "text-teal-800" : "text-stone-600"}`}>{label[o.status]}</div>
          {["PENDING", "REVIEW"].includes(o.status) && sellerPhone && (
            <a
              className="mt-2 inline-block text-sm underline"
              href={`https://wa.me/${sellerPhone}?text=${encodeURIComponent(`Hola, consulto por mi compra ${o.reference}. Cliente: ${o.buyerName}. Productos: ${linesByOrder.get(o.id)?.map((line) => `${line.product.name} x${line.quantity}`).join(", ")}. Total: ${cop.format(o.amountCop)}.`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Consultar por WhatsApp con mi código de compra
            </a>
          )}
          {o.status === "PAID" &&
            o.licenses.map((l) => (
              <p key={l.id} className="mt-2 rounded bg-stone-100 px-3 py-2 text-sm">
                <span className="mb-1 block font-medium">{l.product.name}</span>
                <code className="block select-all break-all">{decrypt(l.keyEnc)}</code>
              </p>
            ))}
        </article>
      ))}
    </div>
  );
}
