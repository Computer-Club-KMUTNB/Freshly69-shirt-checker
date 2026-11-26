import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";
import { autoCases } from "@/lib/testcases";
import { T_CASES, T_DIST, syncReceived } from "@/lib/testmode";

/** TEST MODE: replace the auto-generated cases with a fresh set (hand-made cases are kept). */
export const POST = route(async (req: Request) => {
  await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  const faculty = FACULTY_KEYS.includes(b.faculty) ? b.faculty : FACULTY_KEYS[0];
  const { data: old } = await db().from(T_CASES).select("student_id").eq("auto", true);
  if (old?.length) {
    await db().from(T_DIST).delete().in("student_id", old.map((o) => o.student_id));
    await db().from(T_CASES).delete().eq("auto", true);
  }
  const rows = autoCases(faculty);
  const { error } = await db().from(T_CASES).insert(rows);
  if (error) throw error;
  for (const r of rows) await syncReceived(r.student_id, r.problem, r.size, r.faculty);
  return NextResponse.json({ ok: true, count: rows.length });
});
