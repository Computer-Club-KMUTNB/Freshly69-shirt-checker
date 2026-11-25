import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";

/** ADMIN: the problem list (duplicate ids). "แก้แล้ว" = has an active distribution. */
export const GET = route(async () => {
  await requireSession("admin");
  const { data: rows, error } = await db()
    .from("students")
    .select("id, student_id, title, full_name, form_faculty, id_faculty, size, phone, submitted_at, issue_type")
    .neq("issue_type", "none")
    .order("student_id")
    .order("submitted_at");
  if (error) throw error;
  const ids = [...new Set(rows.map((r) => r.student_id))];
  const { data: dist, error: e2 } = await db()
    .from("distributions")
    .select("student_id, student_row_id, size, faculty, device_name, created_at")
    .in("student_id", ids.length ? ids : ["-"])
    .is("voided_at", null);
  if (e2) throw e2;
  const byId = new Map(dist.map((d) => [d.student_id, d]));
  const groups = ids.map((id) => {
    const rs = rows.filter((r) => r.student_id === id);
    return { studentId: id, issueType: rs[0].issue_type, rows: rs, distribution: byId.get(id) ?? null };
  });
  return NextResponse.json(groups);
});
