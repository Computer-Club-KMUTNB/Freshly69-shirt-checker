import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { constantTimeEqual, dailyPin, isSixDigits, verifyPin } from "@/lib/pin";
import { COOKIE, HttpError, clientInfo, route, signSession, writeLog, type Role } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { bangkokDate, isOpen, nextBangkokMidnight } from "@/lib/time";

const MAX_FAILS = 5;
const LOCK_MINUTES = 5;

function matchesEnvPin(pin: string, envPin: string | undefined) {
  return !!envPin && isSixDigits(envPin) && constantTimeEqual(pin, envPin);
}

/** POST { pin, deviceId, deviceName? } → sets a session cookie valid until midnight (Bangkok). */
export const POST = route(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");
  const deviceId = String(body.deviceId ?? "").slice(0, 64);
  const deviceName = body.deviceName ? String(body.deviceName).trim().slice(0, 40) : null;
  if (!deviceId) throw new HttpError(400, "ไม่มีรหัสเครื่อง");

  const { ip, userAgent } = await clientInfo();
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  const { count } = await db()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("ok", false)
    .gte("at", since);
  if ((count ?? 0) >= MAX_FAILS) {
    throw new HttpError(429, `ใส่รหัสผิดเกิน ${MAX_FAILS} ครั้ง รอ ${LOCK_MINUTES} นาทีแล้วลองใหม่`);
  }

  const settings = await getSettings();
  let role: Role | null = null;
  if (isSixDigits(pin)) {
    const adminOk = settings.adminPinHash
      ? verifyPin(pin, settings.adminPinHash)
      : matchesEnvPin(pin, process.env.ADMIN_PIN);
    if (adminOk) role = "admin";
    else {
      const staffOk = settings.staffPinDaily
        ? constantTimeEqual(pin, dailyPin(process.env.SESSION_SECRET!, bangkokDate()))
        : settings.staffPinHash
          ? verifyPin(pin, settings.staffPinHash)
          : matchesEnvPin(pin, process.env.STAFF_PIN);
      if (staffOk) role = "staff";
    }
  }

  await db().from("login_attempts").insert({ ip, ok: !!role });
  if (!role) {
    await writeLog({ deviceId, deviceName }, "unlock_fail");
    throw new HttpError(401, "รหัสไม่ถูกต้อง");
  }
  if (role === "staff" && !isOpen(settings.schedule)) {
    throw new HttpError(403, "ระบบปิดอยู่ (นอกวัน/เวลาแจกเสื้อ)");
  }
  if (settings.askDeviceName && !deviceName) throw new HttpError(400, "กรุณาใส่ชื่อเล่น/ชื่อโต๊ะ");

  const session = { role, deviceId, deviceName };
  await db().from("devices").upsert(
    { device_id: deviceId, name: deviceName, role, user_agent: userAgent, ip, last_seen: new Date().toISOString() },
    { onConflict: "device_id" },
  );
  await writeLog(session, "unlock");

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
