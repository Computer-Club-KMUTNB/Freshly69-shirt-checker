import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, requireSession, route, writeLog } from "@/lib/session";

import { RESET_WORD } from "@/lib/constants";

/**
 * ADMIN: "เริ่มใหม่" — wipe everything collected while testing so the real event starts clean.
 * Deletes: distributions (all handouts), logs, login_attempts.
 * Keeps:   students (the imported list) and settings (PINs, schedule).
 * Body must be { confirm: "เริ่มใหม่" } so it can't be triggered by accident.
 */
export const POST = route(async (req: Request) => {
  const s = await requireSession("admin");
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== RESET_WORD) throw new HttpError(400, `พิมพ์คำว่า "${RESET_WORD}" เพื่อยืนยัน`);

  const counts: Record<string, number> = {};
  const wipe = async (table: string, col: string, op: "gte" | "neq", v: number | string) => {
    const { count, error } = await db().from(table).delete({ count: "exact" })[op](col, v);
    if (error) throw error;
    counts[table] = count ?? 0;
  };
  // distributions first (it references students), then the audit tables
  await wipe("distributions", "id", "gte", 0);
  await wipe("logs", "id", "gte", 0);
  await wipe("login_attempts", "id", "gte", 0);

  // first line of the new log: who reset and how much was removed
  await writeLog(s, "reset", { detail: counts });
  return NextResponse.json({ ok: true, deleted: counts });
});
