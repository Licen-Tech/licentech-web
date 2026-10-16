"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { cop } from "@/lib/format";

type Method = { code: string; label: string; instructions: string };
type TopUp = { id: string; amountCop: number; paymentMethod: string; reference: string; status: string; createdAt: string };
type WalletData = { balanceCop: number; topUps: TopUp[]; methods: Method[] };

const input = "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm";
const statusLabel: Record<string, string> = { PENDING: "Pendiente", REVIEW: "Por revisar", APPROVED: "Aprobada", REJECTED: "Rechazada" };

export default function WalletDashboard() {
  const [data, setData] = useState<WalletData>({ balanceCop: 0, topUps: [], methods: [] });
  const [amount, setAmount] = useState(10000);
  const [method, setMethod] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/wallet/top-ups");
    if (!response.ok) throw new Error("No se pudo cargar el saldo y el historial.");
    const result: WalletData = await response.json();
    setData(result);
    setMethod((current) => current || result.methods[0]?.code || "");
  }, []);

  useEffect(() => {
    load().catch((error) => {
      console.error("No se pudo cargar la billetera", error);
      setMessage("No pudimos cargar tu saldo. Inicia sesión de nuevo e inténtalo.");
    }).finally(() => setLoading(false));
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proof) {
      setMessage("Adjunta el comprobante de pago.");
      return;
    }
    setBusy(true); setMessage("");
    const form = new FormData();
    form.set("amountCop", String(amount));
    form.set("paymentMethod", method);
    form.set("proof", proof);
    try {
      const response = await fetch("/api/wallet/top-ups", { method: "POST", body: form });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "No se pudo registrar la recarga.";
        setMessage(error);
        return;
      }
      setMessage("Solicitud de recarga recibida. El saldo se acredita después de verificar el comprobante.");
      setProof(null);
      await load();
    } catch (error) {
      console.error("No se pudo registrar la recarga", error);
      setMessage("No pudimos conectar para registrar la recarga.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-sm font-medium text-teal-800">LICENTECH · BILLETERA</p>
        <h1 className="mt-1 text-3xl font-semibold">Saldo y recargas</h1>
      </div>
      <div className="rounded-lg bg-teal-950 p-5 text-white">
        <p className="text-sm text-teal-100">Saldo disponible</p>
        <p className="mt-1 text-3xl font-semibold">{loading ? "Cargando…" : cop.format(data.balanceCop)}</p>
      </div>
      {data.methods.length === 0 ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">El administrador aún no habilita métodos manuales para recargar saldo.</p>
      ) : (
        <form className="space-y-3 rounded-lg border border-stone-200 bg-white p-5" onSubmit={submit}>
          <h2 className="font-semibold">Solicitar recarga manual</h2>
          <label className="block space-y-1 text-sm"><span>Valor en COP (mínimo $10.000)</span><input className={input} type="number" min={10000} max={50000000} step={1000} value={amount} required onChange={(event) => setAmount(Number(event.target.value))} /></label>
          <label className="block space-y-1 text-sm"><span>Método</span><select className={input} value={method} required onChange={(event) => setMethod(event.target.value)}>{data.methods.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
          {data.methods.find((item) => item.code === method) && <p className="whitespace-pre-line rounded bg-stone-50 p-3 text-sm">{data.methods.find((item) => item.code === method)?.instructions}</p>}
          <label className="block space-y-1 text-sm"><span>Comprobante JPG, PNG, WEBP o PDF (máximo 5 MB)</span><input className={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></label>
          {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
          <button disabled={busy} className="rounded bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Enviando solicitud…" : "Enviar recarga para revisión"}</button>
        </form>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historial de recargas</h2>
        {data.topUps.length === 0 ? <p className="text-sm text-stone-500">Aún no tienes recargas.</p> : data.topUps.map((topUp) => (
          <article key={topUp.id} className="flex flex-wrap justify-between gap-2 rounded border border-stone-200 bg-white p-4 text-sm">
            <div><p className="font-medium">{cop.format(topUp.amountCop)} · {topUp.paymentMethod}</p><p className="text-xs text-stone-500">{topUp.reference} · {new Date(topUp.createdAt).toLocaleString("es-CO")}</p></div>
            <span>{statusLabel[topUp.status] ?? topUp.status}</span>
          </article>
        ))}
      </section>
    </section>
  );
}
