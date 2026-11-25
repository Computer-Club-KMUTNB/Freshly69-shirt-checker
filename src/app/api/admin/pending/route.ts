import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireSession, route, writeLog } from "@/lib/session";

/** ADMIN: names + phones of people who have not received a shirt. Every view is logged. */
export const GET = route(async (req: Request) => {
  const s = await requireSession("admin");
  const f = new URL(req.url).searchParams.get("faculty");
  const faculty = f && FACULTY_KEYS.includes(f) ? f : null;
  const { data, error } = await db().rpc("get_pending", { p_faculty: faculty });
  if (error) throw error;
  await writeLog(s, "view_pending", { faculty, detail: { count: (data as unknown[]).length } });
  return NextResponse.json(data);
});
