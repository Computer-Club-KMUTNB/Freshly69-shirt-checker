import { NextResponse } from "next/server";
import { dailyPin } from "@/lib/pin";
import { ENV_ID, newPin, publicPins, renamePin, usableAdminPins, type PinEnv, type Role } from "@/lib/pins";
import { HttpError, requireSession, route, writeLog } from "@/lib/session";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import { bangkokDate } from "@/lib/time";

const pinEnv = (): PinEnv => ({
  adminPin: process.env.ADMIN_PIN,
  staffPin: process.env.STAFF_PIN,
  secret: process.env.SESSION_SECRET!,
  today: bangkokDate(),
});

function publicView(s: Settings) {
  const env = pinEnv();
  const today = env.today;
  const tomorrow = bangkokDate(new Date(Date.now() + 86_400_000));
  return {
    adminPins: publicPins("admin", s, env), // labels + on/off only — hashes never leave the server
    staffPins: publicPins("staff", s, env),
    staffPinDaily: s.staffPinDaily,
    schedule: s.schedule,
    dailyPins: s.staffPinDaily ? { [today]: dailyPin(env.secret, today), [tomorrow]: dailyPin(env.secret, tomorrow) } : null,
  };
}

export const GET = route(async () => {
  await requireSession("admin");
  return NextResponse.json(publicView(await getSettings(true)));
});

const isRole = (r: unknown): r is Role => r === "admin" || r === "staff";

/**
 * POST any of:
 *   { addPin:    { role, pin, label } }      add a PIN
 *   { removePin: { role, id } }              delete a PIN (env PINs can't be deleted → 400)
 *   { togglePin: { role, id, enabled } }     switch a PIN on / off
 *   { renamePin: { role, id, label } }       rename a PIN (incl. the Vercel env PINs)
 *   { staffPinDaily, schedule }
 * Anyone logged in with a PIN that gets removed or switched off is logged out on their next request.
 * The last usable admin PIN can't be removed / switched off (the admin would be locked out).
 */
export const POST = route(async (req: Request) => {
  const s = await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  const cur = await getSettings(true);
  const env = pinEnv();
  let next: Settings = { ...cur, envPins: { ...cur.envPins } };
  const changed: string[] = [];
  const listKey = (role: Role): "adminPins" | "staffPins" => (role === "admin" ? "adminPins" : "staffPins");

  if (b.addPin) {
    const { role, pin, label } = b.addPin;
    if (!isRole(role)) throw new HttpError(400, "ประเภทรหัสไม่ถูกต้อง");
    let entry;
    try {
      entry = newPin(role, String(pin ?? ""), String(label ?? ""), next, env);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    next = { ...next, [listKey(role)]: [...next[listKey(role)], entry] };
    changed.push(`addPin:${role}:${entry.label}`);
  }

  if (b.renamePin) {
    const { role, id, label } = b.renamePin;
    if (!isRole(role)) throw new HttpError(400, "ประเภทรหัสไม่ถูกต้อง");
    try {
      next = { ...next, ...renamePin(role, String(id ?? ""), String(label ?? ""), next) };
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    changed.push(`renamePin:${role}:${String(label).trim().slice(0, 30)}`);
  }

  for (const op of ["removePin", "togglePin"] as const) {
    if (!b[op]) continue;
    const { role, id } = b[op];
    if (!isRole(role)) throw new HttpError(400, "ประเภทรหัสไม่ถูกต้อง");
    const enabled = op === "togglePin" ? !!b[op].enabled : false;
    if (id === ENV_ID[role]) {
      if (op === "removePin") throw new HttpError(400, "รหัสตั้งต้น (Vercel) ลบไม่ได้ — ปิดใช้งานได้อย่างเดียว");
      next.envPins = { ...next.envPins, [role]: enabled ? "on" : "off" };
      changed.push(`${op}:${role}:env${enabled ? ":on" : ":off"}`);
    } else {
      const list = next[listKey(role)];
      const found = list.find((p) => p.id === id);
      if (!found) throw new HttpError(404, "ไม่พบรหัสนี้");
      const updated = op === "removePin" ? list.filter((p) => p.id !== id) : list.map((p) => (p.id === id ? { ...p, enabled } : p));
      next = { ...next, [listKey(role)]: updated };
      changed.push(`${op}:${role}:${found.label}${op === "togglePin" ? (enabled ? ":on" : ":off") : ""}`);
    }
    if (role === "admin" && usableAdminPins(next, env) === 0) {
      throw new HttpError(400, "ต้องเหลือรหัสแอดมินที่เปิดใช้อย่างน้อย 1 รหัส — เพิ่ม/เปิดรหัสอื่นก่อน");
    }
  }

  if (typeof b.staffPinDaily === "boolean") {
    next.staffPinDaily = b.staffPinDaily;
    changed.push("staffPinDaily");
  }
  if (b.schedule) {
    const sc = b.schedule;
    const days = Array.isArray(sc.days) ? sc.days.filter((d: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))) : [];
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!hhmm.test(sc.start) || !hhmm.test(sc.end) || sc.start >= sc.end) throw new HttpError(400, "เวลาเปิด/ปิดไม่ถูกต้อง");
    next.schedule = { enabled: !!sc.enabled, days, start: sc.start, end: sc.end };
    changed.push("schedule");
  }

  const saved = await saveSettings(next);
  await writeLog(s, "settings", { detail: { changed } }); // labels only, never the PINs
  return NextResponse.json(publicView(saved));
});
