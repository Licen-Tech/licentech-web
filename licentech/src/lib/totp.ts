import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const totpPeriodSeconds = 30;

function encryptionKey() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET no está configurado.");
  return createHmac("sha256", jwtSecret).update("licentech-account-totp-v1").digest();
}

function encodeBase32(bytes: Buffer) {
  let bits = "";
  for (let index = 0; index < bytes.length; index++) {
    bits += bytes[index].toString(2).padStart(8, "0");
  }
  let output = "";
  for (let offset = 0; offset < bits.length; offset += 5) {
    output += base32Alphabet[Number.parseInt(bits.slice(offset, offset + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/, "");
  if (!normalized || normalized.split("").some((character) => !base32Alphabet.includes(character))) {
    throw new Error("Secreto TOTP inválido.");
  }
  const bits = normalized.split("").map((character) => base32Alphabet.indexOf(character).toString(2).padStart(5, "0")).join("");
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

export function createTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptTotpSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !encrypted) throw new Error("Secreto TOTP almacenado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function codeForStep(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 1_000_000).toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const currentStep = Math.floor(now / 1000 / totpPeriodSeconds);
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    const expected = Buffer.from(codeForStep(secret, step));
    const received = Buffer.from(code);
    if (timingSafeEqual(expected, received)) return step;
  }
  return null;
}

export function totpSetupUri(secret: string, email: string) {
  const label = encodeURIComponent(`LicenTech Colombia:${email}`);
  const query = new URLSearchParams({ secret, issuer: "LicenTech Colombia", algorithm: "SHA1", digits: "6", period: String(totpPeriodSeconds) });
  return `otpauth://totp/${label}?${query.toString()}`;
}
