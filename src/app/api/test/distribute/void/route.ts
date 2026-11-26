import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, requireSession, route } from "@/lib/session";
import { T_DIST } from "@/lib/testmode";

/** TEST MODE twin of /api/distribute/void (ปุ่มแก้ไข). */
export const POST = route(async (req: Request) => {
  await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  const { data, error } = await db()
    .from(T_DIST)
    .update({ voided_at: new Date().toISOString() })
    .eq("id", Number(b.distributionId))
    .is("voided_at", null)
    .select("student_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "รายการนี้ถูกแก้ไขไปแล้ว");
  return NextResponse.json({ ok: true, studentId: data.student_id });
});
