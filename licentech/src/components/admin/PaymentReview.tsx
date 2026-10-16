"use client";
import { useEffect, useState } from "react";
import { cop } from "@/lib/format";

type ReviewOrder = {
  id: string;
  reference: string;
  amountCop: number;
  quantity: number;
  paymentMethod: string | null;
  payerName: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  activationEmail: string | null;
  status: "REVIEW" | "PAID";
  deliveryStatus: "PENDING" | "COMPLETED";
  emailSentAt: string | null;
  createdAt: string;
  product: {
    name: string;
    version: string;
    deliveryType: "LICENSE_KEY" | "ACCOUNT_ACTIVATION" | "CREDITS" | "RENTAL";
    creditAmount: number | null;
    deliveryDetails: string | null;
  };
  items: Array<{
    quantity: number;
    activationEmail: string | null;
    rentalDuration?: number | null;
    rentalUnit?: "HOUR" | "MONTH" | null;
    product: ReviewOrder["product"];
  }>;
  paymentProof: { mimeType: string; fileName: string } | null;
};

export default function PaymentReview() {
  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/admin/orders");
    if (!response.ok) {
      setMessage("No se pudieron cargar las órdenes por revisar.");
      return;
    }
    setOrders(await response.json());
  }

  useEffect(() => { void load(); }, []);

  async function review(order: ReviewOrder, action: "approve" | "reject" | "complete" | "resend") {
    const orderLines = order.items.length ? order.items : [{
      quantity: order.quantity,
      activationEmail: order.activationEmail,
      product: order.product,
    }];
    const hasManualLines = orderLines.some((item) => item.product.deliveryType !== "LICENSE_KEY");
    const hasLicenseLines = orderLines.some((item) => item.product.deliveryType === "LICENSE_KEY");
    const prompt = action === "approve"
      ? hasLicenseLines && hasManualLines
        ? `¿Confirmaste el pago de ${cop.format(order.amountCop)} para ${order.reference}? Se entregarán las claves disponibles y la gestión manual quedará pendiente.`
        : hasLicenseLines
          ? `¿Confirmaste el pago de ${cop.format(order.amountCop)} para ${order.reference}? Se entregarán las claves disponibles.`
          : `¿Confirmaste el pago de ${cop.format(order.amountCop)} para ${order.reference}? La entrega manual seguirá pendiente.`
      : action === "complete"
        ? `¿Ya completaste las activaciones, rentas o entregas manuales de ${order.items.map((item) => item.activationEmail).filter(Boolean).join(", ") || order.activationEmail}? Esto notificará al cliente.`
        : action === "resend"
          ? `¿Reenviar el correo de entrega al cliente y a ${order.activationEmail}?`
        : `¿Rechazar el comprobante de ${order.reference}?`;
    if (!window.confirm(prompt)) return;

    setBusy(order.id);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(typeof data.error === "string" ? data.error : "No se pudo actualizar la orden.");
    } else {
      setMessage(action === "approve"
        ? hasLicenseLines && hasManualLines
          ? "Pago confirmado y claves procesadas. Completa la gestión manual pendiente."
          : hasLicenseLines
            ? "Pago confirmado y claves procesadas."
            : "Pago confirmado. Completa la activación, renta o entrega manual y luego marca la entrega."
        : action === "complete"
          ? data.emailSent
            ? "Entrega marcada como completada y correo enviado."
            : "Entrega marcada como completada, pero no se pudo enviar el correo. Revisa la configuración de correo."
          : action === "resend"
            ? "Correo de entrega enviado."
            : "Comprobante rechazado.");
      await load();
    }
    setBusy("");
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Pagos y entregas por gestionar ({orders.length})</h2>
      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
      {orders.length === 0 ? (
        <p className="text-sm text-stone-500">No hay pagos pendientes de revisión.</p>
      ) : orders.map((order) => {
        const lines = order.items.length ? order.items : [{
          quantity: order.quantity,
          activationEmail: order.activationEmail,
          product: order.product,
        }];
        const hasManualLines = lines.some((item) => item.product.deliveryType !== "LICENSE_KEY");
        return (
        <article key={order.id} className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="font-medium">{lines.map((line) => `${line.product.name} × ${line.quantity}${line.rentalDuration && line.rentalUnit ? ` · ${line.rentalDuration} ${line.rentalUnit === "HOUR" ? "horas" : "meses"}` : ""}`).join(" · ")}</div>
            <div className="font-semibold">{cop.format(order.amountCop)}</div>
          </div>
          <p className="text-sm font-medium text-amber-950">
            {order.status === "REVIEW"
              ? "Pago pendiente de verificación"
              : order.deliveryStatus === "COMPLETED"
                ? order.emailSentAt ? "Entrega y correo completados" : "Entrega completada · correo pendiente"
              : hasManualLines
                ? "Pago confirmado · activación, renta o entrega pendiente"
                : "Pago confirmado · claves procesadas"}
          </p>
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div><dt className="inline font-medium">Código: </dt><dd className="inline">{order.reference}</dd></div>
            <div><dt className="inline font-medium">Método: </dt><dd className="inline">{order.paymentMethod ?? "No indicado"}</dd></div>
            <div><dt className="inline font-medium">Cliente: </dt><dd className="inline">{order.buyerName} ({order.buyerEmail})</dd></div>
            <div><dt className="inline font-medium">WhatsApp: </dt><dd className="inline">{order.buyerPhone}</dd></div>
            {lines.filter((line) => line.product.deliveryType !== "LICENSE_KEY").map((line, index) => (
              <div key={`${line.product.name}-${index}`}><dt className="inline font-medium">Cuenta de {line.product.name}: </dt><dd className="inline">{line.activationEmail ?? "No indicado"}</dd></div>
            ))}
            <div><dt className="inline font-medium">Titular que transfirió: </dt><dd className="inline">{order.payerName ?? "No indicado"}</dd></div>
          </dl>
          {lines.filter((line) => line.product.deliveryType !== "LICENSE_KEY" && line.product.deliveryDetails).map((line, index) => (
            <p key={`${line.product.name}-details-${index}`} className="whitespace-pre-line text-sm text-stone-700">{line.product.deliveryDetails}</p>
          ))}
          {order.paymentProof && (
            <a className="inline-block underline" href={`/api/admin/orders/${order.id}`} target="_blank" rel="noreferrer">
              Ver comprobante ({order.paymentProof.fileName})
            </a>
          )}
          <div className="flex flex-wrap gap-3">
            {order.status === "REVIEW" ? (
              <>
                <button disabled={busy === order.id} className="rounded bg-teal-800 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void review(order, "approve")}>
                  {!hasManualLines ? "Confirmar pago y entregar claves" : "Confirmar pago"}
                </button>
                <button disabled={busy === order.id} className="rounded border border-red-300 px-3 py-2 text-sm text-red-800 disabled:opacity-50" onClick={() => void review(order, "reject")}>
                  Rechazar comprobante
                </button>
              </>
            ) : order.deliveryStatus === "COMPLETED" ? (
              <button disabled={busy === order.id} className="rounded bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void review(order, "resend")}>
                Reenviar correo de entrega
              </button>
            ) : (
              <button disabled={busy === order.id} className="rounded bg-teal-800 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void review(order, "complete")}>
                Marcar activación/renta/créditos como entregados
              </button>
            )}
          </div>
        </article>
      ); })}
    </section>
  );
}
