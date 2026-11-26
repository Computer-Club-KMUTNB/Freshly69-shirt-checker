// Pure business rules for "can this student get a shirt at this desk right now?".
// No I/O here, so every rule is unit-tested in rules.test.ts. The API routes call these.

export type IssueType = "none" | "dup_same" | "dup_size" | "dup_person";

export interface StudentRow {
  id: number;
  student_id: string;
  title: string | null;
  full_name: string;
  form_faculty: string;
  id_faculty: string | null;
  size: string;
  phone?: string | null;
  submitted_at: string | null;
  issue_type: IssueType;
}

export interface ActiveDistribution {
  id: number;
  size: string;
  faculty: string;
  device_name: string | null;
  device_id: string | null;
  created_at: string;
}

export type LookupResult =
  | { result: "invalid"; studentId: string }
  | { result: "not_found"; studentId: string }
  | { result: "not_freshman"; studentId: string; candidates: Candidate[] }
  | { result: "received"; studentId: string; distribution: ActiveDistribution; candidates: Candidate[] }
  | { result: "wrong_faculty"; studentId: string; correctFaculty: string; selectedFaculty: string; candidates: Candidate[] }
  | { result: "ok" | "dup_same" | "dup_size" | "dup_person"; studentId: string; faculty: string; candidates: Candidate[] };

/** What the scan screen is allowed to show about a student (no phone number). */
export interface Candidate {
  rowId: number;
  title: string | null;
  fullName: string;
  size: string;
  formFaculty: string;
  submittedAt: string | null;
}

/** Only freshmen (student id starts with the entry year 69) can receive a shirt. */
export const FRESHMAN_PREFIX = "69";
export const isFreshman = (studentId: string) => studentId.startsWith(FRESHMAN_PREFIX);

/** Pull a 13-digit student id out of whatever the scanner/keyboard produced. */
export function normalizeStudentId(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return /^\d{13}$/.test(digits) ? digits : null;
}

/** Faculty that this person really belongs to: inferred from the id prefix, else the form they used. */
export function correctFaculty(rows: StudentRow[]): string {
  return rows.find((r) => r.id_faculty)?.id_faculty ?? rows[0].form_faculty;
}

export function toCandidates(rows: StudentRow[]): Candidate[] {
  return [...rows]
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""))
    .map((r) => ({
      rowId: r.id,
      title: r.title,
      fullName: r.full_name,
      size: r.size,
      formFaculty: r.form_faculty,
      submittedAt: r.submitted_at,
    }));
}

/**
 * Decide what the scan screen shows. Order matters:
 * invalid → not found → not a freshman (id not 69…) → already received → wrong faculty → ok / duplicate warnings.
 */
export function evaluate(
  rawId: string,
  rows: StudentRow[],
  active: ActiveDistribution | null,
  selectedFaculty: string,
  /** Test mode decides "is year 1" per test case instead of by the id prefix. */
  opts: { isFreshman?: (studentId: string) => boolean } = {},
): LookupResult {
  const studentId = normalizeStudentId(rawId);
  if (!studentId) return { result: "invalid", studentId: rawId };
  const mine = rows.filter((r) => r.student_id === studentId);
  if (mine.length === 0) return { result: "not_found", studentId };
  const candidates = toCandidates(mine);
  if (!(opts.isFreshman ?? isFreshman)(studentId)) return { result: "not_freshman", studentId, candidates };
  if (active) return { result: "received", studentId, distribution: active, candidates };
  const faculty = correctFaculty(mine);
  if (faculty !== selectedFaculty) {
    return { result: "wrong_faculty", studentId, correctFaculty: faculty, selectedFaculty, candidates };
  }
  const issue = mine.find((r) => r.issue_type !== "none")?.issue_type ?? "none";
  return { result: issue === "none" ? "ok" : issue, studentId, faculty, candidates };
}

export interface ConfirmInput {
  rowId?: number;
  size?: string;
}

/**
 * Validate a "ยืนยันแจก" request against a fresh evaluate() result.
 * Returns the row and size to store, or an error message (Thai, shown to staff).
 */
export function validateConfirm(
  lookup: LookupResult,
  input: ConfirmInput,
): { ok: true; rowId: number; size: string; faculty: string } | { ok: false; error: string } {
  if (lookup.result === "invalid") return { ok: false, error: "รหัสนักศึกษาไม่ถูกต้อง" };
  if (lookup.result === "not_found") return { ok: false, error: "ไม่มีข้อมูลนี้ในระบบ" };
  if (lookup.result === "not_freshman") return { ok: false, error: "ไม่ใช่นักศึกษาปี 1 (รหัสไม่ได้ขึ้นต้นด้วย 69)" };
  if (lookup.result === "received") return { ok: false, error: "คนนี้รับเสื้อไปแล้ว" };
  if (lookup.result === "wrong_faculty") {
    return { ok: false, error: `ต้องไปรับที่คณะ ${lookup.correctFaculty}` };
  }
  const c = lookup.candidates;
  if (lookup.result === "dup_person") {
    const chosen = c.find((x) => x.rowId === input.rowId);
    if (!chosen) return { ok: false, error: "เลือกก่อนว่าเป็นคนไหน (ดูชื่อจากบัตร)" };
    return { ok: true, rowId: chosen.rowId, size: chosen.size, faculty: lookup.faculty };
  }
  if (lookup.result === "dup_size") {
    const chosen = c.find((x) => x.size === input.size);
    if (!chosen) return { ok: false, error: "ถามน้องก่อนว่าจะเอาไซส์ไหน แล้วเลือกไซส์" };
    return { ok: true, rowId: chosen.rowId, size: chosen.size, faculty: lookup.faculty };
  }
  // ok / dup_same: use the latest response
  const latest = c[c.length - 1];
  return { ok: true, rowId: latest.rowId, size: latest.size, faculty: lookup.faculty };
}

// ---------- used by the import script ----------

function normName(s: string): string {
  return (s ?? "").replace(/[\s\-.]/g, "").toLowerCase();
}

function normPhone(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "").replace(/^66/, "0").replace(/^(?=[689]\d{8}$)/, "0");
}

/** Same person if one name is a prefix of the other OR the phone numbers match. */
export function samePerson(a: { full_name: string; phone?: string | null }, b: { full_name: string; phone?: string | null }) {
  const na = normName(a.full_name);
  const nb = normName(b.full_name);
  if (na && nb && (na.startsWith(nb) || nb.startsWith(na))) return true;
  const pa = normPhone(a.phone);
  return pa.length >= 9 && pa === normPhone(b.phone);
}

/** Classify a group of responses that share one student_id. */
export function classifyGroup(group: { full_name: string; phone?: string | null; size: string }[]): IssueType {
  if (group.length < 2) return "none";
  const first = group[0];
  if (group.some((g) => !samePerson(first, g))) return "dup_person";
  if (new Set(group.map((g) => g.size)).size > 1) return "dup_size";
  return "dup_same";
}
