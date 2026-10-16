import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function createOrderAccess(reference: string) {
  const accessToken = randomBytes(32).toString("hex");
  const accessTokenHash = createHash("sha256").update(accessToken).digest("hex");
  const trackingUrl = new URL(`/pedido/${encodeURIComponent(reference)}`, process.env.APP_URL);
  trackingUrl.searchParams.set("token", accessToken);
  return { accessTokenHash, trackingUrl: trackingUrl.toString() };
}

export function isOrderAccessValid(accessToken: string, accessTokenHash: string | null) {
  if (!accessTokenHash || !/^[a-f0-9]{64}$/i.test(accessToken)) return false;
  const expected = Buffer.from(accessTokenHash, "hex");
  const actual = createHash("sha256").update(accessToken).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
