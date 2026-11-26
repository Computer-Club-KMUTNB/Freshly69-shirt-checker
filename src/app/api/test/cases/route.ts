import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, requireSession, route } from "@/lib/session";
import { T_CASES, T_DIST, cleanCase, syncReceived } from "@/lib/testmode";

/** TEST MODE: list test cases with their (test) handout status. */
export const GET = route(async () => {
  await requireSession("admin");
  const [c, d] = await Promise.all([
    db().from(T_CASES).select("*").order("id"),
    db().from(T_DIST).select("student_id, size, faculty, created_at").is("voided_at", null),
  ]);
  if (c.error) throw c.error;
  if (d.error) throw d.error;
  const given = new Map(d.data.map((x) => [x.student_id, x]));
  return NextResponse.json(c.data.map((x) => ({ ...x, given: given.get(x.student_id) ?? null })));
});

/** TEST MODE: create (no id) or update ({ id }) a case. */
export const POST = route(async (req: Request) => {
  await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  let row;
  try {
    row = cleanCase(b);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const { data, error } = b.id
    ? await db().from(T_CASES).update(row).eq("id", Number(b.id)).select().single()
    : await db().from(T_CASES).insert(row).select().single();
  if (error) {
    if (error.code === "23505") throw new HttpError(409, "มีรหัสนี้ในข้อมูลทดสอบแล้ว");
    throw error;
  }
  await syncReceived(row.student_id, row.problem, row.size, row.faculty);
  return NextResponse.json(data);
});

/** TEST MODE: delete one case (?id=) and its test handouts. */
export const DELETE = route(async (req: Request) => {
  await requireSession("admin");
  const id = Number(new URL(req.url).searchParams.get("id"));
  const { data, error } = await db().from(T_CASES).delete().eq("id", id).select("student_id").maybeSingle();
  if (error) throw error;
  if (data) await db().from(T_DIST).delete().eq("student_id", data.student_id);
  return NextResponse.json({ ok: true });
});
