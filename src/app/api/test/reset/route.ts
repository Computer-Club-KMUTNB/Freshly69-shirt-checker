import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";
import { T_CASES, T_DIST, syncReceived } from "@/lib/testmode";

/**
 * TEST MODE: { what: "handouts" } = forget every test handout (cases stay; "received" cases are
 * re-created as received). { what: "all" } = delete all test cases too.
 */
export const POST = route(async (req: Request) => {
  await requireSession("admin");
  const b = await req.json().catch(() => ({}));
  const del = await db().from(T_DIST).delete().gte("id", 0);
  if (del.error) throw del.error;
  if (b.what === "all") {
    const e = await db().from(T_CASES).delete().gte("id", 0);
    if (e.error) throw e.error;
  } else {
    const { data } = await db().from(T_CASES).select("student_id, problem, size, faculty").eq("problem", "received");
    for (const r of data ?? []) await syncReceived(r.student_id, r.problem, r.size, r.faculty);
  }
  return NextResponse.json({ ok: true });
});
