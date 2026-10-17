import { createHash, randomBytes, timingSafeEqual } from "crypto";

function clean(value: string | undefined) {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

function validOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

// APP_URL si es válida; si falta (p. ej. en Vercel) se usa el origen de la petición o las URLs del sistema de Vercel.
export function appOrigin(requestOrigin?: string): string {
  const candidates = [
    clean(process.env.APP_URL),
    requestOrigin ?? "",
    clean(process.env.VERCEL_PROJECT_PRODUCTION_URL) && `https://${clean(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`,
    clean(process.env.VERCEL_URL) && `https://${clean(process.env.VERCEL_URL)}`,
  ];
  for (const candidate of candidates) {
    const origin = candidate ? validOrigin(candidate) : null;
    if (origin) return origin;
  }
  throw new Error("APP_URL inválida: incluye el protocolo, por ejemplo https://tu-dominio.vercel.app");
}

export function createOrderAccess(reference: string, requestOrigin?: string) {
  const accessToken = randomBytes(32).toString("hex");
  const accessTokenHash = createHash("sha256").update(accessToken).digest("hex");
  const trackingUrl = new URL(`/pedido/${encodeURIComponent(reference)}`, appOrigin(requestOrigin));
  trackingUrl.searchParams.set("token", accessToken);
  return { accessTokenHash, trackingUrl: trackingUrl.toString() };
}

export function isOrderAccessValid(accessToken: string, accessTokenHash: string | null) {
  if (!accessTokenHash || !/^[a-f0-9]{64}$/i.test(accessToken)) return false;
  const expected = Buffer.from(accessTokenHash, "hex");
  const actual = createHash("sha256").update(accessToken).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
