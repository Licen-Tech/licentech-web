import { createHash, timingSafeEqual } from "crypto";

const SANDBOX_API = "https://sandbox.wompi.co/v1";
const PRODUCTION_API = "https://production.wompi.co/v1";
const PLACEHOLDER = /(?:xxx|replace[-_ ]?me|your[-_ ]?(?:key|secret))/i;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// Limpia espacios, saltos de línea y comillas que suelen colarse al pegar secretos en .env / Codespaces / Vercel.
function env(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

type WompiMode = "test" | "prod";

function modeFromPublicKey(publicKey: string): WompiMode | null {
  if (publicKey.startsWith("pub_test_")) return "test";
  if (publicKey.startsWith("pub_prod_")) return "prod";
  return null;
}

// Si WOMPI_API_URL falta o no coincide con el entorno de las llaves, se usa la URL oficial correcta.
function apiBase(): string {
  const mode = modeFromPublicKey(env("WOMPI_PUBLIC_KEY")) ?? (env("WOMPI_PRIVATE_KEY").startsWith("prv_prod_") ? "prod" : "test");
  const expected = mode === "prod" ? PRODUCTION_API : SANDBOX_API;
  const configured = env("WOMPI_API_URL").replace(/\/+$/, "");
  if (configured && configured !== expected) {
    console.warn(`WOMPI_API_URL (${configured}) no coincide con las llaves ${mode}; se usa ${expected}`);
  }
  return expected;
}

async function wompi<T>(path: string, init?: RequestInit): Promise<T> {
  const privateKey = env("WOMPI_PRIVATE_KEY");
  if (!privateKey || PLACEHOLDER.test(privateKey)) {
    throw new Error("Falta configurar WOMPI_PRIVATE_KEY");
  }
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${privateKey}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Wompi ${res.status}: ${JSON.stringify(json?.error ?? json)}`);
  return json.data as T;
}

export const getTransaction = (id: string) =>
  wompi<{
    id: string; status: string; reference: string; amount_in_cents: number; currency: string;
    payment_method_type: string; payment_method?: { extra?: { async_payment_url?: string } };
  }>(`/transactions/${encodeURIComponent(id)}`);

export function createWebCheckoutUrl(reference: string, amountCop: number, customerEmail: string, redirectUrl: string) {
  const publicKey = env("WOMPI_PUBLIC_KEY");
  const privateKey = env("WOMPI_PRIVATE_KEY");
  const integritySecret = env("WOMPI_INTEGRITY_SECRET");
  const eventsSecret = env("WOMPI_EVENTS_SECRET");
  const appUrl = env("APP_URL");
  if (!publicKey || !privateKey || !integritySecret || !eventsSecret || !appUrl) {
    throw new Error("Las llaves y secretos de Wompi están incompletos");
  }
  const mode = modeFromPublicKey(publicKey);
  const hasExampleCredentials = [publicKey, privateKey, integritySecret, eventsSecret]
    .some((value) => PLACEHOLDER.test(value));
  const credentialsMatch = mode !== null
    && privateKey.startsWith(mode === "test" ? "prv_test_" : "prv_prod_")
    && integritySecret.startsWith(mode === "test" ? "test_integrity_" : "prod_integrity_")
    && eventsSecret.startsWith(mode === "test" ? "test_events_" : "prod_events_");
  if (hasExampleCredentials || !credentialsMatch) {
    throw new Error("Las llaves y secretos de Wompi deben estar completos y pertenecer al mismo entorno");
  }
  const amountInCents = Math.round(amountCop * 100);
  const signature = sha(`${reference}${amountInCents}COP${integritySecret}`);
  const checkoutUrl = new URL("https://checkout.wompi.co/p/");
  checkoutUrl.searchParams.set("public-key", publicKey);
  checkoutUrl.searchParams.set("currency", "COP");
  checkoutUrl.searchParams.set("amount-in-cents", String(amountInCents));
  checkoutUrl.searchParams.set("reference", reference);
  checkoutUrl.searchParams.set("signature:integrity", signature);
  checkoutUrl.searchParams.set("redirect-url", redirectUrl);
  checkoutUrl.searchParams.set("customer-data:email", customerEmail);
  return checkoutUrl.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPathValue(value: unknown, path: string): unknown {
  let current = value;
  for (const key of path.split(".")) {
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      current = current[Number(key)];
    } else if (isRecord(current)) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

// Valida el checksum del evento: SHA256(valores de signature.properties + timestamp + secreto de eventos)
export function verifyEvent(event: unknown): boolean {
  if (!isRecord(event) || !isRecord(event.signature)) return false;
  const props = event.signature.properties;
  const checksum = event.signature.checksum;
  const timestamp = event.timestamp;
  const eventsSecret = env("WOMPI_EVENTS_SECRET");
  if (!eventsSecret || !Array.isArray(props) || !props.every((path): path is string => typeof path === "string")
    || typeof checksum !== "string" || (typeof timestamp !== "string" && typeof timestamp !== "number")) {
    return false;
  }
  const values = props.map((path) => getPathValue(event.data, path));
  const expected = Buffer.from(sha(values.join("") + timestamp + eventsSecret));
  const received = Buffer.from(checksum.toLowerCase());
  return expected.length === received.length && timingSafeEqual(expected, received);
}
