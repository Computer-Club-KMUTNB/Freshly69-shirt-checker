import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";

/** STAFF + ADMIN: latest 100 handouts (incl. cancelled), optionally for one faculty. ?faculty= */
export const GET = route(async (req: Request) => {
  await requireSession("staff");
  const f = new URL(req.url).searchParams.get("faculty");
  let q = db()
    .from("distributions")
    .select("id, student_id, size, faculty, device_name, created_at, voided_at, students:student_row_id (title, full_name)")
    .order("id", { ascending: false })
    .limit(100);
  if (f && FACULTY_KEYS.includes(f)) q = q.eq("faculty", f);
  const { data, error } = await q;
  if (error) throw error;
  return NextResponse.json(data);
});
