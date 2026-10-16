import { createHash, timingSafeEqual } from "crypto";

const API = process.env.WOMPI_API_URL!;
const PRIV = process.env.WOMPI_PRIVATE_KEY!;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function wompi<T>(path: string, init?: RequestInit): Promise<T> {
  if (!PRIV || /(?:xxx|replace[-_ ]?me|your[-_ ]?(?:key|secret))/i.test(PRIV)) {
    throw new Error("Falta configurar WOMPI_PRIVATE_KEY");
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${PRIV}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Wompi ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  return json.data as T;
}

export const getTransaction = (id: string) =>
  wompi<{
    id: string; status: string; reference: string; amount_in_cents: number; currency: string;
    payment_method_type: string; payment_method?: { extra?: { async_payment_url?: string } };
  }>(`/transactions/${id}`);

export function createWebCheckoutUrl(reference: string, amountCop: number, customerEmail: string, redirectUrl: string) {
  const publicKey = process.env.WOMPI_PUBLIC_KEY;
  const privateKey = process.env.WOMPI_PRIVATE_KEY;
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
  const appUrl = process.env.APP_URL;
  if (!publicKey || !privateKey || !integritySecret || !eventsSecret || !appUrl) {
    throw new Error("Las llaves y secretos de Wompi están incompletos");
  }
  const mode = publicKey.startsWith("pub_test_") ? "test" : publicKey.startsWith("pub_prod_") ? "prod" : null;
  const expectedApi = mode === "test"
    ? "https://sandbox.wompi.co/v1"
    : mode === "prod"
      ? "https://production.wompi.co/v1"
      : null;
  const hasExampleCredentials = [publicKey, privateKey, integritySecret, eventsSecret]
    .some((value) => !value || /(?:xxx|replace[-_ ]?me|your[-_ ]?(?:key|secret))/i.test(value));
  const credentialsMatch = mode !== null
    && privateKey?.startsWith(mode === "test" ? "prv_test_" : "prv_prod_")
    && integritySecret?.startsWith(mode === "test" ? "test_integrity_" : "prod_integrity_")
    && eventsSecret?.startsWith(mode === "test" ? "test_events_" : "prod_events_");
  const apiMatchesEnvironment = expectedApi !== null && API.replace(/\/+$/, "") === expectedApi;
  if (hasExampleCredentials || !credentialsMatch || !apiMatchesEnvironment) {
    throw new Error("Las llaves y secretos de Wompi deben estar completos y pertenecer al mismo entorno");
  }
  const amountInCents = amountCop * 100;
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
  if (!Array.isArray(props) || !props.every((path): path is string => typeof path === "string")
    || typeof checksum !== "string" || (typeof timestamp !== "string" && typeof timestamp !== "number")) {
    return false;
  }
  const values = props.map((path) => getPathValue(event.data, path));
  const expected = Buffer.from(sha(values.join("") + timestamp + process.env.WOMPI_EVENTS_SECRET));
  const received = Buffer.from(checksum.toLowerCase());
  return expected.length === received.length && timingSafeEqual(expected, received);
}
