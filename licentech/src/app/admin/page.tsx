import { prisma } from "@/lib/prisma";
import { cop } from "@/lib/format";
import PaymentReview from "@/components/admin/PaymentReview";
import ForumModeration from "@/components/admin/ForumModeration";
import ReviewModeration from "@/components/admin/ReviewModeration";
import WalletReview from "@/components/admin/WalletReview";

export const dynamic = "force-dynamic";

const label: Record<string, string> = { PENDING: "Esperando pago", REVIEW: "Por verificar", PAID: "Pagada", PAID_NO_STOCK: "Pagada sin stock", FAILED: "Fallida/rechazada" };

export default async function Page() {
  const [sales, users, noStock, reviewCount, pendingReviews, forumTopics, walletReviewCount, recent] = await Promise.all([
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { amountCop: true }, _count: true }),
    prisma.user.count(),
    prisma.order.count({ where: { status: "PAID_NO_STOCK" } }),
    prisma.order.count({ where: { status: "REVIEW" } }),
    prisma.customerReview.count({ where: { status: "PENDING" } }),
    prisma.forumTopic.count(),
    prisma.walletTopUp.count({ where: { status: "REVIEW" } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { product: true } }),
  ]);
  const cards = [
    ["Ventas totales", cop.format(sales._sum.amountCop ?? 0)],
    ["Órdenes pagadas", String(sales._count)],
    ["Usuarios registrados", String(users)],
    ["Pagadas sin stock", String(noStock)],
    ["Pagos por verificar", String(reviewCount)],
    ["Opiniones pendientes", String(pendingReviews)],
    ["Temas en el foro", String(forumTopics)],
    ["Recargas por verificar", String(walletReviewCount)],
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Resumen</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([t, v]) => (
          <div key={t} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-xs text-stone-500">{t}</div>
            <div className={`mt-1 text-xl font-semibold ${t === "Pagadas sin stock" && noStock > 0 ? "text-red-700" : ""}`}>{v}</div>
          </div>
        ))}
      </div>
      <PaymentReview />
      <WalletReview />
      <ReviewModeration />
      <ForumModeration />
      <h2 className="font-medium">Últimas transacciones</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 text-stone-600">
            <tr><th className="py-2">Fecha</th><th>Cliente</th><th>Producto</th><th>Total</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id} className="border-b border-stone-100">
                <td className="py-2">{o.createdAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
                <td>{o.buyerName} ({o.buyerEmail})</td>
                <td>{o.product.name} × {o.quantity}</td>
                <td>{cop.format(o.amountCop)}</td>
                <td>{o.status === "PAID" && o.product.deliveryType !== "LICENSE_KEY" && o.deliveryStatus === "PENDING"
                  ? "Entrega manual pendiente"
                  : label[o.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
