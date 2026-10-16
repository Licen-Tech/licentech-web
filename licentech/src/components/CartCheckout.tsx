"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useCart } from "@/components/CartProvider";
import { cop } from "@/lib/format";
import ExchangeRate from "@/components/ExchangeRate";
import CheckoutPrice from "@/components/CheckoutPrice";
import { checkoutPrice, MIN_CREDIT_QUANTITY } from "@/lib/checkout-pricing";
import PaymentBrand from "@/components/PaymentBrand";

type ManualMethod = { code: string; label: string; instructions: string };
type CartCheckoutProduct = {
  id: string;
  slug: string;
  name: string;
  priceCop: number;
  deliveryType: "LICENSE_KEY" | "ACCOUNT_ACTIVATION" | "CREDITS" | "RENTAL";
  creditAmount: number | null;
  availableStock: number | null;
  rentalOptions: Array<{ id: string; quantity: number; unit: "HOUR" | "MONTH"; priceCop: number }>;
};
const field = "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";

export default function CartCheckout() {
  const { items, ready, updateItem, removeItem, clearCart } = useCart();
  const { syncItems } = useCart();
  const [methods, setMethods] = useState<ManualMethod[]>([]);
  const [method, setMethod] = useState("CARD");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [catalogChecked, setCatalogChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const didSyncCatalog = useRef(false);
  const subtotal = items.reduce((sum, item) => sum + item.priceCop * item.quantity, 0);
  const total = checkoutPrice(subtotal).totalCop;

  useEffect(() => {
    fetch("/api/payment-methods")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar los métodos de pago.");
        setMethods(await response.json());
      })
      .catch((loadError) => {
        console.error("No se pudieron cargar los métodos de pago", loadError);
        setError("No pudimos cargar los métodos de pago. Recarga la página e inténtalo de nuevo.");
      });
  }, []);

  useEffect(() => {
    if (!ready || didSyncCatalog.current) return;
    didSyncCatalog.current = true;
    if (items.length === 0) {
      setCatalogChecked(true);
      return;
    }

    async function verifyCart() {
      setCatalogChecked(false);
      const response = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: items.map((item) => item.productId) }),
      });
      if (!response.ok) throw new Error("No se pudo comprobar la disponibilidad y los precios actuales.");
      const result: unknown = await response.json();
      if (!Array.isArray(result)) throw new Error("El servidor devolvió datos inválidos para el carrito.");
      const updates = result.flatMap((entry): Array<{
        productId: string;
        slug: string;
        name: string;
        priceCop: number;
        deliveryType: CartCheckoutProduct["deliveryType"];
        creditAmount: number | null;
        maxQty: number;
        available: boolean;
        rentalOptions: CartCheckoutProduct["rentalOptions"];
      }> => {
        if (!entry || typeof entry !== "object") return [];
        const product = entry as Partial<CartCheckoutProduct>;
        if (typeof product.id !== "string"
          || typeof product.slug !== "string"
          || typeof product.name !== "string"
          || !Number.isInteger(product.priceCop)
          || !["LICENSE_KEY", "ACCOUNT_ACTIVATION", "CREDITS", "RENTAL"].includes(product.deliveryType ?? "")
          || !(product.creditAmount === null || Number.isInteger(product.creditAmount))
          || !(product.availableStock === null || Number.isInteger(product.availableStock))
          || !Array.isArray(product.rentalOptions)) return [];
        const available = product.deliveryType !== "LICENSE_KEY" || (product.availableStock ?? 0) > 0;
        const maxQty = product.deliveryType === "LICENSE_KEY"
          ? Math.min(5, product.availableStock ?? 0)
          : product.deliveryType === "CREDITS" ? 1_000_000 : 5;
        return [{
          productId: product.id,
          slug: product.slug,
          name: product.name,
          priceCop: product.priceCop!,
          deliveryType: product.deliveryType!,
          creditAmount: product.creditAmount!,
          maxQty,
          available,
          rentalOptions: product.rentalOptions,
        }];
      });
      const refreshedIds = new Set(updates.map((product) => product.productId));
      const removed = items.filter((item) => !refreshedIds.has(item.productId));
      const changed = items.some((item) => {
        const refreshed = updates.find((product) => product.productId === item.productId);
        if (!refreshed) return false;
        const currentUnitPrice = item.deliveryType === "RENTAL"
          ? refreshed.rentalOptions.find((option) => option.id === item.rentalOptionId)?.priceCop
          : refreshed.priceCop;
        return currentUnitPrice !== item.priceCop || !refreshed.available || item.quantity > refreshed.maxQty;
      });
      syncItems(updates);
      if (removed.length) setNotice("Quitamos del carrito productos que ya no están publicados.");
      else if (changed) setNotice("Actualizamos precios o disponibilidad del carrito. Revisa el total antes de pagar.");
      setCatalogChecked(true);
    }

    void verifyCart().catch((verificationError) => {
      console.error("No se pudo actualizar el carrito", verificationError);
      setError("No pudimos comprobar los precios y el stock actuales. Vuelve a intentarlo antes de pagar.");
    });
  }, [items, ready, syncItems]);

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!items.length) return;
    setBusy(true);
    setError("");
    const lines = items.map(({ productId, quantity, deliveryType, activationEmail, rentalOptionId }) => ({
      productId,
      quantity,
      ...(deliveryType !== "LICENSE_KEY" ? { activationEmail } : {}),
      ...(deliveryType === "RENTAL" ? { rentalOptionId } : {}),
    }));
    try {
      if (method === "CARD") {
        const response = await fetch("/api/checkout/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: lines, buyerName, buyerEmail, buyerPhone }),
        });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setError(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "No pudimos iniciar el pago.");
          return;
        }
        if (!data || typeof data !== "object" || !("checkoutUrl" in data) || typeof data.checkoutUrl !== "string") {
          setError("Wompi no devolvió un enlace de pago válido.");
          return;
        }
        const checkoutUrl = new URL(data.checkoutUrl);
        if (checkoutUrl.origin !== "https://checkout.wompi.co" || checkoutUrl.pathname !== "/p/") {
          setError("Wompi devolvió un enlace de pago no seguro.");
          return;
        }
        const redirectUrl = checkoutUrl.searchParams.get("redirect-url");
        if (redirectUrl) {
          const originalRedirect = new URL(redirectUrl);
          checkoutUrl.searchParams.set("redirect-url", new URL(`${originalRedirect.pathname}${originalRedirect.search}`, window.location.origin).toString());
        }
        clearCart();
        window.location.assign(checkoutUrl.toString());
        return;
      }

      if (method === "WALLET") {
        const response = await fetch("/api/checkout/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: lines }),
        });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setError(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "No se pudo pagar con saldo.");
          return;
        }
        if (!data || typeof data !== "object" || !("trackingUrl" in data) || typeof data.trackingUrl !== "string") {
          setError("Compra registrada, pero no pudimos abrir el seguimiento.");
          return;
        }
        const trackingUrl = new URL(data.trackingUrl);
        clearCart();
        window.location.assign(`${trackingUrl.pathname}${trackingUrl.search}`);
        return;
      }

      const form = new FormData();
      form.set("paymentMethod", method);
      form.set("items", JSON.stringify(lines));
      const response = await fetch("/api/checkout/manual", { method: "POST", body: form });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "No pudimos registrar la compra.");
        return;
      }
      if (!data || typeof data !== "object" || !("trackingUrl" in data) || typeof data.trackingUrl !== "string") {
        setError("Compra registrada, pero no pudimos abrir las instrucciones.");
        return;
      }
      const trackingUrl = new URL(data.trackingUrl);
      trackingUrl.searchParams.set("comprobante", "1");
      clearCart();
      window.location.assign(`${trackingUrl.pathname}${trackingUrl.search}`);
    } catch (checkoutError) {
      console.error("No se pudo procesar el carrito", checkoutError);
      setError("No pudimos conectar para procesar la compra. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-stone-600">Cargando el carrito…</p>;
  if (!items.length) return <p className="text-stone-600">Tu carrito está vacío. <a className="underline" href="/">Explora el catálogo.</a></p>;

  const selectedMethod = methods.find((payment) => payment.code === method);
  return (
    <form onSubmit={(event) => void checkout(event)} className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Tu carrito</h1>
        {items.map((item) => (
          <article key={item.productId} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <a className="font-medium text-teal-900 underline" href={`/productos/${encodeURIComponent(item.slug)}`}>{item.name}</a>
                <p className="text-sm text-stone-600">{cop.format(item.priceCop)}{item.deliveryType === "CREDITS" ? " por crédito" : " por unidad"}</p>
              </div>
              <button type="button" onClick={() => removeItem(item.productId)} className="text-sm text-red-700 underline">Quitar</button>
            </div>
            {item.deliveryType === "RENTAL" && (
              <label className="block space-y-1 text-sm">
                <span>Duración de la renta</span>
                <select className={field} value={item.rentalOptionId ?? ""} onChange={(event) => updateItem(item.productId, { rentalOptionId: event.target.value })}>
                  {item.rentalOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.quantity} {option.unit === "HOUR" ? option.quantity === 1 ? "hora" : "horas" : option.quantity === 1 ? "mes" : "meses"} · {cop.format(option.priceCop)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-3 text-sm">
              {item.deliveryType === "CREDITS" ? "Cantidad de créditos" : item.deliveryType === "RENTAL" ? "Cantidad de rentas" : "Cantidad"}
              <input
                className={`${field} w-24`}
                type="number"
                min={item.deliveryType === "CREDITS" ? MIN_CREDIT_QUANTITY : 1}
                max={item.maxQty}
                value={item.quantity}
                onChange={(event) => updateItem(item.productId, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                onBlur={() => {
                  if (item.quantity < 1) updateItem(item.productId, { quantity: 1 });
                }}
              />
            </label>
            {item.deliveryType === "CREDITS" && item.quantity < MIN_CREDIT_QUANTITY && (
              <p role="alert" className="text-sm text-red-700">
                La compra mínima es de {MIN_CREDIT_QUANTITY} créditos.
              </p>
            )}
            {item.deliveryType !== "LICENSE_KEY" && (
              <label className="block space-y-1 text-sm">
                <span>Correo registrado en la cuenta del software</span>
                <input className={field} type="email" maxLength={120} required value={item.activationEmail ?? ""}
                  onChange={(event) => updateItem(item.productId, { activationEmail: event.target.value })} />
              </label>
            )}
            <p className="text-right text-sm font-medium">{cop.format(item.priceCop * item.quantity)}</p>
            {!item.available && <p role="alert" className="text-sm text-red-700">Agotado por ahora; quita este producto o vuelve a consultar más tarde.</p>}
          </article>
        ))}
      </section>

      <aside className="h-fit space-y-4 rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Pago</h2>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Método de pago</legend>
          <button type="button" aria-pressed={method === "CARD"} className={`${field} text-left ${method === "CARD" ? "border-teal-800 bg-teal-50" : ""}`} onClick={() => setMethod("CARD")}>Tarjeta · Wompi</button>
          {methods.map((payment) => (
            <button key={payment.code} type="button" aria-pressed={method === payment.code} className={`${field} text-left ${method === payment.code ? "border-teal-800 bg-teal-50" : ""}`} onClick={() => setMethod(payment.code)}>
              <PaymentBrand code={payment.code} label={payment.label} />
            </button>
          ))}
          <button type="button" aria-pressed={method === "WALLET"} className={`${field} text-left ${method === "WALLET" ? "border-teal-800 bg-teal-50" : ""}`} onClick={() => setMethod("WALLET")}>Saldo LicenTech (requiere iniciar sesión)</button>
        </fieldset>
        {method === "CARD" && (
          <>
            <label className="block space-y-1 text-sm"><span>Nombre del comprador</span><input className={field} value={buyerName} onChange={(event) => setBuyerName(event.target.value)} minLength={2} maxLength={100} required /></label>
            <label className="block space-y-1 text-sm"><span>Correo de contacto y entrega</span><input className={field} type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} maxLength={120} required /></label>
            <label className="block space-y-1 text-sm"><span>WhatsApp de contacto</span><input className={field} type="tel" value={buyerPhone} onChange={(event) => setBuyerPhone(event.target.value)} minLength={7} maxLength={20} required /></label>
            <p className="text-sm text-stone-600">El pago se completa en el checkout seguro de Wompi.</p>
          </>
        )}
        {selectedMethod && (
          <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm">
            <p className="font-medium"><PaymentBrand code={selectedMethod.code} label={selectedMethod.label} /></p>
            <p className="whitespace-pre-line text-stone-700">{selectedMethod.instructions}</p>
            <p>Al continuar se creará tu pedido. Después de transferir, podrás subir el comprobante y registrar tu correo y WhatsApp.</p>
          </div>
        )}
        <div className="border-t border-stone-200 pt-3">
          <CheckoutPrice subtotalCop={subtotal} />
        </div>
        <ExchangeRate amountCop={total} />
        {notice && <p role="status" className="text-sm text-amber-800">{notice}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {!catalogChecked && error && (
          <button type="button" className="w-full rounded border border-teal-800 px-3 py-2 text-sm font-medium text-teal-900" onClick={() => window.location.reload()}>
            Reintentar verificación
          </button>
        )}
        <button disabled={busy || !catalogChecked || items.some((item) => !item.available || item.quantity > item.maxQty || (item.deliveryType === "CREDITS" && item.quantity < MIN_CREDIT_QUANTITY)) || (method !== "CARD" && method !== "WALLET" && !selectedMethod)} className="w-full rounded bg-teal-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {!catalogChecked ? "Comprobando carrito…" : busy ? "Procesando…" : method === "CARD" ? "Continuar a Wompi" : method === "WALLET" ? "Pagar con saldo" : "Registrar compra y cargar comprobante"}
        </button>
      </aside>
    </form>
  );
}
