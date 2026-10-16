import { prisma } from "./prisma";
import { decrypt } from "./crypto";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

// Comprobante de pago y licencias, enviados solo después de la aprobación manual.
export async function sendReceipt(orderId: string) {
  const o = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      product: true,
      items: { include: { product: true } },
      licenses: { where: { status: "SOLD" }, include: { product: { select: { name: true } } } },
    },
  });
  const lines = o.items.length ? o.items : [{
    product: o.product,
    quantity: o.quantity,
    activationEmail: o.activationEmail,
  }];
  const manualLines = lines.filter((line) => line.product.deliveryType !== "LICENSE_KEY");
  const keyLines = lines.filter((line) => line.product.deliveryType === "LICENSE_KEY");
  const recipients = Array.from(new Set([
    o.buyerEmail,
    ...manualLines.map((line) => line.activationEmail),
  ].filter((email): email is string => Boolean(email))));
  const keys = o.licenses.map((license) => ({
    productName: license.product.name,
    key: decrypt(license.keyEnc),
  }));
  const orderLinesHtml = lines.map((line) => {
    const duration = "rentalDuration" in line && line.rentalDuration && line.rentalUnit
      ? ` · Renta: ${line.rentalDuration} ${line.rentalUnit === "HOUR" ? "horas" : "meses"}`
      : "";
    return `<tr><td>${esc(line.product.name)} × ${line.quantity}${duration}</td><td>${line.activationEmail ? `Cuenta: ${esc(line.activationEmail)}` : ""}</td></tr>`;
  }).join("");
  const html = `
    <h2>Comprobante de compra</h2>
    <p>Hola ${esc(o.buyerName)}, verificamos tu pago.</p>
    <table cellpadding="6">
      <tr><td>Referencia</td><td>${esc(o.reference)}</td></tr>
      ${orderLinesHtml}
      <tr><td>Total</td><td>${cop(o.amountCop)}</td></tr>
      <tr><td>Fecha</td><td>${o.paidAt?.toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td></tr>
    </table>
    ${keyLines.length ? `<h3>Claves digitales</h3><ul>${keys.map(({ productName, key }) => `<li>${esc(productName)}: <code>${esc(key)}</code></li>`).join("")}</ul>` : ""}
    ${manualLines.length ? `<h3>Servicios y créditos</h3>${o.deliveryStatus === "COMPLETED"
      ? `<p>El administrador confirmó la entrega manual. ${manualLines.map((line) => line.product.deliveryType === "CREDITS"
        ? `${(line.product.creditAmount ?? 1) * line.quantity} créditos de ${esc(line.product.name)} para ${esc(line.activationEmail ?? "")}.`
        : `${esc(line.product.name)} para ${esc(line.activationEmail ?? "")}.`).join(" ")}</p>`
      : `<p>El pago está verificado y el administrador está procesando la entrega manual. Recibirás otra notificación al finalizar.</p>`}
      ${manualLines.map((line) => line.product.deliveryDetails ? `<p>${esc(line.product.deliveryDetails)}</p>` : "").join("")}` : ""}
    <p style="color:#666">LicenTech Colombia es revendedor de software de terceros. Consulta nuestro descargo de responsabilidad y política de garantía en el sitio.</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: recipients,
      subject: manualLines.length && o.deliveryStatus === "COMPLETED"
        ? `Entrega confirmada ${o.reference} – LicenTech Colombia`
        : `Comprobante de compra ${o.reference} – LicenTech Colombia`,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}
