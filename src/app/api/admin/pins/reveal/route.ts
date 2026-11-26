import { NextResponse } from "next/server";
import { revealPin, type Role } from "@/lib/pins";
import { HttpError, requireSession, route, writeLog } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { bangkokDate } from "@/lib/time";

/**
 * ADMIN: show one PIN. POST { role, id } → { pin }.
 * Every reveal is logged (which PIN, by whom) — the PIN itself is never logged.
 * Responses under /api are Cache-Control: no-store (next.config.ts).
 */
export const POST = route(async (req: Request) => {
  const s = await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  const role: Role | null = b.role === "admin" || b.role === "staff" ? b.role : null;
  if (!role || !b.id) throw new HttpError(400, "ไม่ระบุรหัสที่จะดู");
  const settings = await getSettings(true);
  const pin = revealPin(role, String(b.id), settings, {
    adminPin: process.env.ADMIN_PIN,
    staffPin: process.env.STAFF_PIN,
    secret: process.env.SESSION_SECRET!,
    today: bangkokDate(),
  });
  if (!pin) throw new HttpError(404, "รหัสนี้ดูย้อนหลังไม่ได้ (สร้างก่อนมีฟีเจอร์นี้) — ลบแล้วเพิ่มใหม่");
  const label = [...settings.adminPins, ...settings.staffPins].find((p) => p.id === b.id)?.label ?? String(b.id);
  await writeLog(s, "reveal_pin", { detail: { role, pin: label } });
  return NextResponse.json({ pin });
});
