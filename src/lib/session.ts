import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "./db";
import { getSettings } from "./settings";
import { isOpen } from "./time";

export type Role = "admin" | "staff";

export interface Session {
  role: Role;
  deviceId: string;
  deviceName: string | null;
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
    return { role: payload.role as Role, deviceId: String(payload.deviceId), deviceName: (payload.deviceName as string) ?? null };
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

/** Use at the top of every API route. Admin passes every check. Staff is blocked outside opening hours. */
export async function requireSession(role: Role = "staff"): Promise<Session> {
  const s = await readSession();
  if (!s) throw new HttpError(401, "กรุณาปลดล็อกแอปก่อน");
  if (role === "admin" && s.role !== "admin") throw new HttpError(403, "เฉพาะแอดมินเท่านั้น");
  if (s.role === "staff") {
    const settings = await getSettings();
    if (!isOpen(settings.schedule)) throw new HttpError(403, "ระบบปิดอยู่ (นอกวัน/เวลาแจกเสื้อ)");
  }
  return s;
}

export async function writeLog(
  s: Partial<Session> | null,
  action: string,
  extra: { studentId?: string | null; faculty?: string | null; detail?: Record<string, unknown> } = {},
) {
  const { ip, userAgent } = await clientInfo();
  const { error } = await db().from("logs").insert({
    action,
    role: s?.role ?? null,
    device_id: s?.deviceId ?? null,
    device_name: s?.deviceName ?? null,
    ip,
    user_agent: userAgent,
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
