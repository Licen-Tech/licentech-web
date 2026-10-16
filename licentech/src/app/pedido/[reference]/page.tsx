import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cop } from "@/lib/format";
import { decrypt } from "@/lib/crypto";
import { isOrderAccessValid } from "@/lib/order-access";
import AutoRefresh from "@/components/AutoRefresh";
import ProofUpload from "@/components/ProofUpload";
import PaymentBrand from "@/components/PaymentBrand";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const statusLabels: Record<string, string> = {
  PENDING: "Estamos esperando la confirmación del pago.",
  REVIEW: "Recibimos tu solicitud. El pago está en revisión manual.",
  PAID: "Pago confirmado. Consulta abajo el estado de la entrega.",
  PAID_NO_STOCK: "El pago fue confirmado, pero no hay licencias disponibles. Te contactaremos para resolverlo.",
  FAILED: "El pago no se completó o el comprobante fue rechazado. Contáctanos si necesitas ayuda.",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: { reference: string };
  searchParams: { token?: string; comprobante?: string };
}) {
  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    include: {
      product: true,
      items: { include: { product: true } },
      licenses: { where: { status: "SOLD" }, include: { product: { select: { name: true } } } },
      paymentProof: { select: { fileName: true } },
    },
  });
  if (!order || !isOrderAccessValid(searchParams.token ?? "", order.accessTokenHash)) notFound();
  const paymentInstructions = order.paymentMethod && order.paymentMethod !== "CARD"
    ? await prisma.paymentMethodConfig.findUnique({ where: { code: order.paymentMethod }, select: { label: true, instructions: true } })
    : null;

  const sellerDigits = process.env.SELLER_WHATSAPP?.replace(/\D/g, "") ?? "";
  const sellerPhone = sellerDigits.length === 10
    ? `57${sellerDigits}`
    : sellerDigits.length >= 11 && sellerDigits.length <= 15
      ? sellerDigits
      : "";
  const orderLines = order.items.length ? order.items : [{
    product: order.product,
    quantity: order.quantity,
    activationEmail: order.activationEmail,
  }];
  const manualLines = orderLines.filter((line) => line.product.deliveryType !== "LICENSE_KEY");
  const isLicenseKey = manualLines.length === 0;
  const needsActivationEmail = manualLines.some((line) => !line.activationEmail);
  const waiting = ["PENDING", "REVIEW"].includes(order.status)
    || (order.status === "PAID" && order.deliveryStatus === "PENDING");
  const canUploadProof = Boolean(order.paymentMethod && order.paymentMethod !== "CARD" && ["PENDING", "FAILED"].includes(order.status));
  const whatsappMessage = [
    "Hola, ya realicé la transferencia y cargué el comprobante de mi compra en LicenTech.",
    `Cliente: ${order.buyerName}`,
    `Código de compra: ${order.reference}`,
    ...orderLines.map((line) => `Producto: ${line.product.name} x${line.quantity}`),
    `Total: ${cop.format(order.amountCop)}`,
    "Por favor, ayúdame a verificar el pago y gestionar la entrega.",
  ].join("\n");
  const message = `Hola, consulto por mi compra ${order.reference}. Cliente: ${order.buyerName}. ${orderLines.map((line) => `${line.product.name} x${line.quantity}`).join(", ")}. Total: ${cop.format(order.amountCop)}.`;
  const whatsappUrl = sellerPhone
    ? `https://wa.me/${sellerPhone}?text=${encodeURIComponent(whatsappMessage)}`
    : null;
  const statusMessage = canUploadProof && order.status === "PENDING"
    ? "Cuando realices el pago, carga el comprobante aquí para que podamos revisar la transacción."
    : order.status === "PAID" && manualLines.length > 0
      ? order.deliveryStatus === "COMPLETED"
        ? order.emailSentAt
          ? "Pago confirmado y entrega manual marcada como completada. Enviamos una notificación al correo de contacto y al correo de la cuenta del software."
          : "La entrega se marcó como completada. No pudimos confirmar el envío del correo de aviso; contacta a atención al cliente si lo necesitas."
        : "Pago confirmado. La activación o el envío de créditos está pendiente de gestión manual; actualizaremos esta página cuando se complete."
      : statusLabels[order.status];
  const progressIndex = order.status === "PENDING"
    ? 0
    : order.status === "REVIEW"
      ? 1
      : order.status === "PAID"
        ? order.deliveryStatus === "COMPLETED" ? 2 : 1
        : order.status === "PAID_NO_STOCK"
          ? 2
          : -1;
  const progressSteps = ["Compra registrada", "Pago verificado", isLicenseKey ? "Claves entregadas" : "Gestión completada"];

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      {waiting && <AutoRefresh />}
      <div>
        <p className="text-sm font-medium text-teal-800">LICENTECH · SEGUIMIENTO DE COMPRA</p>
        <h1 className="mt-1 text-2xl font-semibold">Estado de tu compra</h1>
        <p className="mt-1 text-sm text-stone-600">Consulta el resumen, el estado del pago y la entrega de tu producto desde esta página privada.</p>
      </div>
      <article className="space-y-2 rounded-lg border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <p className="text-sm text-stone-500">Producto</p>
            {orderLines.map((line, index) => (
              <p key={`${line.product.id}-${index}`} className="font-semibold">
                {line.product.name} {line.product.version} × {line.quantity}
                {"rentalDuration" in line && line.rentalDuration && line.rentalUnit
                  ? ` · renta ${line.rentalDuration} ${line.rentalUnit === "HOUR" ? "horas" : "meses"}`
                  : ""}
              </p>
            ))}
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-stone-500">Total</p>
            <p className="text-xl font-semibold">{cop.format(order.amountCop)}</p>
          </div>
        </div>
        <p className="py-1 text-sm text-stone-500">Código de compra: <span className="font-medium text-stone-800">{order.reference}</span></p>
        {manualLines.map((line, index) => (
          <p key={`${line.product.id}-${index}`} className="text-sm text-stone-600">
            Cuenta de {line.product.name}: <span className="font-medium text-stone-800">{line.activationEmail ?? "Pendiente de registrar con el comprobante"}</span>
            {line.product.deliveryType === "CREDITS" && ` · ${(line.product.creditAmount ?? 1) * line.quantity} créditos`}
          </p>
        ))}
        {progressIndex >= 0 ? (
          <ol aria-label="Progreso de compra" className="grid gap-2 py-3 sm:grid-cols-3">
            {progressSteps.map((step, index) => (
              <li
                key={step}
                aria-current={index === progressIndex ? "step" : undefined}
                className={`rounded-md border p-3 text-sm ${
                  index <= progressIndex
                    ? "border-teal-700 bg-teal-50 font-medium text-teal-900"
                    : "border-stone-200 bg-stone-50 text-stone-500"
                }`}
              >
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">El pago requiere atención. Consulta las indicaciones o vuelve a cargar un comprobante válido.</p>
        )}
        <p role="status" className="rounded-md bg-stone-50 p-3 text-sm">{statusMessage}</p>
        {canUploadProof && (
          <div className="space-y-3 rounded-lg bg-stone-50 p-4 text-sm">
            <p className="font-medium">
              <PaymentBrand
                code={order.paymentMethod ?? ""}
                label={order.paymentMethod === "NEQUI" ? "Nequi" : order.paymentMethod === "BREB" ? "Bre-B" : paymentInstructions?.label ?? order.paymentMethod ?? "Transferencia"}
              />
            </p>
            <p className="whitespace-pre-line">{order.paymentMethod === "NEQUI" && process.env.NEQUI_DESTINATION?.trim()
              ? `Transfiere el total al número Nequi: ${process.env.NEQUI_DESTINATION.trim()}.`
              : order.paymentMethod === "BREB" && process.env.BREB_KEY?.trim()
                ? `Transfiere el total a la llave Bre-B: ${process.env.BREB_KEY.trim()}.`
                : paymentInstructions?.instructions ?? "Sigue las instrucciones de pago indicadas por el vendedor."}</p>
            <p className="font-medium">Después de transferir, sube aquí el comprobante para verificar el pago.</p>
            {order.status === "FAILED" && (
              <p className="font-medium text-red-700">El comprobante anterior no fue aceptado. Puedes cargar uno nuevo después de verificar la transferencia.</p>
            )}
            {order.paymentProof && (
              <p>Comprobante anterior: {order.paymentProof.fileName}. Carga el nuevo comprobante para solicitar otra revisión.</p>
            )}
            <ProofUpload
              endpoint={`/api/pedido/${encodeURIComponent(order.reference)}/comprobante?token=${encodeURIComponent(searchParams.token ?? "")}`}
              autoStart={searchParams.comprobante === "1"}
              requiresActivationEmail={needsActivationEmail}
            />
          </div>
        )}
        {order.status === "PAID" && order.licenses.map((license) => (
          <p key={license.id} className="rounded bg-stone-100 p-3 text-sm">
            <span className="mb-1 block font-medium">{license.product.name}</span>
            <code className="block select-all break-all">{decrypt(license.keyEnc)}</code>
          </p>
        ))}
        {manualLines.filter((line) => line.product.deliveryDetails).map((line, index) => (
          <p key={`${line.product.id}-details-${index}`} className="whitespace-pre-line rounded bg-stone-50 p-3 text-sm text-stone-700">{line.product.deliveryDetails}</p>
        ))}
        {order.paymentMethod !== "CARD" && order.status === "REVIEW" && whatsappUrl && (
          <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm">
            <p>Recibimos tu comprobante. Después de cargarlo, pulsa WhatsApp para avisarnos y facilitar la verificación y entrega de tu producto.</p>
            <a className="inline-block rounded bg-green-700 px-4 py-2 font-medium text-white" href={whatsappUrl} target="_blank" rel="noreferrer">
              Avisar y confirmar por WhatsApp
            </a>
          </div>
        )}
        {waiting && order.paymentMethod && sellerPhone && (
          <a className="inline-block pt-2 text-sm underline" href={`https://wa.me/${sellerPhone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
            Consultar por WhatsApp
          </a>
        )}
      </article>
      <p className="text-sm text-stone-500">
        {canUploadProof
          ? `Al enviar el comprobante te pediremos el nombre, correo y WhatsApp necesarios para verificar el pago${isLicenseKey ? " y entregar la licencia" : ", además del correo de la cuenta del software"}.`
          : `Enviamos las actualizaciones al correo ${order.buyerEmail}.`}
      </p>
    </section>
  );
}
