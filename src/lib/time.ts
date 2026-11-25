import { TIMEZONE } from "./constants";

/** YYYY-MM-DD in Bangkok time. */
export function bangkokDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** HH:MM (24h) in Bangkok time. */
export function bangkokTime(d = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Epoch seconds of the next midnight in Bangkok (UTC+7, no DST). Sessions expire then. */
export function nextBangkokMidnight(d = new Date()): number {
  const [y, m, day] = bangkokDate(d).split("-").map(Number);
  // midnight of the following Bangkok day = 17:00 UTC of the current Bangkok day
  return Math.floor(Date.UTC(y, m - 1, day, 17, 0, 0) / 1000);
}

export interface Schedule {
  enabled: boolean;
  days: string[]; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
}

export function isOpen(schedule: Schedule, d = new Date()): boolean {
  if (!schedule.enabled) return true;
  const t = bangkokTime(d);
  return schedule.days.includes(bangkokDate(d)) && t >= schedule.start && t < schedule.end;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}
