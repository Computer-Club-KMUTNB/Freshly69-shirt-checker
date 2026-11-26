import { describe, expect, it } from "vitest";
import { evaluate, validateConfirm } from "./rules";
import { autoCases, caseToRows, fakeId, type TestCase } from "./testcases";

const CARD = "6701000000001"; // a fake year-3 style id
const tc = (o: Partial<TestCase> = {}): TestCase => ({
  id: 7,
  student_id: CARD,
  title: "นาย",
  full_name: "ทดสอบ ระบบ",
  faculty: "วิศวะ",
  size: "L",
  year: 1,
  problem: "none",
  second_name: null,
  second_size: null,
  second_faculty: null,
  created_at: "2026-07-10T00:00:00Z",
  ...o,
});
const run = (c: TestCase, desk = c.faculty) => evaluate(c.student_id, caseToRows(c), null, desk, { isFreshman: () => c.year === 1 });

describe("test cases behave like the real rules", () => {
  it("a year-3 card set to year 1 is accepted", () => expect(run(tc()).result).toBe("ok"));
  it("the same card set to year 3 is blocked", () => expect(run(tc({ year: 3 })).result).toBe("not_freshman"));
  it("wrong desk", () => expect(run(tc(), "ครุ").result).toBe("wrong_faculty"));
  it("dup_same: second form in another faculty, same size", () => {
    const r = run(tc({ problem: "dup_same" }));
    expect(r.result).toBe("dup_same");
    if ("candidates" in r) {
      expect(r.candidates).toHaveLength(2);
      expect(new Set(r.candidates.map((c) => c.size)).size).toBe(1);
      expect(r.candidates[0].formFaculty).not.toBe("วิศวะ");
    }
  });
  it("dup_size: needs a size choice", () => {
    const r = run(tc({ problem: "dup_size", size: "S", second_size: "M" }));
    expect(r.result).toBe("dup_size");
    expect(validateConfirm(r, {}).ok).toBe(false);
    expect(validateConfirm(r, { size: "M" })).toMatchObject({ ok: true, size: "M" });
  });
  it("dup_size never ends up with equal sizes", () => {
    const rows = caseToRows(tc({ problem: "dup_size", size: "L", second_size: "L" }));
    expect(rows[0].size).not.toBe(rows[1].size);
  });
  it("dup_person: two names, pick one", () => {
    const r = run(tc({ problem: "dup_person", second_name: "อีก คน" }));
    expect(r.result).toBe("dup_person");
    if ("candidates" in r) expect(r.candidates.map((c) => c.fullName)).toContain("อีก คน");
  });
});

describe("auto-generated cases", () => {
  it("fake ids are 13 digits and start with 6999 (never a real faculty)", () => {
    for (let i = 0; i < 20; i++) expect(fakeId()).toMatch(/^6999\d{9}$/);
  });
  it("cover every problem, a wrong-faculty and a non-freshman case", () => {
    const cs = autoCases("วิศวะ");
    const probs = new Set(cs.map((c) => c.problem));
    for (const p of ["none", "received", "dup_same", "dup_size", "dup_person"]) expect(probs.has(p as never)).toBe(true);
    expect(cs.some((c) => c.faculty !== "วิศวะ")).toBe(true);
    expect(cs.some((c) => c.year !== 1)).toBe(true);
    expect(new Set(cs.map((c) => c.student_id)).size).toBe(cs.length);
  });
});
