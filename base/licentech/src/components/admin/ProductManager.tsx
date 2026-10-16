"use client";
import { useEffect, useState } from "react";

type Product = {
  id: string; name: string; slug: string; vendor: string; version: string;
  description: string; priceCop: number; active: boolean; stock: number;
};
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const blank = { name: "", slug: "", vendor: "", version: "", description: "", priceCop: 0, active: true };
const input = "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";
const btn = "rounded bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50";

export default function ProductManager() {
  const [items, setItems] = useState<Product[]>([]);
  const [draft, setDraft] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [keysFor, setKeysFor] = useState("");
  const [keysText, setKeysText] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const r = await fetch("/api/admin/products");
    if (r.ok) setItems(await r.json());
  };
  useEffect(() => { load(); }, []);

  async function send(url: string, method: string, body?: unknown, okMsg = "Guardado") {
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    setMsg(r.ok ? (data.archived ? "Archivado (tiene ventas)" : data.added !== undefined ? `${data.added} claves agregadas, ${data.duplicates} duplicadas` : okMsg) : "Revisa los datos e intenta de nuevo");
    if (r.ok) await load();
    return r.ok;
  }

  const createProduct = async () => {
    if (await send("/api/admin/products", "POST", draft, "Producto creado")) setDraft(blank);
  };
  const savePrice = async (id: string) => {
    if (await send(`/api/admin/products/${id}`, "PATCH", { priceCop: editPrice }, "Precio actualizado")) setEditId(null);
  };
  const uploadKeys = async () => {
    const keys = keysText.split("\n").map((k) => k.trim()).filter(Boolean);
    if (await send("/api/admin/licenses", "POST", { productId: keysFor, keys })) setKeysText("");
  };

  return (
    <section className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Productos e inventario</h1>
      <p role="status" className="min-h-5 text-sm text-teal-800">{msg}</p>

      <div className="grid gap-3 rounded border border-stone-200 p-4 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">Nuevo producto</h2>
        <input className={input} placeholder="Nombre (ej. Windows 11 Pro)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className={input} placeholder="Slug (windows-11-pro)" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
        <input className={input} placeholder="Fabricante (Microsoft)" value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />
        <input className={input} placeholder="Versión (23H2)" value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} />
        <input className={input} type="number" min={1000} placeholder="Precio en COP" value={draft.priceCop || ""} onChange={(e) => setDraft({ ...draft, priceCop: Number(e.target.value) })} />
        <textarea className={`${input} sm:col-span-2`} rows={3} placeholder="Descripción" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <div className="sm:col-span-2"><button className={btn} onClick={createProduct}>Crear producto</button></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 text-stone-600">
            <tr><th className="py-2">Producto</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 align-middle">
                <td className="py-2"><div className="font-medium">{p.name}</div><div className="text-stone-500">{p.vendor} · {p.version}</div></td>
                <td>
                  {editId === p.id ? (
                    <span className="flex gap-2">
                      <input className={`${input} w-32`} type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} />
                      <button className={btn} onClick={() => savePrice(p.id)}>Guardar</button>
                    </span>
                  ) : (
                    <button className="underline decoration-dotted" onClick={() => { setEditId(p.id); setEditPrice(p.priceCop); }}>{cop.format(p.priceCop)}</button>
                  )}
                </td>
                <td className={p.stock === 0 ? "font-medium text-red-700" : ""}>{p.stock}</td>
                <td>
                  <button onClick={() => send(`/api/admin/products/${p.id}`, "PATCH", { active: !p.active })}>{p.active ? "Activo" : "Oculto"}</button>
                </td>
                <td className="space-x-3 text-right">
                  <button onClick={() => setKeysFor(p.id)}>Cargar claves</button>
                  <button className="text-red-700" onClick={() => confirm(`¿Eliminar ${p.name}?`) && send(`/api/admin/products/${p.id}`, "DELETE", undefined, "Eliminado")}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {keysFor && (
        <div className="space-y-3 rounded border border-stone-200 p-4">
          <h2 className="font-medium">Cargar claves para {items.find((p) => p.id === keysFor)?.name}</h2>
          <textarea className={`${input} font-mono`} rows={8} placeholder="Una clave por línea" value={keysText} onChange={(e) => setKeysText(e.target.value)} />
          <div className="flex gap-3">
            <button className={btn} disabled={!keysText.trim()} onClick={uploadKeys}>Subir lote</button>
            <button onClick={() => setKeysFor("")}>Cerrar</button>
          </div>
        </div>
      )}
    </section>
  );
}
