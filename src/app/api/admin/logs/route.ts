import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";

const PAGE = 100;

/** ADMIN: every log line, newest first. ?before=<id>&action=&studentId=&deviceId= */
export const GET = route(async (req: Request) => {
  await requireSession("admin");
  const p = new URL(req.url).searchParams;
  let q = db().from("logs").select("*").order("id", { ascending: false }).limit(PAGE);
  const before = Number(p.get("before"));
  if (Number.isFinite(before) && before > 0) q = q.lt("id", before);
  if (p.get("action")) q = q.eq("action", p.get("action")!);
  if (p.get("studentId")) q = q.eq("student_id", p.get("studentId")!.replace(/\D/g, ""));
  if (p.get("deviceId")) q = q.eq("device_id", p.get("deviceId")!);
  const { data, error } = await q;
  if (error) throw error;
  return NextResponse.json({ logs: data, more: data.length === PAGE });
});
