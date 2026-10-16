"use client";

import { useEffect, useState } from "react";
import { cop } from "@/lib/format";

type TopUp = {
  id: string; amountCop: number; paymentMethod: string; reference: string; createdAt: string;
  user: { name: string; email: string };
};

export default function WalletReview() {
  const [items, setItems] = useState<TopUp[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/admin/wallet/top-ups");
    if (!response.ok) {
      setMessage("No se pudieron cargar las recargas pendientes.");
      return;
    }
    setItems(await response.json());
  }
  useEffect(() => { void load(); }, []);

  async function review(item: TopUp, action: "approve" | "reject") {
    if (!window.confirm(action === "approve"
      ? `¿Verificaste el pago de ${cop.format(item.amountCop)}? Se acreditará al saldo de ${item.user.email}.`
      : `¿Rechazar la recarga ${item.reference}?`)) return;
    setBusy(item.id); setMessage("");
    try {
      const response = await fetch(`/api/admin/wallet/top-ups/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "No se pudo revisar la recarga.");
        return;
      }
      setMessage(action === "approve" ? "Recarga aprobada y saldo acreditado." : "Recarga rechazada.");
      await load();
    } catch (error) {
      console.error("No se pudo revisar la recarga", error);
      setMessage("No pudimos conectar para revisar la recarga.");
    } finally { setBusy(""); }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Recargas de saldo por verificar ({items.length})</h2>
      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
      {items.length === 0 ? <p className="text-sm text-stone-500">No hay recargas pendientes.</p> : items.map((item) => (
        <article key={item.id} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-medium">{item.user.name} · {item.user.email}</p>
            <p className="font-semibold">{cop.format(item.amountCop)}</p>
          </div>
          <p className="text-sm text-stone-600">{item.reference} · {item.paymentMethod} · {new Date(item.createdAt).toLocaleString("es-CO")}</p>
          <a className="text-sm underline" href={`/api/admin/wallet/top-ups/${item.id}`} target="_blank" rel="noreferrer">Ver comprobante</a>
          <div className="flex gap-3">
            <button disabled={busy === item.id} className="rounded bg-teal-800 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void review(item, "approve")}>Aprobar y acreditar</button>
            <button disabled={busy === item.id} className="rounded border border-red-300 px-3 py-2 text-sm text-red-800 disabled:opacity-50" onClick={() => void review(item, "reject")}>Rechazar</button>
          </div>
        </article>
      ))}
    </section>
  );
}
