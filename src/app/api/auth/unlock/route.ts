import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { matchPin } from "@/lib/pins";
import { COOKIE, HttpError, clientInfo, route, signSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { bangkokDate, isOpen, nextBangkokMidnight } from "@/lib/time";

// Wrong-PIN lockout. Counted PER PHONE (many staff share one venue Wi-Fi / mobile IP, so a per-IP
// limit would lock everyone at once) plus a looser per-IP cap against someone rotating device ids.
const MAX_FAILS_PER_DEVICE = 5;
const MAX_FAILS_PER_IP = 30;
const LOCK_MINUTES = 5;

/** login_attempts.ip stores "ip#deviceId" so both limits work without a schema change. */
const attemptKey = (ip: string, deviceId: string) => `${ip}#${deviceId}`;

/**
 * POST { pin, deviceId } → sets a session cookie valid until midnight (Bangkok).
 * Any of the admin / staff PINs in Settings works; the PIN's label (e.g. "ทีม A") is shown in the
 * header and written to every log line, so the admin can see who did what.
 */
export const POST = route(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");
  const deviceId = String(body.deviceId ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  if (!deviceId) throw new HttpError(400, "ไม่มีรหัสเครื่อง");

  const { ip } = await clientInfo();
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  const key = attemptKey(ip, deviceId);
  const fails = () => db().from("login_attempts").select("id", { count: "exact", head: true }).eq("ok", false).gte("at", since);
  // both rate-limit counts and the settings in parallel (one round trip)
  const [{ count: deviceFails }, { count: ipFails }, settings] = await Promise.all([
    fails().eq("ip", key),
    fails().like("ip", `${ip}#%`),
    getSettings(true),
  ]);
  if ((deviceFails ?? 0) >= MAX_FAILS_PER_DEVICE) {
    throw new HttpError(429, `ใส่รหัสผิดเกิน ${MAX_FAILS_PER_DEVICE} ครั้ง รอ ${LOCK_MINUTES} นาทีแล้วลองใหม่`);
  }
  if ((ipFails ?? 0) >= MAX_FAILS_PER_IP) {
    throw new HttpError(429, `มีการใส่รหัสผิดจากเครือข่ายนี้มากเกินไป รอ ${LOCK_MINUTES} นาทีแล้วลองใหม่`);
  }

  const match = matchPin(pin, settings, {
    adminPin: process.env.ADMIN_PIN,
    staffPin: process.env.STAFF_PIN,
    secret: process.env.SESSION_SECRET!,
    today: bangkokDate(),
  });

  after(async () => {
    await db().from("login_attempts").insert({ ip: key, ok: !!match });
    // IPs are kept only for the 5-minute lockout → drop anything older than a day
    await db().from("login_attempts").delete().lt("at", new Date(Date.now() - 86_400_000).toISOString());
  });
  if (!match) {
    throw new HttpError(401, "รหัสไม่ถูกต้อง");
  }
  const { role, label, pinId } = match;
  if (role === "staff" && !isOpen(settings.schedule)) {
    throw new HttpError(403, "ระบบปิดอยู่ (นอกวัน/เวลาแจกเสื้อ)");
  }

  // "ชื่อเล่น (ชื่อรหัส)" — either part may be missing
  // no nickname any more: "who" is the PIN's name, which the admin sets in Settings
  const nick = null;
  const deviceName = nick && label ? `${nick} (${label})` : (nick ?? label);
  const session = { role, deviceId, deviceName, pinId, nick };

  const exp = nextBangkokMidnight();
  const res = NextResponse.json({ role, deviceName });
  res.cookies.set(COOKIE, await signSession(session, exp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp * 1000),
  });
  return res;
});
