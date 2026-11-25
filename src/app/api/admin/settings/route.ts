import { NextResponse } from "next/server";
import { dailyPin, hashPin, isSixDigits } from "@/lib/pin";
import { HttpError, requireSession, route, writeLog } from "@/lib/session";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import { bangkokDate } from "@/lib/time";

function publicView(s: Settings) {
  const today = bangkokDate();
  const tomorrow = bangkokDate(new Date(Date.now() + 86_400_000));
  return {
    staffPinDaily: s.staffPinDaily,
    askDeviceName: s.askDeviceName,
    schedule: s.schedule,
    adminPinSet: !!s.adminPinHash,
    staffPinSet: !!s.staffPinHash,
    dailyPins: s.staffPinDaily
      ? { [today]: dailyPin(process.env.SESSION_SECRET!, today), [tomorrow]: dailyPin(process.env.SESSION_SECRET!, tomorrow) }
      : null,
  };
}

export const GET = route(async () => {
  await requireSession("admin");
  return NextResponse.json(publicView(await getSettings(true)));
});

/** POST any of { adminPin, staffPin, staffPinDaily, askDeviceName, schedule } */
export const POST = route(async (req: Request) => {
  const s = await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  const patch: Partial<Settings> = {};
  const changed: string[] = [];

  if (b.adminPin != null) {
    if (!isSixDigits(String(b.adminPin))) throw new HttpError(400, "รหัสแอดมินต้องเป็นตัวเลข 6 หลัก");
    patch.adminPinHash = hashPin(String(b.adminPin));
    changed.push("adminPin");
  }
  if (b.staffPin != null) {
    if (!isSixDigits(String(b.staffPin))) throw new HttpError(400, "รหัสสตาฟต้องเป็นตัวเลข 6 หลัก");
    patch.staffPinHash = hashPin(String(b.staffPin));
    changed.push("staffPin");
  }
  if (b.adminPin != null && b.staffPin != null && String(b.adminPin) === String(b.staffPin)) {
    throw new HttpError(400, "รหัสแอดมินกับสตาฟต้องไม่ซ้ำกัน");
  }
  if (typeof b.staffPinDaily === "boolean") {
    patch.staffPinDaily = b.staffPinDaily;
    changed.push("staffPinDaily");
  }
  if (typeof b.askDeviceName === "boolean") {
    patch.askDeviceName = b.askDeviceName;
    changed.push("askDeviceName");
  }
  if (b.schedule) {
    const sc = b.schedule;
    const days = Array.isArray(sc.days) ? sc.days.filter((d: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))) : [];
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!hhmm.test(sc.start) || !hhmm.test(sc.end) || sc.start >= sc.end) throw new HttpError(400, "เวลาเปิด/ปิดไม่ถูกต้อง");
    patch.schedule = { enabled: !!sc.enabled, days, start: sc.start, end: sc.end };
    changed.push("schedule");
  }

  const next = await saveSettings(patch);
  await writeLog(s, "settings", { detail: { changed } }); // never log the PINs themselves
  return NextResponse.json(publicView(next));
});
