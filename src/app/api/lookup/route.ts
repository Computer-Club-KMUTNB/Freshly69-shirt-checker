import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { lookup } from "@/lib/lookup";
import { HttpError, requireSession, route, writeLog } from "@/lib/session";

/**
 * POST { studentId, faculty, source: "scan" | "search" }
 * Every scan/search is logged (with its result) even if nobody presses ยืนยัน afterwards.
 */
export const POST = route(async (req: Request) => {
  const s = await requireSession("staff");
  const body = await req.json().catch(() => ({}));
  const faculty = String(body.faculty ?? "");
  if (!FACULTY_KEYS.includes(faculty)) throw new HttpError(400, "เลือกคณะที่กำลังแจกก่อน");
  const source = body.source === "search" ? "search" : "scan";

  const result = await lookup(String(body.studentId ?? ""), faculty);
  await writeLog(s, source, {
    studentId: result.studentId,
    faculty,
    detail: { result: result.result },
  });
  return NextResponse.json(result);
});
