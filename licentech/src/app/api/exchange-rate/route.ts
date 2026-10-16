import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`El proveedor de tasa respondió con HTTP ${response.status}.`);

    const result: unknown = await response.json();
    if (!result || typeof result !== "object"
      || !("result" in result) || result.result !== "success"
      || !("rates" in result) || !result.rates || typeof result.rates !== "object"
      || !("COP" in result.rates) || typeof result.rates.COP !== "number"
      || !Number.isFinite(result.rates.COP) || result.rates.COP <= 0
      || !("time_last_update_utc" in result) || typeof result.time_last_update_utc !== "string") {
      throw new Error("El proveedor devolvió una tasa USD/COP inválida.");
    }
    return NextResponse.json({
      copPerUsd: result.rates.COP,
      updatedAt: result.time_last_update_utc,
      source: "ExchangeRate-API",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("No se pudo consultar la tasa USD/COP", error);
    return NextResponse.json({ error: "No se pudo consultar la tasa USD/COP en este momento." }, { status: 502 });
  }
}
