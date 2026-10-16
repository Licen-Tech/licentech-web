import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const key = () => Buffer.from(process.env.LICENSE_ENC_KEY!, "base64"); // 32 bytes

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string) {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export const hmac = (s: string) => createHmac("sha256", process.env.APP_PEPPER!).update(s).digest("hex");
