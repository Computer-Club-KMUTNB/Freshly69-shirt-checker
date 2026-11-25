import "server-only";
import { db } from "./db";
import { evaluate, normalizeStudentId, type ActiveDistribution, type LookupResult, type StudentRow } from "./rules";

const STUDENT_COLS = "id, student_id, title, full_name, form_faculty, id_faculty, size, submitted_at, issue_type";

/** Load everything the rules need for one student id, then evaluate. */
export async function lookup(rawId: string, selectedFaculty: string): Promise<LookupResult> {
  const id = normalizeStudentId(rawId);
  if (!id) return evaluate(rawId, [], null, selectedFaculty);
  const [rows, active] = await Promise.all([
    db().from("students").select(STUDENT_COLS).eq("student_id", id),
    db()
      .from("distributions")
      .select("id, size, faculty, device_name, device_id, created_at")
      .eq("student_id", id)
      .is("voided_at", null)
      .maybeSingle(),
  ]);
  if (rows.error) throw rows.error;
  if (active.error) throw active.error;
  return evaluate(id, (rows.data ?? []) as StudentRow[], (active.data as ActiveDistribution) ?? null, selectedFaculty);
}
