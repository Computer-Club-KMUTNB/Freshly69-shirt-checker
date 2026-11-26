import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { NextResponse, after } from "next/server";
import { db } from "./db";
import { getSettings } from "./settings";
import { currentPinLabel, pinStillValid } from "./pins";
import { bangkokDate, isOpen } from "./time";

export type Role = "admin" | "staff";

export interface Session {
  role: Role;
  deviceId: string;
  deviceName: string | null;
  /** Which PIN opened this session (see pins.ts). Removing / switching it off logs the user out. */
  pinId?: string;
  /** Nickname typed at unlock (deviceName = "nick (PIN name)"), kept so a PIN rename shows up at once. */
  nick?: string | null;
}

export const COOKIE = "f69_session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars, see .env.example)");
  return new TextEncoder().encode(s);
}

export async function signSession(s: Session, expiresAt: number): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret());
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      role: payload.role as Role,
      deviceId: String(payload.deviceId),
      deviceName: (payload.deviceName as string) ?? null,
      pinId: (payload.pinId as string) ?? undefined,
      nick: (payload.nick as string) ?? null,
    };
  } catch {
    return null;
  }
}

export async function clientInfo() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return { ip, userAgent: h.get("user-agent") ?? "" };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** The session from the cookie, but only if the PIN it was opened with is still on. */
export async function validSession(): Promise<Session | null> {
  const s = await readSession();
  if (!s) return null;
  const settings = await getSettings();
  const ok = pinStillValid(s.role, s.pinId, settings, {
    adminPin: process.env.ADMIN_PIN,
    staffPin: process.env.STAFF_PIN,
    secret: process.env.SESSION_SECRET!,
    today: bangkokDate(),
  });
  if (!ok) return null;
  // show the PIN's current name (admins can rename PINs while people are logged in)
  if (s.nick !== undefined) {
    const label = currentPinLabel(s.role, s.pinId, settings);
    s.deviceName = s.nick && label ? `${s.nick} (${label})` : (s.nick ?? label);
  }
  return s;
}

/** Use at the top of every API route. Admin passes every check. Staff is blocked outside opening hours. */
export async function requireSession(role: Role = "staff", opts: { ignoreSchedule?: boolean } = {}): Promise<Session> {
  const s = await validSession();
  if (!s) throw new HttpError(401, "กรุณาปลดล็อกแอปก่อน (รหัสอาจถูกปิดหรือลบ)");
  if (role === "admin" && s.role !== "admin") throw new HttpError(403, "เฉพาะแอดมินเท่านั้น");
  if (s.role === "staff" && !opts.ignoreSchedule) {
    const settings = await getSettings();
    if (!isOpen(settings.schedule)) throw new HttpError(403, "ระบบปิดอยู่ (นอกวัน/เวลาแจกเสื้อ)");
  }
  return s;
}

/**
 * Append an audit log line: when, what, who (PIN label / nickname + role), faculty, student id,
 * result. No device id, IP or browser info (owner's decision: keep only what is needed).
 * The insert runs AFTER the response is sent (next/server `after`), so logging never slows the phone.
 */
export async function writeLog(
  s: Partial<Session> | null,
  action: string,
  extra: { studentId?: string | null; faculty?: string | null; detail?: Record<string, unknown> } = {},
) {
  if (s?.role === "admin") return; // owner: admin actions are not kept in the log
  after(() => insertLog(s, action, extra));
}

async function insertLog(
  s: Partial<Session> | null,
  action: string,
  extra: { studentId?: string | null; faculty?: string | null; detail?: Record<string, unknown> },
) {
  const { error } = await db().from("logs").insert({
    action,
    role: s?.role ?? null,
    device_name: s?.deviceName ?? null, // "who": PIN label and/or nickname
    student_id: extra.studentId ?? null,
    faculty: extra.faculty ?? null,
    detail: extra.detail ?? null,
  });
  if (error) console.error("log insert failed", error);
}

/** Wrap a route handler: turns HttpError / unexpected errors into JSON responses. */
export function route<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้ง" }, { status: 500 });
    }
  };
}
