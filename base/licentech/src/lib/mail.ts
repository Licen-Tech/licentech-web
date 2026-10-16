import { prisma } from "./prisma";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

// Comprobante de pago (NO es la factura electrónica DIAN: ver README). La clave no viaja por correo; se ve en "Mis compras".
export async function sendReceipt(orderId: string) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: true, product: true } });
  const html = `
    <h2>Comprobante de compra</h2>
    <p>Hola ${esc(o.user.name)}, recibimos tu pago. Tu licencia ya está disponible en
       <a href="${process.env.APP_URL}/mis-compras">Mis compras</a>.</p>
    <table cellpadding="6">
      <tr><td>Referencia</td><td>${esc(o.reference)}</td></tr>
      <tr><td>Producto</td><td>${esc(o.product.name)} ${esc(o.product.version)} × ${o.quantity}</td></tr>
      <tr><td>Total</td><td>${cop(o.amountCop)}</td></tr>
      <tr><td>Fecha</td><td>${o.paidAt?.toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td></tr>
    </table>
    <p style="color:#666">LicenTech Colombia es revendedor de software de terceros. Consulta nuestro descargo de responsabilidad y política de garantía en el sitio.</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: o.user.email, subject: `Comprobante ${o.reference} – LicenTech Colombia`, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}
