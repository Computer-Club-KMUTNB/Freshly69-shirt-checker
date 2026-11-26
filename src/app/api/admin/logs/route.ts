import { NextResponse } from "next/server";
import { FACULTY_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireSession, route } from "@/lib/session";

const PAGE = 100;
const LOG_ACTIONS = ["scan", "search", "confirm", "void"];
const COLS = "id, at, action, role, device_name, student_id, faculty, detail"; // no device id / IP / browser

const iso = (v: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** ADMIN: handout log lines, newest first. ?before=<id>&action=scan_search|confirm|void&studentId=&faculty=&from=<ISO>&to=<ISO> */
export const GET = route(async (req: Request) => {
  await requireSession("admin");
  const p = new URL(req.url).searchParams;
  let q = db().from("logs").select(COLS).order("id", { ascending: false }).limit(PAGE);
  const before = Number(p.get("before"));
  if (Number.isFinite(before) && before > 0) q = q.lt("id", before);
  // owner (26/11): the log is only about handouts → scan/search, confirm, void
  const a = p.get("action");
  q = a === "scan_search" ? q.in("action", ["scan", "search"]) : a && LOG_ACTIONS.includes(a) ? q.eq("action", a) : q.in("action", LOG_ACTIONS);
  if (p.get("studentId")) q = q.eq("student_id", p.get("studentId")!.replace(/\D/g, ""));
  const faculty = p.get("faculty");
  if (faculty && FACULTY_KEYS.includes(faculty)) q = q.eq("faculty", faculty);
  const from = iso(p.get("from"));
  const to = iso(p.get("to"));
  if (from) q = q.gte("at", from);
  if (to) q = q.lte("at", to);
  const { data, error } = await q;
  if (error) throw error;
  return NextResponse.json({ logs: data, more: data.length === PAGE });
});
