import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { validateConfirm } from "@/lib/rules";
import { HttpError, requireSession, route } from "@/lib/session";
import { T_DIST, testLookup } from "@/lib/testmode";

/** TEST MODE twin of /api/distribute — writes test_distributions only. */
export const POST = route(async (req: Request) => {
  const s = await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  if (!FACULTY_KEYS.includes(b.faculty)) throw new HttpError(400, "เลือกคณะที่กำลังแจกก่อน");
  const result = await testLookup(String(b.studentId ?? ""), b.faculty);
  const v = validateConfirm(result, { rowId: b.rowId != null ? Number(b.rowId) : undefined, size: b.size });
  if (!v.ok) return NextResponse.json({ error: v.error, lookup: result }, { status: 409 });
  const { data, error } = await db()
    .from(T_DIST)
    .insert({ student_id: result.studentId, row_key: v.rowId % 10, size: v.size, faculty: b.faculty, device_id: s.deviceId, device_name: s.deviceName })
    .select("id, size, faculty, device_name, device_id, created_at")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "คนนี้เพิ่งถูกยืนยันจากอีกเครื่อง" }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ distribution: data });
});
