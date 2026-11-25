import "server-only";
import { db } from "./db";
import type { Schedule } from "./time";

export interface Settings {
  adminPinHash: string | null; // null → fall back to ADMIN_PIN env (first setup)
  staffPinHash: string | null; // null → fall back to STAFF_PIN env
  staffPinDaily: boolean; // true → staff PIN changes every day (derived, shown to admin)
  askDeviceName: boolean; // ask for a nickname on unlock (device info is logged either way)
  schedule: Schedule;
}

export const DEFAULT_SETTINGS: Settings = {
  adminPinHash: null,
  staffPinHash: null,
  staffPinDaily: false,
  askDeviceName: true,
  schedule: {
    enabled: false,
    days: ["2026-12-02", "2026-12-03", "2026-12-04", "2026-12-08", "2026-12-09"],
    start: "16:00",
    end: "20:00",
  },
};

// Settings are read on almost every request but change rarely → cache per server instance.
// fresh=true bypasses the cache (unlock + admin settings page, where staleness matters).
const TTL_MS = 15_000;
let cache: { at: number; value: Settings } | null = null;

export async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const { data, error } = await db().from("settings").select("value").eq("key", "app").maybeSingle();
  if (error) throw error;
  const value = { ...DEFAULT_SETTINGS, ...(data?.value ?? {}) };
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
