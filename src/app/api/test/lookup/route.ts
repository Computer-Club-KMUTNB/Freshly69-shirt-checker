import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { HttpError, requireSession, route } from "@/lib/session";
import { testLookup } from "@/lib/testmode";

/** TEST MODE twin of /api/lookup — reads test_cases only and writes no logs. */
export const POST = route(async (req: Request) => {
  await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  if (!FACULTY_KEYS.includes(b.faculty)) throw new HttpError(400, "เลือกคณะที่กำลังแจกก่อน");
  return NextResponse.json(await testLookup(String(b.studentId ?? ""), b.faculty));
});
