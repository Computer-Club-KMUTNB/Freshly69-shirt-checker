import "server-only";
// Server helpers for test mode. ONLY touches test_cases / test_distributions — never real tables,
// never the audit log.
import { db } from "./db";
import { evaluate, normalizeStudentId, type ActiveDistribution, type LookupResult } from "./rules";
import { caseToRows, type TestCase } from "./testcases";

export const T_CASES = "test_cases";
export const T_DIST = "test_distributions";

export async function testLookup(rawId: string, desk: string): Promise<LookupResult> {
  const id = normalizeStudentId(rawId);
  if (!id) return evaluate(rawId, [], null, desk);
  const [c, a] = await Promise.all([
    db().from(T_CASES).select("*").eq("student_id", id).maybeSingle(),
    db().from(T_DIST).select("id, size, faculty, device_name, device_id, created_at").eq("student_id", id).is("voided_at", null).maybeSingle(),
  ]);
  if (c.error) throw c.error;
  if (a.error) throw a.error;
  const tc = c.data as TestCase | null;
  return evaluate(id, tc ? caseToRows(tc) : [], (a.data as ActiveDistribution) ?? null, desk, {
    isFreshman: () => (tc?.year ?? 1) === 1,
  });
}

/** Clean + validate a case coming from the editor. Throws a Thai message on bad input. */
export function cleanCase(b: Record<string, unknown>) {
  const str = (v: unknown, max = 80) => (v == null || v === "" ? null : String(v).trim().slice(0, max));
  const student_id = normalizeStudentId(String(b.student_id ?? ""));
  if (!student_id) throw new Error("รหัสนักศึกษาต้องเป็นตัวเลข 13 หลัก");
  const full_name = str(b.full_name);
  if (!full_name) throw new Error("ใส่ชื่อ-สกุล");
  const problem = ["none", "dup_same", "dup_size", "dup_person", "received"].includes(String(b.problem)) ? String(b.problem) : "none";
  return {
    student_id,
    title: str(b.title, 20),
    full_name,
    faculty: str(b.faculty, 40) ?? "วิศวะ",
    size: (str(b.size, 5) ?? "M").toUpperCase(),
    year: Math.min(8, Math.max(1, Number(b.year) || 1)),
    problem,
    second_name: str(b.second_name),
    second_size: str(b.second_size, 5)?.toUpperCase() ?? null,
    second_faculty: str(b.second_faculty, 40),
  };
}

/** "received" cases always start with an active test handout. */
export async function syncReceived(studentId: string, problem: string, size: string, faculty: string) {
  if (problem !== "received") return;
  const { data } = await db().from(T_DIST).select("id").eq("student_id", studentId).is("voided_at", null).maybeSingle();
  if (!data) await db().from(T_DIST).insert({ student_id: studentId, size, faculty, device_name: "(สร้างจากหน้าทดสอบ)" });
}
