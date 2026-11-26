import "server-only";
import { db } from "./db";
import type { EnvPinState, PinEntry } from "./pins";
import type { Schedule } from "./time";

export interface Settings {
  /** Several admin PINs (one per person / team), each can be switched off. */
  adminPins: PinEntry[];
  /** Several staff PINs, each can be switched off. Ignored while staffPinDaily is on. */
  staffPins: PinEntry[];
  /** ADMIN_PIN / STAFF_PIN from Vercel: on, off, or removed from the list. */
  envPins: { admin?: EnvPinState; staff?: EnvPinState };
  /** Custom names for the Vercel env PINs. */
  envLabels?: { admin?: string; staff?: string };
  staffPinDaily: boolean; // true → one staff PIN that changes every day (derived, shown to admin)
  schedule: Schedule;
}

export const DEFAULT_SETTINGS: Settings = {
  adminPins: [],
  staffPins: [],
  envPins: {},
  staffPinDaily: false,
  schedule: {
    enabled: false,
    days: ["2026-12-02", "2026-12-03", "2026-12-04", "2026-12-08", "2026-12-09"],
    start: "16:00",
    end: "20:00",
  },
};

/** Older versions stored one hash per role (adminPinHash / staffPinHash) → turn into list items. */
function migrate(raw: Record<string, unknown>): Settings {
  const s = { ...DEFAULT_SETTINGS, ...raw } as Settings & { adminPinHash?: string | null; staffPinHash?: string | null };
  const legacy = (hash: string | null | undefined): PinEntry[] =>
    hash ? [{ id: "legacy", label: "รหัสเดิม", hash, createdAt: new Date(0).toISOString() }] : [];
  if (!Array.isArray(s.adminPins) || (s.adminPins.length === 0 && s.adminPinHash)) s.adminPins = legacy(s.adminPinHash);
  if (!Array.isArray(s.staffPins) || (s.staffPins.length === 0 && s.staffPinHash)) s.staffPins = legacy(s.staffPinHash);
  delete s.adminPinHash;
  delete s.staffPinHash;
  return s;
}

// Settings are read on almost every request but change rarely → cache per server instance.
// fresh=true bypasses the cache (unlock + admin settings page, where staleness matters).
const TTL_MS = 15_000;
let cache: { at: number; value: Settings } | null = null;

export async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { data, error } = await db().from("settings").select("value").eq("key", "app").maybeSingle();
  if (error) throw error;
  const value = migrate((data?.value as Record<string, unknown>) ?? {});
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings(true)), ...patch };
  const { error } = await db().from("settings").upsert({ key: "app", value: next });
  if (error) throw error;
  cache = { at: Date.now(), value: next };
  return next;
}
