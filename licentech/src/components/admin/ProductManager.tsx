"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Product = {
  id: string; name: string; slug: string; vendor: string; version: string;
  description: string; youtubeUrl: string | null; officialUrl: string | null; priceCop: number; active: boolean; stock: number;
  deliveryType: "LICENSE_KEY" | "ACCOUNT_ACTIVATION" | "CREDITS" | "RENTAL";
  creditAmount: number | null; deliveryDetails: string | null; hasImage: boolean;
  category: string; searchTerms: string; coverMediaId: string | null;
  coverMedia: { id: string; externalUrl: string | null; altText: string } | null;
  gallery: { mediaId: string }[];
  rentalOptions: RentalPlan[];
};
type RentalPlan = { id?: string; quantity: number; unit: "HOUR" | "MONTH"; priceCop: number; active: boolean };
type Media = { id: string; name: string; externalUrl: string | null; mimeType: string | null };
type ProductFields = Omit<Product, "id" | "stock" | "hasImage" | "coverMedia" | "gallery">;
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const blank: {
  name: string; slug: string; vendor: string; version: string; description: string; youtubeUrl: string; officialUrl: string; priceCop: number;
  deliveryType: "LICENSE_KEY" | "ACCOUNT_ACTIVATION" | "CREDITS" | "RENTAL"; creditAmount: number | null;
  rentalOptions: RentalPlan[];
  deliveryDetails: string; active: boolean; category: string; searchTerms: string; coverMediaId: string;
} = {
  name: "", slug: "", vendor: "", version: "", description: "", youtubeUrl: "", officialUrl: "", category: "Software", searchTerms: "", priceCop: 0,
  deliveryType: "LICENSE_KEY", creditAmount: null, rentalOptions: [], deliveryDetails: "", active: false,
  coverMediaId: "",
};
const input = "w-full rounded border border-stone-300 px-3 py-2 text-sm transition-colors focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/30";
const buttonInteraction = "transition duration-150 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const btn = `rounded bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 ${buttonInteraction}`;
const btnSecondary = `rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-teal-700 hover:bg-teal-50 hover:text-teal-900 ${buttonInteraction}`;
const btnDanger = `rounded border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:border-red-400 hover:bg-red-50 ${buttonInteraction}`;
const btnLink = `rounded px-2 py-1 text-sm font-medium text-teal-800 underline decoration-dotted underline-offset-2 hover:bg-teal-50 ${buttonInteraction}`;
const fieldLabels: Record<string, string> = {
  name: "Nombre",
  slug: "Slug",
  vendor: "Fabricante",
  version: "Versión",
  description: "Descripción",
  officialUrl: "Página oficial",
  priceCop: "Precio",
};

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const details = error as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    const fieldMessages = Object.entries(details.fieldErrors ?? {}).flatMap(([field, messages]) =>
      messages.map((message) => `${fieldLabels[field] ?? field}: ${message}`),
    );
    const messages = [...(details.formErrors ?? []), ...fieldMessages];
    if (messages.length) return messages.join(" ");
  }
  return "No se pudo guardar. Revisa los datos e intenta de nuevo.";
}

export default function ProductManager() {
  const [items, setItems] = useState<Product[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [draft, setDraft] = useState(blank);
  const [editingProduct, setEditingProduct] = useState<{ id: string; fields: ProductFields; galleryMediaIds: string[] } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [keysFor, setKeysFor] = useState("");
  const [keysText, setKeysText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const editFormRef = useRef<HTMLFormElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const editingProductId = editingProduct?.id;

  const load = async () => {
    const [r, mediaResponse] = await Promise.all([fetch("/api/admin/products"), fetch("/api/admin/media")]);
    if (!r.ok || !mediaResponse.ok) {
      setMsg("No se pudieron cargar los productos.");
      return;
    }
    const [products, assets] = await Promise.all([r.json(), mediaResponse.json()]);
    setItems(products);
    setMedia(assets);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);
  useEffect(() => {
    if (!editingProductId) return;
    let focusTimer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      editFormRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      focusTimer = window.setTimeout(() => editNameRef.current?.focus({ preventScroll: true }), reducedMotion ? 0 : 350);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
    };
  }, [editingProductId]);

  async function send(url: string, method: string, body?: unknown, okMsg = "Guardado") {
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    setMsg(r.ok
      ? (data.archived ? "Archivado (tiene ventas)" : data.added !== undefined ? `${data.added} claves agregadas, ${data.duplicates} duplicadas` : okMsg)
      : r.status === 403
        ? "Esta acción requiere una cuenta administradora. Cierra sesión e inicia sesión con la cuenta de administrador."
        : getErrorMessage(data.error));
    if (r.ok) await load();
    return r.ok;
  }

  const createProduct = async () => {
    setSaving(true);
    setMsg("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          youtubeUrl: draft.youtubeUrl || null,
          officialUrl: draft.officialUrl || null,
          creditAmount: draft.deliveryType === "CREDITS" ? draft.creditAmount : null,
          priceCop: draft.deliveryType === "RENTAL" ? 0 : draft.priceCop,
          coverMediaId: draft.coverMediaId || null,
        }),
      });
      const product: unknown = await response.json().catch(() => null);
      if (!response.ok || !product || typeof product !== "object" || !("id" in product) || typeof product.id !== "string") {
        const error = product && typeof product === "object" && "error" in product ? product.error : null;
        setMsg(response.status === 403
          ? "Esta acción requiere una cuenta administradora. Cierra sesión e inicia sesión con la cuenta de administrador."
          : getErrorMessage(error));
        return;
      }
      if (imageFile) {
        const form = new FormData();
        form.set("image", imageFile);
        const upload = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}/image`, { method: "POST", body: form });
        const result = await upload.json().catch(() => ({}));
        if (!upload.ok) {
          setMsg(`Producto creado, pero no se pudo guardar la imagen. ${getErrorMessage(result.error)}`);
          await load();
          return;
        }
      }
      setDraft(blank);
      setImageFile(null);
      setMsg("Producto creado.");
      await load();
    } catch (error) {
      console.error("No se pudo crear el producto", error);
      setMsg("No se pudo crear el producto. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };
  const savePrice = async (id: string) => {
    if (await send(`/api/admin/products/${id}`, "PATCH", { priceCop: editPrice }, "Precio actualizado")) setEditId(null);
  };
  const beginEdit = (product: Product) => {
    const fields: ProductFields = {
      name: product.name, slug: product.slug, vendor: product.vendor, version: product.version,
      description: product.description, category: product.category, searchTerms: product.searchTerms,
      youtubeUrl: product.youtubeUrl, officialUrl: product.officialUrl,
      priceCop: product.priceCop, deliveryType: product.deliveryType, creditAmount: product.creditAmount,
      rentalOptions: product.rentalOptions.map(({ quantity, unit, priceCop, active }) => ({ quantity, unit, priceCop, active })),
      deliveryDetails: product.deliveryDetails, active: product.active, coverMediaId: product.coverMediaId,
    };
    setEditingProduct({ id: product.id, fields, galleryMediaIds: product.gallery.map((item) => item.mediaId) });
  };
  const updateEditFields = (fields: Partial<ProductFields>) => {
    if (editingProduct) setEditingProduct({ ...editingProduct, fields: { ...editingProduct.fields, ...fields } });
  };
  const updateDraftRentalOptions = (rentalOptions: RentalPlan[]) => setDraft({ ...draft, rentalOptions });
  const updateEditRentalOptions = (rentalOptions: RentalPlan[]) => updateEditFields({ rentalOptions });
  const saveProduct = async () => {
    if (!editingProduct) return;
    setSaving(true);
    const { id, fields, galleryMediaIds } = editingProduct;
    try {
      const saved = await send(`/api/admin/products/${id}`, "PATCH", {
        ...fields,
        creditAmount: fields.deliveryType === "CREDITS" ? fields.creditAmount : null,
        coverMediaId: fields.coverMediaId || null,
      }, "Ficha actualizada");
      if (!saved) return;
      const galleryResponse = await fetch(`/api/admin/products/${id}/gallery`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: galleryMediaIds }),
      });
      const result = await galleryResponse.json().catch(() => ({}));
      if (!galleryResponse.ok) {
        setMsg(getErrorMessage(result.error));
        return;
      }
      setEditingProduct(null);
      await load();
    } catch (error) {
      console.error("No se pudo guardar la ficha del producto", error);
      setMsg("No se pudo guardar la ficha. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };
  const uploadKeys = async () => {
    const keys = keysText.split("\n").map((k) => k.trim()).filter(Boolean);
    if (await send("/api/admin/licenses", "POST", { productId: keysFor, keys })) setKeysText("");
  };

  return (
    <section className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Productos e inventario</h1>
      <p role="status" className="min-h-5 text-sm text-teal-800">{msg}</p>

      <form className="grid gap-3 rounded border border-stone-200 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void createProduct(); }}>
        <h2 className="font-medium sm:col-span-2">Nuevo producto</h2>
        <p className="text-sm text-stone-600 sm:col-span-2">Solo el nombre y el precio base son necesarios. El enlace, la versión y la descripción son opcionales. La URL del producto se crea automáticamente desde el nombre.</p>
        <input className={input} placeholder="Nombre de la herramienta" value={draft.name} minLength={2} maxLength={120} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        {draft.deliveryType !== "RENTAL" && (
          <input className={input} type="number" min={1} max={50000000} step={1} placeholder={draft.deliveryType === "CREDITS" ? "Precio por 1 crédito (COP)" : "Precio (COP)"} value={draft.priceCop || ""} required onChange={(e) => setDraft({ ...draft, priceCop: Number(e.target.value) })} />
        )}
        <input className={input} placeholder="Categoría (opcional)" value={draft.category} maxLength={80} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
        <input className={input} placeholder="Marcas, bloqueos o términos de búsqueda" value={draft.searchTerms} maxLength={500} onChange={(e) => setDraft({ ...draft, searchTerms: e.target.value })} />
        <label className="space-y-1 text-sm">
          <span>Tipo de entrega</span>
          <select className={input} value={draft.deliveryType} onChange={(e) => setDraft({
            ...draft,
            deliveryType: e.target.value as typeof draft.deliveryType,
            creditAmount: e.target.value === "CREDITS" ? (draft.creditAmount ?? 1) : null,
          })}>
            <option value="LICENSE_KEY">Clave digital (inventario)</option>
            <option value="ACCOUNT_ACTIVATION">Activación de cuenta</option>
            <option value="CREDITS">Venta de créditos (precio por crédito)</option>
            <option value="RENTAL">Renta por horas o meses</option>
          </select>
        </label>
        {draft.deliveryType === "CREDITS" && <p className="self-center text-sm text-stone-600">El cliente seleccionará cuántos créditos necesita; el total será precio por crédito × cantidad.</p>}
        {draft.deliveryType === "RENTAL" && (
          <fieldset className="space-y-2 rounded border border-stone-300 p-3 sm:col-span-2">
            <legend className="px-1 text-sm font-medium">Opciones de renta y su precio total</legend>
            <p className="text-xs text-stone-600">Agrega las duraciones disponibles. Puedes configurar horas (por ejemplo, 6 y 8) y meses (por ejemplo, 1, 2, 3, 6 o 12); el cliente elegirá una.</p>
            {draft.rentalOptions.map((option, index) => (
              <div key={`draft-rental-${index}`} className="grid gap-2 sm:grid-cols-[5rem_8rem_1fr_auto]">
                <input aria-label="Duración de renta" className={input} type="number" min={1} max={120} value={option.quantity} onChange={(event) => updateDraftRentalOptions(draft.rentalOptions.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) || 1 } : item))} />
                <select aria-label="Unidad de renta" className={input} value={option.unit} onChange={(event) => updateDraftRentalOptions(draft.rentalOptions.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value as RentalPlan["unit"] } : item))}>
                  <option value="HOUR">Horas</option><option value="MONTH">Meses</option>
                </select>
                <input aria-label="Precio de esta duración" className={input} type="number" min={1000} max={50000000} placeholder="Precio total COP" value={option.priceCop || ""} required onChange={(event) => updateDraftRentalOptions(draft.rentalOptions.map((item, itemIndex) => itemIndex === index ? { ...item, priceCop: Number(event.target.value) || 0 } : item))} />
                <button type="button" className="text-sm text-red-700 underline" onClick={() => updateDraftRentalOptions(draft.rentalOptions.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="text-sm text-teal-900 underline" onClick={() => updateDraftRentalOptions([...draft.rentalOptions, { quantity: 1, unit: "MONTH", priceCop: 0, active: true }])}>Agregar duración de renta</button>
          </fieldset>
        )}
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Descripción detallada del programa (hasta 10.000 caracteres; se muestra en su ficha pública)</span>
          <textarea className={input} rows={6} placeholder="Funciones, requisitos, compatibilidad y condiciones de uso" value={draft.description} maxLength={10000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </label>
        <input className={`${input} sm:col-span-2`} type="url" placeholder="Video tutorial de YouTube (opcional)" value={draft.youtubeUrl} onChange={(e) => setDraft({ ...draft, youtubeUrl: e.target.value })} />
        <input className={`${input} sm:col-span-2`} type="url" placeholder="URL de la página oficial (opcional)" value={draft.officialUrl} onChange={(e) => setDraft({ ...draft, officialUrl: e.target.value })} />
        <textarea className={`${input} sm:col-span-2`} rows={2} placeholder="Detalles de entrega o pasos para el cliente (opcional)" value={draft.deliveryDetails} maxLength={2000} onChange={(e) => setDraft({ ...draft, deliveryDetails: e.target.value })} />
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Portada desde la biblioteca multimedia</span>
          <select className={input} value={draft.coverMediaId} onChange={(e) => setDraft({ ...draft, coverMediaId: e.target.value })}>
            <option value="">Sin portada seleccionada</option>
            {media.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Imagen del producto (JPG, PNG o WEBP; máximo 5 MB)</span>
          <input className={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
        </label>
        {imagePreview && <Image src={imagePreview} alt="Vista previa del producto" width={160} height={120} unoptimized className="h-28 w-40 rounded border object-cover sm:col-span-2" />}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
          Publicar ahora (requiere precio de al menos $1.000 COP)
        </label>
        <div className="sm:col-span-2"><button type="submit" className={btn} disabled={saving}>{saving ? "Creando producto…" : "Crear producto"}</button></div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 text-stone-600">
            <tr><th className="py-2">Producto</th><th>Tipo</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 align-middle">
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    {p.hasImage && <Image src={p.coverMedia?.externalUrl ?? `/api/products/${encodeURIComponent(p.slug)}/image`} alt={p.coverMedia?.altText || p.name} width={48} height={48} unoptimized className="h-12 w-12 rounded object-cover" />}
                    <div><div className="font-medium">{p.name}</div><div className="text-stone-500">{p.vendor} · {p.version}</div></div>
                  </div>
                </td>
                <td>{p.deliveryType === "LICENSE_KEY" ? "Clave digital" : p.deliveryType === "CREDITS" ? "Créditos" : p.deliveryType === "RENTAL" ? "Renta" : "Activación de cuenta"}</td>
                <td>
                  {p.deliveryType === "RENTAL" ? (
                    p.rentalOptions.length
                      ? `Desde ${cop.format(Math.min(...p.rentalOptions.map((option) => option.priceCop)))}`
                      : "Sin tarifas"
                  ) : editId === p.id ? (
                    <span className="flex gap-2">
                      <input className={`${input} w-32`} type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} />
                      <button type="button" className={btn} onClick={() => savePrice(p.id)}>Guardar</button>
                    </span>
                  ) : (
                    <button type="button" className={btnLink} onClick={() => { setEditId(p.id); setEditPrice(p.priceCop); }}>{cop.format(p.priceCop)}</button>
                  )}
                </td>
                <td className={p.deliveryType === "LICENSE_KEY" && p.stock === 0 ? "font-medium text-red-700" : ""}>{p.deliveryType === "LICENSE_KEY" ? p.stock : "Bajo pedido"}</td>
                <td>
                  <button type="button" className={p.active ? btn : btnSecondary} onClick={() => send(`/api/admin/products/${p.id}`, "PATCH", { active: !p.active })}>{p.active ? "Activo" : "Oculto"}</button>
                </td>
                <td className="space-x-3 text-right">
                  <button type="button" className={btnLink} onClick={() => beginEdit(p)}>Editar ficha</button>
                  {p.deliveryType === "LICENSE_KEY" && <button type="button" className={btnSecondary} onClick={() => setKeysFor(p.id)}>Cargar claves</button>}
                  <button type="button" className={btnDanger} onClick={() => confirm(`¿Eliminar ${p.name}?`) && send(`/api/admin/products/${p.id}`, "DELETE", undefined, "Eliminado")}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingProduct && (
        <form ref={editFormRef} className="scroll-mt-24 grid gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void saveProduct(); }}>
          <h2 className="font-medium sm:col-span-2">Editar ficha de producto</h2>
          <input ref={editNameRef} className={input} placeholder="Nombre" value={editingProduct.fields.name} required onChange={(event) => updateEditFields({ name: event.target.value })} />
          <input className={input} placeholder="Slug" pattern="[a-z0-9-]+" value={editingProduct.fields.slug} required onChange={(event) => updateEditFields({ slug: event.target.value })} />
          <input className={input} placeholder="Fabricante (opcional)" value={editingProduct.fields.vendor} onChange={(event) => updateEditFields({ vendor: event.target.value })} />
          <input className={input} placeholder="Versión (opcional)" value={editingProduct.fields.version} onChange={(event) => updateEditFields({ version: event.target.value })} />
          {editingProduct.fields.deliveryType !== "RENTAL" && (
            <input className={input} type="number" min={0} max={50000000} placeholder={editingProduct.fields.deliveryType === "CREDITS" ? "Precio por crédito" : "Precio"} value={editingProduct.fields.priceCop} onChange={(event) => updateEditFields({ priceCop: Number(event.target.value) })} />
          )}
          <input className={input} placeholder="Categoría (opcional)" value={editingProduct.fields.category} onChange={(event) => updateEditFields({ category: event.target.value })} />
          <input className={input} placeholder="Palabras clave: Samsung, FRP, KG…" value={editingProduct.fields.searchTerms} onChange={(event) => updateEditFields({ searchTerms: event.target.value })} />
          <select className={input} value={editingProduct.fields.deliveryType} onChange={(event) => {
            const deliveryType = event.target.value as ProductFields["deliveryType"];
            updateEditFields({ deliveryType, creditAmount: deliveryType === "CREDITS" ? editingProduct.fields.creditAmount ?? 1 : null });
          }}>
            <option value="LICENSE_KEY">Clave digital (inventario)</option>
            <option value="ACCOUNT_ACTIVATION">Activación de cuenta</option>
            <option value="CREDITS">Venta de créditos (precio por crédito)</option>
            <option value="RENTAL">Renta por horas o meses</option>
          </select>
          {editingProduct.fields.deliveryType === "CREDITS" && <p className="text-sm text-stone-600">El precio indicado es por un crédito. El comprador elegirá la cantidad y el sistema calculará el total.</p>}
          {editingProduct.fields.deliveryType === "RENTAL" && (
            <fieldset className="space-y-2 rounded border border-stone-300 p-3 sm:col-span-2">
              <legend className="px-1 text-sm font-medium">Duraciones de renta y sus precios</legend>
              {editingProduct.fields.rentalOptions.map((option, index) => (
                <div key={`edit-rental-${index}`} className="grid gap-2 sm:grid-cols-[5rem_8rem_1fr_auto]">
                  <input aria-label="Duración de renta" className={input} type="number" min={1} max={120} value={option.quantity} onChange={(event) => updateEditRentalOptions(editingProduct.fields.rentalOptions.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) || 1 } : item))} />
                  <select aria-label="Unidad de renta" className={input} value={option.unit} onChange={(event) => updateEditRentalOptions(editingProduct.fields.rentalOptions.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value as RentalPlan["unit"] } : item))}>
                    <option value="HOUR">Horas</option><option value="MONTH">Meses</option>
                  </select>
                  <input aria-label="Precio de esta duración" className={input} type="number" min={1000} max={50000000} placeholder="Precio total COP" value={option.priceCop} required onChange={(event) => updateEditRentalOptions(editingProduct.fields.rentalOptions.map((item, itemIndex) => itemIndex === index ? { ...item, priceCop: Number(event.target.value) || 0 } : item))} />
                  <button type="button" className={btnDanger} onClick={() => updateEditRentalOptions(editingProduct.fields.rentalOptions.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>
                </div>
              ))}
              <button type="button" className={btnSecondary} onClick={() => updateEditRentalOptions([...editingProduct.fields.rentalOptions, { quantity: 1, unit: "MONTH", priceCop: 1000, active: true }])}>Agregar duración de renta</button>
            </fieldset>
          )}
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>Descripción detallada del programa (hasta 10.000 caracteres)</span>
            <textarea className={input} rows={6} maxLength={10000} placeholder="Funciones, requisitos, compatibilidad y condiciones de uso" value={editingProduct.fields.description} onChange={(event) => updateEditFields({ description: event.target.value })} />
          </label>
          <input className={`${input} sm:col-span-2`} type="url" placeholder="Video tutorial de YouTube" value={editingProduct.fields.youtubeUrl ?? ""} onChange={(event) => updateEditFields({ youtubeUrl: event.target.value || null })} />
          <input className={`${input} sm:col-span-2`} type="url" placeholder="URL de la página oficial (opcional)" value={editingProduct.fields.officialUrl ?? ""} onChange={(event) => updateEditFields({ officialUrl: event.target.value || null })} />
          <textarea className={`${input} sm:col-span-2`} rows={2} placeholder="Detalles de entrega" value={editingProduct.fields.deliveryDetails ?? ""} onChange={(event) => updateEditFields({ deliveryDetails: event.target.value })} />
          <label className="space-y-1 text-sm">
            <span>Imagen de portada</span>
            <select className={input} value={editingProduct.fields.coverMediaId ?? ""} onChange={(event) => updateEditFields({ coverMediaId: event.target.value || null })}>
              <option value="">Sin imagen de biblioteca</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingProduct.fields.active} onChange={(event) => updateEditFields({ active: event.target.checked })} /> Publicado</label>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Galería de imágenes</legend>
            <div className="grid gap-2 sm:grid-cols-2">{media.map((asset) => (
              <label key={asset.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editingProduct.galleryMediaIds.includes(asset.id)} onChange={(event) => setEditingProduct({
                  ...editingProduct,
                  galleryMediaIds: event.target.checked
                    ? [...editingProduct.galleryMediaIds, asset.id]
                    : editingProduct.galleryMediaIds.filter((id) => id !== asset.id),
                })} />
                {asset.name}
              </label>
            ))}</div>
          </fieldset>
          <div className="flex gap-3 sm:col-span-2">
            <button className={btn} disabled={saving}>{saving ? "Guardando…" : "Guardar ficha"}</button>
            <button type="button" className={btnSecondary} disabled={saving} onClick={() => setEditingProduct(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {keysFor && (
        <div className="space-y-3 rounded border border-stone-200 p-4">
          <h2 className="font-medium">Cargar claves para {items.find((p) => p.id === keysFor)?.name}</h2>
          <textarea className={`${input} font-mono`} rows={8} placeholder="Una clave por línea" value={keysText} onChange={(e) => setKeysText(e.target.value)} />
          <div className="flex gap-3">
            <button type="button" className={btn} disabled={!keysText.trim()} onClick={uploadKeys}>Subir lote</button>
            <button type="button" className={btnSecondary} onClick={() => setKeysFor("")}>Cerrar</button>
          </div>
        </div>
      )}
    </section>
  );
}
