"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { cop } from "@/lib/format";
import { useCart } from "@/components/CartProvider";
import ExchangeRate from "@/components/ExchangeRate";
import CheckoutPrice from "@/components/CheckoutPrice";
import { checkoutPrice, MIN_CREDIT_QUANTITY } from "@/lib/checkout-pricing";
import PaymentBrand from "@/components/PaymentBrand";

const field = "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";

type ManualMethod = { code: string; label: string; instructions: string };
type RentalOption = { id: string; quantity: number; unit: "HOUR" | "MONTH"; priceCop: number };

export default function CheckoutForm({ productId, productSlug, productName, price, maxQty, deliveryType, creditAmount, walletBalance, rentalOptions }: {
  productId: string;
  productSlug: string;
  productName: string;
  price: number;
  maxQty: number;
  deliveryType: "LICENSE_KEY" | "ACCOUNT_ACTIVATION" | "CREDITS" | "RENTAL";
  creditAmount: number | null;
  walletBalance: number | null;
  rentalOptions: RentalOption[];
}) {
  const { addItem } = useCart();
  const [rentalOptionId, setRentalOptionId] = useState(rentalOptions[0]?.id ?? "");
  const [f, setF] = useState({
    buyerName: "",
    buyerEmail: "",
    buyerPhone: "",
    activationEmail: "",
    quantity: deliveryType === "CREDITS" ? MIN_CREDIT_QUANTITY : 1,
  });
  const [method, setMethod] = useState("CARD");
  const [manualMethods, setManualMethods] = useState<ManualMethod[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedMethod = manualMethods.find((payment) => payment.code === method);
  const selectedRental = rentalOptions.find((option) => option.id === rentalOptionId);
  const unitPrice = deliveryType === "RENTAL" ? selectedRental?.priceCop ?? 0 : price;
  const quantityLimit = deliveryType === "CREDITS" ? 1_000_000 : deliveryType === "RENTAL" ? 1 : maxQty;
  const minimumQuantity = deliveryType === "CREDITS" ? MIN_CREDIT_QUANTITY : 1;
  const subtotalCop = unitPrice * f.quantity;
  const totalCop = checkoutPrice(subtotalCop).totalCop;

  useEffect(() => {
    fetch("/api/payment-methods")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los métodos de pago.");
        setManualMethods(await response.json());
      })
      .catch((error) => {
        console.error("No se pudieron cargar los métodos de pago", error);
        setErr("No pudimos cargar los métodos de pago. Recarga la página e inténtalo de nuevo.");
      });
  }, []);

  async function payCard() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/checkout/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity: f.quantity,
          ...(deliveryType === "RENTAL" ? { rentalOptionId } : {}),
          buyerName: f.buyerName,
          buyerEmail: f.buyerEmail,
          buyerPhone: f.buyerPhone,
          ...(deliveryType !== "LICENSE_KEY" ? { activationEmail: f.activationEmail } : {}),
        }),
      });
      const data: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "No pudimos iniciar el pago con tarjeta.";
        setErr(message);
        return;
      }
      if (!data || typeof data !== "object" || !("checkoutUrl" in data) || typeof data.checkoutUrl !== "string") {
        setErr("Wompi no devolvió un enlace de pago válido. Intenta de nuevo.");
        return;
      }

      const checkoutUrl = new URL(data.checkoutUrl);
      if (checkoutUrl.origin !== "https://checkout.wompi.co" || checkoutUrl.pathname !== "/p/") {
        setErr("Wompi devolvió un enlace de pago no seguro. Intenta de nuevo.");
        return;
      }
      const redirectUrl = checkoutUrl.searchParams.get("redirect-url");
      if (redirectUrl) {
        const originalRedirect = new URL(redirectUrl);
        checkoutUrl.searchParams.set(
          "redirect-url",
          new URL(`${originalRedirect.pathname}${originalRedirect.search}`, window.location.origin).toString(),
        );
      }
      window.location.assign(checkoutUrl.toString());
    } catch (error) {
      console.error("No se pudo abrir el Web Checkout de Wompi", error);
      setErr("No pudimos iniciar el checkout seguro de Wompi. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function payManual() {
    setBusy(true);
    setErr("");
    const form = new FormData();
    form.set("productId", productId);
    form.set("quantity", String(f.quantity));
    form.set("paymentMethod", method);
    if (deliveryType !== "LICENSE_KEY") form.set("activationEmail", f.activationEmail);
    if (deliveryType === "RENTAL") form.set("rentalOptionId", rentalOptionId);

    try {
      const response = await fetch("/api/checkout/manual", { method: "POST", body: form });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "No pudimos registrar tu compra con este método de pago.";
        setErr(message);
        return;
      }
      if (!data || typeof data !== "object" || !("trackingUrl" in data) || typeof data.trackingUrl !== "string") {
        setErr("Registramos la compra, pero no pudimos abrir las instrucciones. Contacta al vendedor con tus datos.");
        return;
      }
      const trackingUrl = new URL(data.trackingUrl);
      trackingUrl.searchParams.set("comprobante", "1");
      window.location.assign(`${trackingUrl.pathname}${trackingUrl.search}`);
    } catch (error) {
      console.error("No se pudo registrar la compra manual", error);
      setErr("No pudimos conectar para registrar la compra. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function payWallet() {
    setBusy(true); setErr("");
    try {
      const response = await fetch("/api/checkout/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity: f.quantity,
          ...(deliveryType === "RENTAL" ? { rentalOptionId } : {}),
          ...(deliveryType !== "LICENSE_KEY" ? { activationEmail: f.activationEmail } : {}),
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setErr(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "No se pudo pagar con saldo.");
        return;
      }
      if (!data || typeof data !== "object" || !("trackingUrl" in data) || typeof data.trackingUrl !== "string") {
        setErr("Compra registrada, pero no pudimos abrir el seguimiento.");
        return;
      }
      const trackingUrl = new URL(data.trackingUrl);
      window.location.assign(`${trackingUrl.pathname}${trackingUrl.search}`);
    } catch (error) {
      console.error("No se pudo pagar con saldo", error);
      setErr("No pudimos conectar para pagar con saldo. Intenta de nuevo.");
    } finally { setBusy(false); }
  }

  function pay(e: FormEvent) {
    e.preventDefault();
    if (method === "CARD") void payCard();
    else if (method === "WALLET") void payWallet();
    else void payManual();
  }

  return (
    <form onSubmit={pay} className="space-y-3">
      <h2 className="font-medium">Elige cómo pagar</h2>
      {deliveryType === "RENTAL" && (
        <label className="block space-y-1 text-sm">
          <span>Elige la duración de la renta</span>
          <select className={field} value={rentalOptionId} onChange={(event) => setRentalOptionId(event.target.value)} required>
            {rentalOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.quantity} {option.unit === "HOUR" ? option.quantity === 1 ? "hora" : "horas" : option.quantity === 1 ? "mes" : "meses"} · {cop.format(option.priceCop)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={method === "CARD"} className={`${field} ${method === "CARD" ? "border-teal-800 bg-teal-50" : ""}`} onClick={() => setMethod("CARD")}>Tarjeta de crédito · Wompi</button>
        {manualMethods.map((payment) => (
          <button key={payment.code} type="button" aria-pressed={method === payment.code} className={`${field} ${method === payment.code ? "border-teal-800 bg-teal-50" : ""}`} onClick={() => setMethod(payment.code)}>
            <PaymentBrand code={payment.code} label={payment.label} />
          </button>
        ))}
        {walletBalance !== null && (
          <button type="button" aria-pressed={method === "WALLET"} className={`${field} ${method === "WALLET" ? "border-teal-800 bg-teal-50" : ""}`} onClick={() => setMethod("WALLET")}>
            Pagar con saldo · {cop.format(walletBalance)}
          </button>
        )}
      </div>
      {method === "CARD" ? (
        <>
          <label className="block space-y-1 text-sm">
            <span>Nombre del comprador</span>
            <input className={field} autoComplete="name" value={f.buyerName} onChange={(e) => setF({ ...f, buyerName: e.target.value })} minLength={2} maxLength={100} required />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{deliveryType === "LICENSE_KEY" ? "Correo donde recibirás la clave" : "Tu correo de contacto"}</span>
            <input className={field} type="email" autoComplete="email" value={f.buyerEmail} onChange={(e) => setF({ ...f, buyerEmail: e.target.value })} maxLength={120} required />
          </label>
          {deliveryType !== "LICENSE_KEY" && (
            <label className="block space-y-1 text-sm">
              <span>Correo registrado en la cuenta del software</span>
              <input className={field} type="email" autoComplete="off" value={f.activationEmail} onChange={(e) => setF({ ...f, activationEmail: e.target.value })} maxLength={120} required />
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span>WhatsApp de contacto</span>
            <input className={field} type="tel" autoComplete="tel" value={f.buyerPhone} onChange={(e) => setF({ ...f, buyerPhone: e.target.value })} minLength={7} maxLength={20} required />
          </label>
          <p className="text-sm text-stone-600">El pago se completa en el checkout seguro de Wompi. {deliveryType === "LICENSE_KEY" ? "La clave se entrega después de verificar el pago." : deliveryType === "RENTAL" ? "El administrador activa la renta elegida después de verificar el pago." : "El administrador procesará manualmente la activación o los créditos después de verificar el pago."}</p>
        </>
      ) : method === "WALLET" ? (
        <div className="space-y-3 text-sm">
          <p>Saldo disponible: <strong>{cop.format(walletBalance ?? 0)}</strong>.</p>
          <CheckoutPrice subtotalCop={subtotalCop} />
          {deliveryType !== "LICENSE_KEY" && (
            <label className="block space-y-1">
              <span>Correo registrado en la cuenta del software</span>
              <input className={field} type="email" value={f.activationEmail} maxLength={120} required onChange={(e) => setF({ ...f, activationEmail: e.target.value })} />
            </label>
          )}
          <p className="text-stone-600">El saldo se descontará al registrar la compra. Si el inventario de claves se agota durante el proceso, el importe se reintegrará automáticamente.</p>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {selectedMethod ? (
            <>
              <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-4">
                <p className="font-medium"><PaymentBrand code={selectedMethod.code} label={selectedMethod.label} /></p>
                <p className="whitespace-pre-line">{selectedMethod.instructions}</p>
                <p>Transfiere el total indicado. Al continuar se creará tu pedido y podrás subir el comprobante.</p>
              </div>
              <p>Para revisar el pago y enviar las credenciales necesitaremos tu correo de contacto y WhatsApp{deliveryType === "LICENSE_KEY" ? "." : " y el correo de la cuenta del software."}</p>
              {deliveryType !== "LICENSE_KEY" && (
                <label className="block space-y-1">
                  <span>Correo registrado en la cuenta del software para la activación o los créditos</span>
                  <input className={field} type="email" autoComplete="off" maxLength={120} required value={f.activationEmail} onChange={(event) => setF({ ...f, activationEmail: event.target.value })} />
                </label>
              )}
            </>
          ) : (
            <p className="text-red-700">Selecciona un método manual que esté habilitado desde el panel de administración.</p>
          )}
          <p className="text-stone-600">{deliveryType === "LICENSE_KEY" ? "La clave se entrega solo después de verificar el pago." : `La gestión manual de la activación o los ${creditAmount ?? ""} créditos comienza después de verificar el pago.`}</p>
        </div>
      )}
      {deliveryType === "CREDITS" && (
        <p className="text-sm text-stone-600">Precio por crédito: {cop.format(price)}.</p>
      )}
      <label className="flex items-center gap-3 text-sm">
        {deliveryType === "CREDITS" ? "Cantidad de créditos" : deliveryType === "RENTAL" ? "Cantidad de rentas" : "Cantidad"}
        <input
          className={`${field} w-28`}
          type="number"
          min={minimumQuantity}
          max={quantityLimit}
          value={f.quantity}
          onChange={(e) => setF({ ...f, quantity: Math.max(1, Math.min(quantityLimit, Number(e.target.value) || 1)) })}
          onBlur={() => setF((current) => ({ ...current, quantity: Math.max(minimumQuantity, current.quantity) }))}
        />
      </label>
      {deliveryType === "CREDITS" && f.quantity < MIN_CREDIT_QUANTITY && (
        <p role="alert" className="text-sm text-red-700">
          La compra mínima es de {MIN_CREDIT_QUANTITY} créditos.
        </p>
      )}
      <CheckoutPrice subtotalCop={subtotalCop} />
      <ExchangeRate amountCop={totalCop} />
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <button disabled={busy || (deliveryType === "CREDITS" && f.quantity < minimumQuantity) || (deliveryType === "RENTAL" && !selectedRental) || (method !== "CARD" && method !== "WALLET" && !selectedMethod) || (method === "WALLET" && (walletBalance ?? 0) < totalCop)} className="w-full rounded bg-teal-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? method === "CARD" ? "Conectando con Wompi…" : "Procesando pago…" : method === "CARD" ? "Pagar con tarjeta en Wompi" : method === "WALLET" ? "Pagar con saldo" : "Continuar con pago manual"}
      </button>
      <button
        type="button"
        disabled={deliveryType === "RENTAL" && !selectedRental}
        className="w-full rounded border border-teal-800 px-3 py-2 text-sm font-medium text-teal-900 disabled:opacity-50"
        onClick={() => {
          const quantity = Math.max(minimumQuantity, f.quantity);
          addItem({
            productId,
            slug: productSlug,
            name: productName,
            priceCop: unitPrice,
            deliveryType,
            creditAmount,
            quantity,
            maxQty: quantityLimit,
            available: true,
            rentalOptions,
            ...(deliveryType === "RENTAL" && selectedRental ? {
              rentalOptionId: selectedRental.id,
            } : {}),
            ...(deliveryType !== "LICENSE_KEY" && f.activationEmail ? { activationEmail: f.activationEmail } : {}),
          });
        }}
      >
        Agregar al carrito
      </button>
    </form>
  );
}
