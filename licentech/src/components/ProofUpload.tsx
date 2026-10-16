"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const field = "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";

export default function ProofUpload({
  endpoint,
  autoStart = false,
  requiresActivationEmail = false,
}: {
  endpoint: string;
  autoStart?: boolean;
  requiresActivationEmail?: boolean;
}) {
  const [started, setStarted] = useState(autoStart);
  const [uploaded, setUploaded] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(endpoint, { method: "POST", body: form });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "No pudimos guardar el comprobante. Intenta de nuevo.";
        setError(message);
        return;
      }
      setUploaded(true);
      if (data && typeof data === "object" && "whatsappUrl" in data
        && typeof data.whatsappUrl === "string"
        && data.whatsappUrl.startsWith("https://wa.me/")) {
        setWhatsappUrl(data.whatsappUrl);
        window.location.assign(data.whatsappUrl);
      }
    } catch (cause) {
      console.error("No se pudo cargar el comprobante", cause);
      setError("No pudimos conectar para cargar el comprobante. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (uploaded) {
    return (
      <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm">
        <p role="status" className="font-medium text-teal-900">Comprobante recibido. Te estamos redirigiendo a WhatsApp para avisar al vendedor. El pago se revisará antes de entregar tu producto.</p>
        {whatsappUrl ? (
          <a className="inline-block rounded bg-green-700 px-4 py-2 font-medium text-white" href={whatsappUrl}>
            Abrir WhatsApp
          </a>
        ) : (
          <p className="text-stone-700">Conserva tu código de compra para consultar el estado del pago.</p>
        )}
      </div>
    );
  }

  if (!started) {
    return (
      <button
        type="button"
        className="w-full rounded bg-teal-800 px-4 py-3 text-sm font-medium text-white"
        onClick={() => setStarted(true)}
      >
        Ya realicé el pago
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-950">
        Sube el comprobante de tu pago. Necesitamos estos datos para revisar la transacción y gestionar la entrega.
      </p>
      <label className="block space-y-1 text-sm">
        <span>Tu nombre</span>
        <input className={field} name="buyerName" autoComplete="name" minLength={2} maxLength={100} required />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Tu correo de contacto</span>
        <input className={field} name="buyerEmail" type="email" autoComplete="email" maxLength={120} required />
      </label>
      {requiresActivationEmail && (
        <label className="block space-y-1 text-sm">
          <span>Correo registrado en la cuenta del software</span>
          <input className={field} name="activationEmail" type="email" autoComplete="off" maxLength={120} required />
        </label>
      )}
      <label className="block space-y-1 text-sm">
        <span>Tu WhatsApp de contacto</span>
        <input className={field} name="buyerPhone" type="tel" autoComplete="tel" minLength={7} maxLength={20} required />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Comprobante (JPG, PNG, WEBP o PDF; máximo 5 MB)</span>
        <input className={field} name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="rounded bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Cargando comprobante…" : "Subir comprobante"}
      </button>
    </form>
  );
}
