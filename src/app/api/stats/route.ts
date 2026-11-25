import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";

/** Counts only (no names / phones) — safe for staff. */
export const GET = route(async () => {
  await requireSession("staff");
  const { data, error } = await db().rpc("get_stats");
  if (error) throw error;
  return NextResponse.json(data);
});
