import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { lookup } from "@/lib/lookup";
import { validateConfirm } from "@/lib/rules";
import { HttpError, requireSession, route, writeLog } from "@/lib/session";

/**
 * ยืนยันแจก. POST { studentId, faculty, rowId?, size? }
 * Re-checks every rule on the server (never trusts what the phone shows).
 */
export const POST = route(async (req: Request) => {
  const s = await requireSession("staff");
  const body = await req.json().catch(() => ({}));
  const faculty = String(body.faculty ?? "");
  if (!FACULTY_KEYS.includes(faculty)) throw new HttpError(400, "เลือกคณะที่กำลังแจกก่อน");

  const result = await lookup(String(body.studentId ?? ""), faculty);
  const v = validateConfirm(result, { rowId: body.rowId != null ? Number(body.rowId) : undefined, size: body.size });
  if (!v.ok) return NextResponse.json({ error: v.error, lookup: result }, { status: 409 });

  const { data, error } = await db()
    .from("distributions")
    .insert({
      student_id: result.studentId,
      student_row_id: v.rowId,
      size: v.size,
      faculty,
      device_id: s.deviceId,
      device_name: s.deviceName,
    })
    .select("id, size, faculty, device_name, device_id, created_at")
    .single();
  if (error) {
    // 23505 = unique violation → another phone confirmed this student a moment ago
    if (error.code === "23505") {
      return NextResponse.json({ error: "คนนี้เพิ่งถูกยืนยันจากอีกเครื่อง", lookup: await lookup(result.studentId, faculty) }, { status: 409 });
    }
    throw error;
  }
  await writeLog(s, "confirm", {
    studentId: result.studentId,
    faculty,
    detail: { distributionId: data.id, size: v.size, rowId: v.rowId, issue: result.result },
  });
  return NextResponse.json({ distribution: data });
});
