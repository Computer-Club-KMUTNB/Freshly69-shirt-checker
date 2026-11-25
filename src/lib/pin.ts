import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
