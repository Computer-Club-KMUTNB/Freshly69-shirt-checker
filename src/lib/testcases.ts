// Test mode (/test): turn a hand-made test case into the same StudentRow[] the real rules use,
// so the scan popups in test mode behave exactly like the real ones. Pure → unit-tested.
import { FACULTY_KEYS, SIZES } from "./constants";
import type { IssueType, StudentRow } from "./rules";

export type TestProblem = "none" | "dup_same" | "dup_size" | "dup_person" | "received";

export interface TestCase {
  id: number;
  student_id: string;
  title: string | null;
  full_name: string;
  faculty: string;
  size: string;
  year: number;
  problem: TestProblem;
  second_name: string | null;
  second_size: string | null;
  second_faculty: string | null;
  auto?: boolean;
  created_at?: string;
}

/** What each problem means, shown in the editor. */
export const PROBLEMS: { key: TestProblem; label: string; hint: string }[] = [
  { key: "none", label: "ไม่มีปัญหา", hint: "สแกนที่คณะของตัวเอง → แจกได้" },
  { key: "dup_same", label: "กรอกซ้ำ ไซส์ตรง", hint: "มีฟอร์มที่ 2 ในอีกคณะ ไซส์เดียวกัน" },
  { key: "dup_size", label: "กรอกซ้ำ ไซส์ไม่ตรง", hint: "ฟอร์มที่ 2 ไซส์ต่างกัน → ต้องเลือกไซส์" },
  { key: "dup_person", label: "รหัสเดียว 2 คน", hint: "มีอีกคนใช้รหัสนี้ → ต้องเลือกคน" },
  { key: "received", label: "รับไปแล้ว", hint: "สร้างมาพร้อมสถานะแจกแล้ว" },
];

const ISSUE: Record<TestProblem, IssueType> = {
  none: "none",
  received: "none",
  dup_same: "dup_same",
  dup_size: "dup_size",
  dup_person: "dup_person",
};

const otherFaculty = (f: string) => FACULTY_KEYS.find((k) => k !== f) ?? f;
const otherSize = (s: string) => SIZES[(SIZES.indexOf(s) + 1) % SIZES.length] ?? "M";

/** row ids: case.id*10+1 = main response, +2 = second response (dup cases). */
export function caseToRows(c: TestCase): StudentRow[] {
  const created = c.created_at ?? "2026-07-01T00:00:00Z";
  const earlier = new Date(new Date(created).getTime() - 7 * 86_400_000).toISOString();
  const issue = ISSUE[c.problem];
  const main: StudentRow = {
    id: c.id * 10 + 1,
    student_id: c.student_id,
    title: c.title,
    full_name: c.full_name,
    form_faculty: c.faculty,
    id_faculty: c.faculty,
    size: c.size,
    submitted_at: created,
    issue_type: issue,
  };
  if (c.problem === "dup_same" || c.problem === "dup_size" || c.problem === "dup_person") {
    const second: StudentRow = {
      ...main,
      id: c.id * 10 + 2,
      submitted_at: earlier,
      form_faculty: c.second_faculty || (c.problem === "dup_same" ? otherFaculty(c.faculty) : c.faculty),
      size: c.problem === "dup_same" ? c.size : c.second_size || otherSize(c.size),
      full_name: c.problem === "dup_person" ? c.second_name || "บุคคลที่สอง ทดสอบ" : c.full_name,
      title: c.problem === "dup_person" ? null : c.title,
    };
    if (c.problem === "dup_size" && second.size === main.size) second.size = otherSize(main.size);
    return [second, main];
  }
  return [main];
}

// ---------- auto-generated fake data ----------

const FIRST = ["ทดสอบ", "สมมติ", "ตัวอย่าง", "จำลอง", "ลองดู", "ฝึกซ้อม", "เดโม", "ทดลอง"];
const LAST = ["ระบบดี", "แจกเสื้อ", "สแกนได้", "ใจเย็น", "รักชมรม", "คอมคลับ", "ส้มขาว", "เฟรชชี่"];

/** Fake id that can never be a real KMUTNB id: 69 + "99" faculty code + random. */
export function fakeId(rand: () => number = Math.random): string {
  let s = "6999";
  while (s.length < 13) s += Math.floor(rand() * 10);
  return s;
}

/** One case per problem (+ a year-3 and a different-faculty case) with fake people. */
export function autoCases(faculty: string, rand: () => number = Math.random): Omit<TestCase, "id">[] {
  const name = (i: number) => `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
  const base = (i: number, extra: Partial<TestCase>): Omit<TestCase, "id"> => ({
    student_id: fakeId(rand),
    title: i % 2 ? "นางสาว" : "นาย",
    full_name: name(i),
    faculty,
    size: SIZES[i % 6],
    year: 1,
    problem: "none",
    second_name: null,
    second_size: null,
    second_faculty: null,
    auto: true,
    ...extra,
  });
  return [
    base(0, {}),
    base(1, { problem: "received" }),
    base(2, { faculty: otherFaculty(faculty) }), // → wrong faculty when scanned at `faculty`
    base(3, { problem: "dup_same", second_faculty: otherFaculty(faculty) }),
    base(4, { problem: "dup_size", size: "S", second_size: "M" }),
    base(5, { problem: "dup_person", second_name: "อีกคน ใช้รหัสซ้ำ", second_size: "XL" }),
    base(6, { year: 3 }), // → not a freshman
    base(7, { full_name: "ชื่ออย่างเดียว" }), // name without surname
  ];
}
