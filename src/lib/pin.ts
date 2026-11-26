import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function isSixDigits(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/** "salt:hash" (hex). Only hashes are stored in the DB, never the PIN itself. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pin, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Daily staff PIN mode: PIN for a Bangkok date, derived from SESSION_SECRET (admin sees it in Settings). */
export function dailyPin(secret: string, date: string): string {
  const h = createHmac("sha256", secret).update(`staff-pin:${date}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * PINs are also stored AES-256-GCM encrypted (key derived from SESSION_SECRET) so an admin can
 * reveal them in Settings. The hash is still what unlock checks. Format: base64(iv | tag | data).
 */
const encKey = (secret: string) => createHash("sha256").update(`pin-enc:${secret}`).digest();

export function encryptPin(pin: string, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(secret), iv);
  const data = Buffer.concat([c.update(pin, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64");
}

export function decryptPin(enc: string, secret: string): string | null {
  try {
    const b = Buffer.from(enc, "base64");
    const d = createDecipheriv("aes-256-gcm", encKey(secret), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null; // wrong secret / tampered
  }
}
