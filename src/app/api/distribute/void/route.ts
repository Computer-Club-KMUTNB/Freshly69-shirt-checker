import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, requireSession, route, writeLog } from "@/lib/session";

/** ปุ่ม "แก้ไข": cancel a distribution so it can be redone. POST { distributionId, reason? } */
export const POST = route(async (req: Request) => {
  const s = await requireSession("staff");
  const body = await req.json().catch(() => ({}));
  const id = Number(body.distributionId);
  if (!Number.isFinite(id)) throw new HttpError(400, "ไม่มีรายการที่จะแก้ไข");

  const { data, error } = await db()
    .from("distributions")
    .update({ voided_at: new Date().toISOString(), void_device_id: s.deviceId })
    .eq("id", id)
    .is("voided_at", null)
    .select("id, student_id, size, faculty")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "รายการนี้ถูกแก้ไขไปแล้ว");

  await writeLog(s, "void", {
    studentId: data.student_id,
    faculty: data.faculty,
    detail: { distributionId: id, size: data.size, reason: body.reason ? String(body.reason).slice(0, 200) : null },
  });
  return NextResponse.json({ ok: true, studentId: data.student_id });
});
