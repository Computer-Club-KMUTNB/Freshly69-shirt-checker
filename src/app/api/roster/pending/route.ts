import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";

/** STAFF + ADMIN: names + phones of people who have not received a shirt, per faculty. (Views are not logged.) */
export const GET = route(async (req: Request) => {
  await requireSession("staff"); // staff + admin
  const f = new URL(req.url).searchParams.get("faculty");
  const faculty = f && FACULTY_KEYS.includes(f) ? f : null;
  const { data, error } = await db().rpc("get_pending", { p_faculty: faculty });
  if (error) throw error;
  return NextResponse.json(data);
});
