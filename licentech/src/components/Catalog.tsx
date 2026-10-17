"use client";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { cop } from "@/lib/format";

type CatalogProduct = {
  slug: string;
  name: string;
  vendor: string;
  version: string;
  description: string;
  category: string;
  searchTerms: string;
  priceCop: number;
  stock: number;
  deliveryType: "LICENSE_KEY" | "ACCOUNT_ACTIVATION" | "CREDITS" | "RENTAL";
  creditAmount: number | null;
  hasImage: boolean;
  coverMedia: { altText: string; externalUrl: string | null } | null;
};

export default function Catalog({ products }: { products: CatalogProduct[] }) {
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState("");
  const vendors = useMemo(
    () => Array.from(new Set(products.map((product) => product.vendor).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-CO")),
    [products],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es-CO");
    return products.filter((product) =>
      (!vendor || product.vendor === vendor)
      && (!needle || [product.name, product.vendor, product.version, product.category, product.searchTerms, product.description]
        .some((value) => value.toLocaleLowerCase("es-CO").includes(needle))),
    );
  }, [products, query, vendor]);

  return (
    <section id="productos" className="mt-10 scroll-mt-28">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold">Catálogo de software</h2>
          <p className="mt-1 text-sm text-stone-600">Busca una herramienta, marca o versión.</p>
        </div>
        <label className="w-full sm:max-w-sm">
          <span className="sr-only">Buscar software</span>
          <input
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
            type="search"
            placeholder="Buscar software..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {vendors.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtrar por fabricante">
          <button
            type="button"
            aria-pressed={!vendor}
            className={`rounded-full border px-3 py-1.5 text-xs ${!vendor ? "border-teal-800 bg-teal-800 text-white" : "border-stone-300 bg-white text-stone-700"}`}
            onClick={() => setVendor("")}
          >
            Todos
          </button>
          {vendors.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={vendor === name}
              className={`rounded-full border px-3 py-1.5 text-xs ${vendor === name ? "border-teal-800 bg-teal-800 text-white" : "border-stone-300 bg-white text-stone-700"}`}
              onClick={() => setVendor(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="mt-6 rounded border border-dashed border-stone-300 p-6 text-stone-500">
          {products.length === 0 ? "Aún no hay productos publicados." : "No encontramos servicios con esa búsqueda."}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {filtered.map((product) => (
            <Link key={product.slug} href={`/productos/${product.slug}`} className="rounded-lg border border-stone-200 bg-white p-4 hover:border-teal-700">
              {product.hasImage && (
                <Image
                  src={product.coverMedia?.externalUrl ?? `/api/products/${encodeURIComponent(product.slug)}/image`}
                  alt={product.coverMedia?.altText || product.name}
                  width={640}
                  height={360}
                  unoptimized
                  className="mb-3 h-40 w-full rounded object-cover"
                />
              )}
              <div className="text-xs text-stone-500">{product.category} · {product.vendor} · {product.version}</div>
              <div className="mt-1 font-medium">{product.name}</div>
              {product.description && <p className="mt-2 line-clamp-3 text-sm text-stone-600">{product.description}</p>}
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <span className="text-lg font-semibold">
                  {product.deliveryType === "RENTAL" ? "Desde " : ""}
                  {cop.format(product.priceCop)}
                  {product.deliveryType === "CREDITS" ? " / crédito" : ""}
                </span>
                <span className={product.deliveryType !== "LICENSE_KEY" || product.stock > 0 ? "text-xs text-teal-800" : "text-xs text-red-700"}>
                  {product.deliveryType === "LICENSE_KEY"
                    ? product.stock > 0 ? `${product.stock} disponibles` : "Agotado"
                    : product.deliveryType === "CREDITS" ? "Precio por crédito · bajo pedido" : product.deliveryType === "RENTAL" ? "Renta · elige duración" : "Activación bajo pedido"}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">Precio base; el total incluye cargos al pagar.</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
