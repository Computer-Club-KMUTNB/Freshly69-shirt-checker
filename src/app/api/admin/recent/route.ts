import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";

/** ADMIN: latest handouts with names (staff only sees counts). */
export const GET = route(async () => {
  await requireSession("admin");
  const { data, error } = await db()
    .from("distributions")
    .select("id, student_id, size, faculty, device_name, created_at, voided_at, students:student_row_id (title, full_name)")
    .order("id", { ascending: false })
    .limit(20);
  if (error) throw error;
  return NextResponse.json(data);
});
