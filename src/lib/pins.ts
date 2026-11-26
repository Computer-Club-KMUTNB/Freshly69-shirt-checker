// Several PINs per role, each can be switched off or deleted; a session only stays valid while the
// PIN it was opened with is still on. Pure (only node:crypto) → unit-tested in pins.test.ts.
import { randomUUID } from "node:crypto";
import { constantTimeEqual, dailyPin, decryptPin, encryptPin, hashPin, isSixDigits, verifyPin } from "./pin";

export type Role = "admin" | "staff";

export interface PinEntry {
  id: string;
  /** Who uses it, e.g. "บอส" or "ทีม A" — shown in the header and written to every log line. */
  label: string;
  hash: string; // scrypt "salt:hash" — what unlock checks
  /** AES-GCM encrypted PIN so an admin can reveal it (missing on PINs created before this feature). */
  enc?: string;
  createdAt: string;
  enabled?: boolean; // undefined = on
}

/** The ADMIN_PIN / STAFF_PIN from Vercel env can't be deleted from Vercel by the app, only switched off. */
export type EnvPinState = "on" | "off" | "removed";

export interface PinSettings {
  adminPins: PinEntry[];
  staffPins: PinEntry[];
  staffPinDaily: boolean;
  envPins?: { admin?: EnvPinState; staff?: EnvPinState };
}

export interface PinEnv {
  adminPin?: string;
  staffPin?: string;
  secret: string;
  today: string; // YYYY-MM-DD (Bangkok)
}

export interface PinMatch {
  role: Role;
  label: string | null;
  /** Stored in the session; checked on every request so a removed / switched-off PIN logs people out. */
  pinId: string;
}

/** Each check costs one scrypt (~30–50 ms), so keep the lists short. */
export const MAX_PINS_PER_ROLE = 10;

export const ENV_ID = { admin: "env:admin", staff: "env:staff" } as const;
export const ENV_LABEL = { admin: "รหัสตั้งต้น (ADMIN_PIN ใน Vercel)", staff: "รหัสตั้งต้น (STAFF_PIN ใน Vercel)" } as const;

const on = (p: PinEntry) => p.enabled !== false;
const envState = (s: PinSettings, role: Role): EnvPinState => s.envPins?.[role] ?? "on";
const envValue = (env: PinEnv, role: Role) => (role === "admin" ? env.adminPin : env.staffPin);
const envUsable = (s: PinSettings, env: PinEnv, role: Role) => {
  const v = envValue(env, role);
  return !!v && isSixDigits(v) && envState(s, role) === "on";
};
const list = (s: PinSettings, role: Role) => (role === "admin" ? s.adminPins : s.staffPins);

/** Which role (and which PIN) does this PIN unlock? Admin PINs are checked first. */
export function matchPin(pin: string, s: PinSettings, env: PinEnv): PinMatch | null {
  if (!isSixDigits(pin)) return null;
  for (const p of s.adminPins) if (on(p) && verifyPin(pin, p.hash)) return { role: "admin", label: p.label, pinId: p.id };
  if (envUsable(s, env, "admin") && constantTimeEqual(pin, env.adminPin!)) return { role: "admin", label: null, pinId: ENV_ID.admin };
  if (s.staffPinDaily) {
    return constantTimeEqual(pin, dailyPin(env.secret, env.today)) ? { role: "staff", label: null, pinId: `daily:${env.today}` } : null;
  }
  for (const p of s.staffPins) if (on(p) && verifyPin(pin, p.hash)) return { role: "staff", label: p.label, pinId: p.id };
  if (envUsable(s, env, "staff") && constantTimeEqual(pin, env.staffPin!)) return { role: "staff", label: null, pinId: ENV_ID.staff };
  return null;
}

/** Is the PIN a session was opened with still allowed? (false → the user is logged out) */
export function pinStillValid(role: Role, pinId: string | undefined, s: PinSettings, env: PinEnv): boolean {
  if (!pinId) return false; // sessions from before per-PIN tracking
  if (pinId.startsWith("daily:")) return role === "staff" && s.staffPinDaily && pinId === `daily:${env.today}`;
  if (pinId === ENV_ID.admin) return role === "admin" && envUsable(s, env, "admin");
  if (pinId === ENV_ID.staff) return role === "staff" && !s.staffPinDaily && envUsable(s, env, "staff");
  if (role === "staff" && s.staffPinDaily) return false;
  return list(s, role).some((p) => p.id === pinId && on(p));
}

/** Validate + create a list entry. Throws a Thai message (shown to the admin). */
export function newPin(role: Role, pin: string, label: string, s: PinSettings, env: PinEnv): PinEntry {
  if (!isSixDigits(pin)) throw new Error("รหัสต้องเป็นตัวเลข 6 หลัก");
  const name = label.trim().slice(0, 30);
  if (!name) throw new Error("ใส่ชื่อว่ารหัสนี้ของใคร / ใช้ที่ไหน");
  if (list(s, role).length >= MAX_PINS_PER_ROLE) throw new Error(`เพิ่มได้สูงสุด ${MAX_PINS_PER_ROLE} รหัสต่อประเภท`);
  if ([...s.adminPins, ...s.staffPins].some((p) => verifyPin(pin, p.hash))) throw new Error("รหัสนี้มีอยู่แล้ว ใช้รหัสอื่น");
  for (const r of ["admin", "staff"] as const) {
    if (envState(s, r) !== "removed" && envValue(env, r) === pin) throw new Error("รหัสนี้ซ้ำกับรหัสตั้งต้นใน Vercel ใช้รหัสอื่น");
  }
  if (constantTimeEqual(pin, dailyPin(env.secret, env.today))) throw new Error("รหัสนี้ตรงกับรหัสสตาฟรายวัน ใช้รหัสอื่น");
  return { id: randomUUID(), label: name, hash: hashPin(pin), enc: encryptPin(pin, env.secret), createdAt: new Date().toISOString(), enabled: true };
}

/** How many admin PINs can still unlock — never let this reach 0 (the admin would be locked out). */
export function usableAdminPins(s: PinSettings, env: PinEnv): number {
  return s.adminPins.filter(on).length + (envUsable(s, env, "admin") ? 1 : 0);
}

export interface PublicPin {
  id: string;
  label: string;
  createdAt: string | null;
  enabled: boolean;
  env: boolean;
  /** false for old PINs saved only as a hash */
  revealable: boolean;
}

/** What the settings page shows. Never includes hashes. The env PIN appears first unless removed. */
export function publicPins(role: Role, s: PinSettings, env: PinEnv): PublicPin[] {
  const out: PublicPin[] = [];
  const v = envValue(env, role);
  if (v && isSixDigits(v) && envState(s, role) !== "removed") {
    out.push({ id: ENV_ID[role], label: ENV_LABEL[role], createdAt: null, enabled: envState(s, role) === "on", env: true, revealable: true });
  }
  for (const p of list(s, role)) out.push({ id: p.id, label: p.label, createdAt: p.createdAt, enabled: on(p), env: false, revealable: !!p.enc });
  return out;
}

/** The PIN itself, for the admin's "show" button. null = not stored in a recoverable form. */
export function revealPin(role: Role, id: string, s: PinSettings, env: PinEnv): string | null {
  if (id === ENV_ID[role]) {
    const v = envValue(env, role);
    return v && isSixDigits(v) && envState(s, role) !== "removed" ? v : null;
  }
  const p = list(s, role).find((x) => x.id === id);
  return p?.enc ? decryptPin(p.enc, env.secret) : null;
}
