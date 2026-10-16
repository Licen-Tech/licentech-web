"use client";

import { useEffect, useState } from "react";
import { cop } from "@/lib/format";

type Rate = {
  copPerUsd: number;
  updatedAt: string;
  source: string;
};

type ExchangeRateProps = { amountCop: number };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

export default function ExchangeRate({ amountCop }: ExchangeRateProps) {
  const [rate, setRate] = useState<Rate | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/exchange-rate", { cache: "no-store" })
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "No se pudo consultar la tasa USD/COP.";
          throw new Error(message);
        }
        if (!data || typeof data !== "object"
          || !("copPerUsd" in data) || typeof data.copPerUsd !== "number" || data.copPerUsd <= 0
          || !("updatedAt" in data) || typeof data.updatedAt !== "string"
          || !("source" in data) || typeof data.source !== "string") {
          throw new Error("El proveedor devolvió una tasa USD/COP inválida.");
        }
        if (active) setRate(data as Rate);
      })
      .catch((rateError: unknown) => {
        console.error("No se pudo actualizar la referencia USD/COP", rateError);
        if (active) setError(rateError instanceof Error ? rateError.message : "No se pudo consultar la tasa USD/COP.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section aria-live="polite" className="rounded border border-stone-200 bg-stone-50 p-3 text-sm">
      <p className="font-medium">Referencia de conversión USD ↔ COP</p>
      {loading && <p className="mt-1 text-stone-600">Consultando la tasa actual…</p>}
      {rate && (
        <div className="mt-1 space-y-1 text-stone-700">
          <p>1 USD ≈ {cop.format(rate.copPerUsd)} COP.</p>
          <p>{cop.format(amountCop)} COP ≈ {usd.format(amountCop / rate.copPerUsd)}.</p>
          <p className="text-xs text-stone-500">Tasa de referencia de {rate.source}; actualizada {dateTime.format(new Date(rate.updatedAt))}. El total cobrado se mantiene en COP.</p>
        </div>
      )}
      {error && <p role="status" className="mt-1 text-xs text-amber-800">{error} El total a pagar se mantiene en COP.</p>}
    </section>
  );
}
