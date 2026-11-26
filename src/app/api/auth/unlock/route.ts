import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { matchPin } from "@/lib/pins";
import { COOKIE, HttpError, clientInfo, route, signSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { bangkokDate, isOpen, nextBangkokMidnight } from "@/lib/time";

const MAX_FAILS = 5;
const LOCK_MINUTES = 5;

/**
 * POST { pin, deviceId, deviceName? } → sets a session cookie valid until midnight (Bangkok).
 * Any of the admin / staff PINs in Settings works; the PIN's label (e.g. "ทีม A") is shown in the
 * header and written to every log line, so the admin can see who did what.
 */
export const POST = route(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");
  const deviceId = String(body.deviceId ?? "").slice(0, 64);
  const nickname = body.deviceName ? String(body.deviceName).trim().slice(0, 40) : null;
  if (!deviceId) throw new HttpError(400, "ไม่มีรหัสเครื่อง");

  const { ip } = await clientInfo();
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  // rate-limit check and settings in parallel (one round trip instead of two)
  const [{ count }, settings] = await Promise.all([
    db().from("login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("ok", false).gte("at", since),
    getSettings(true),
  ]);
  if ((count ?? 0) >= MAX_FAILS) {
    throw new HttpError(429, `ใส่รหัสผิดเกิน ${MAX_FAILS} ครั้ง รอ ${LOCK_MINUTES} นาทีแล้วลองใหม่`);
  }

  const match = matchPin(pin, settings, {
    adminPin: process.env.ADMIN_PIN,
    staffPin: process.env.STAFF_PIN,
    secret: process.env.SESSION_SECRET!,
    today: bangkokDate(),
  });

  after(async () => {
    await db().from("login_attempts").insert({ ip, ok: !!match });
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
  if (settings.askDeviceName && !nickname) throw new HttpError(400, "กรุณาใส่ชื่อเล่น");

  // "ชื่อเล่น (ชื่อรหัส)" — either part may be missing
  const deviceName = nickname && label ? `${nickname} (${label})` : (nickname ?? label);
  const session = { role, deviceId, deviceName, pinId };

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
