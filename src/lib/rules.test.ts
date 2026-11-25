// Fake people only — never put real student data in tests (the repo is public).
import { describe, expect, it } from "vitest";
import { classifyGroup, evaluate, normalizeStudentId, validateConfirm, type ActiveDistribution, type StudentRow } from "./rules";

const ID = "6903000000001";
const row = (o: Partial<StudentRow> = {}): StudentRow => ({
  id: 1,
  student_id: ID,
  title: "นาย",
  full_name: "ทดสอบ ระบบ",
  form_faculty: "วทอ",
  id_faculty: "วทอ",
  size: "L",
  submitted_at: "2026-06-27T10:00:00Z",
  issue_type: "none",
  ...o,
});
const given: ActiveDistribution = { id: 9, size: "L", faculty: "วทอ", device_name: "โต๊ะ 1", device_id: "D-1", created_at: "2026-12-02T10:00:00Z" };

describe("normalizeStudentId", () => {
  it("accepts 13 digits with junk around them", () => {
    expect(normalizeStudentId(" 6903-0000-00001 ")).toBe(ID);
  });
  it("rejects wrong length", () => {
    expect(normalizeStudentId("690300000000")).toBeNull();
    expect(normalizeStudentId("")).toBeNull();
  });
});

describe("evaluate (popup shown after scan)", () => {
  it("invalid input", () => expect(evaluate("123", [], null, "วทอ").result).toBe("invalid"));
  it("not found", () => expect(evaluate(ID, [], null, "วทอ").result).toBe("not_found"));
  it("already received wins over everything", () => expect(evaluate(ID, [row()], given, "วิศวะ").result).toBe("received"));
  it("wrong faculty is blocked and names the right one", () => {
    const r = evaluate(ID, [row()], null, "วิศวะ");
    expect(r.result).toBe("wrong_faculty");
    if (r.result === "wrong_faculty") expect(r.correctFaculty).toBe("วทอ");
  });
  it("falls back to the form faculty when the id prefix is unknown", () => {
    expect(evaluate(ID, [row({ id_faculty: null, form_faculty: "ครุ" })], null, "ครุ").result).toBe("ok");
  });
  it("ok", () => expect(evaluate(ID, [row()], null, "วทอ").result).toBe("ok"));
  it("duplicate in two forms uses the id faculty, not the form", () => {
    const rows = [row({ id: 1, form_faculty: "วิศวะ", issue_type: "dup_same" }), row({ id: 2, form_faculty: "วทอ", issue_type: "dup_same" })];
    expect(evaluate(ID, rows, null, "วทอ").result).toBe("dup_same");
    expect(evaluate(ID, rows, null, "วิศวะ").result).toBe("wrong_faculty");
  });
  it("candidates are sorted oldest first", () => {
    const rows = [row({ id: 2, size: "M", submitted_at: "2026-09-16T00:00:00Z", issue_type: "dup_size" }), row({ id: 1, size: "S", submitted_at: "2026-07-08T00:00:00Z", issue_type: "dup_size" })];
    const r = evaluate(ID, rows, null, "วทอ");
    expect(r.result).toBe("dup_size");
    if ("candidates" in r) expect(r.candidates.map((c) => c.size)).toEqual(["S", "M"]);
  });
});

describe("validateConfirm (server re-check of ยืนยันแจก)", () => {
  it("ok → latest response", () => {
    const v = validateConfirm(evaluate(ID, [row()], null, "วทอ"), {});
    expect(v).toMatchObject({ ok: true, rowId: 1, size: "L" });
  });
  it("refuses received / wrong faculty / not found", () => {
    expect(validateConfirm(evaluate(ID, [row()], given, "วทอ"), {}).ok).toBe(false);
    expect(validateConfirm(evaluate(ID, [row()], null, "ครุ"), {}).ok).toBe(false);
    expect(validateConfirm(evaluate(ID, [], null, "วทอ"), {}).ok).toBe(false);
  });
  it("dup_size needs a size that the student actually filled in", () => {
    const rows = [row({ id: 1, size: "S", issue_type: "dup_size" }), row({ id: 2, size: "M", issue_type: "dup_size" })];
    const l = evaluate(ID, rows, null, "วทอ");
    expect(validateConfirm(l, {}).ok).toBe(false);
    expect(validateConfirm(l, { size: "XL" }).ok).toBe(false);
    expect(validateConfirm(l, { size: "S" })).toMatchObject({ ok: true, rowId: 1, size: "S" });
  });
  it("dup_person needs the chosen person", () => {
    const rows = [row({ id: 1, full_name: "คนแรก หนึ่ง", issue_type: "dup_person" }), row({ id: 2, full_name: "คนที่สอง สอง", size: "M", issue_type: "dup_person" })];
    const l = evaluate(ID, rows, null, "วทอ");
    expect(validateConfirm(l, {}).ok).toBe(false);
    expect(validateConfirm(l, { rowId: 2 })).toMatchObject({ ok: true, rowId: 2, size: "M" });
  });
});

describe("classifyGroup (import)", () => {
  const p = (full_name: string, size = "L", phone = "0811111111") => ({ full_name, size, phone });
  it("single row", () => expect(classifyGroup([p("ก ข")])).toBe("none"));
  it("same name same size", () => expect(classifyGroup([p("สมชาย ใจดี"), p("สมชาย  ใจดี")])).toBe("dup_same"));
  it("same person, missing surname once", () => expect(classifyGroup([p("สมชาย"), p("สมชาย ใจดี")])).toBe("dup_same"));
  it("same person different sizes", () => expect(classifyGroup([p("สมชาย ใจดี", "S"), p("สมชาย ใจดี", "M")])).toBe("dup_size"));
  it("English vs Thai name but same phone = same person", () => expect(classifyGroup([p("Somchai Jaidee"), p("สมชาย ใจดี")])).toBe("dup_same"));
  it("different names and phones = two people", () => expect(classifyGroup([p("สมชาย ใจดี", "L", "0811111111"), p("สมหญิง รักดี", "M", "0822222222")])).toBe("dup_person"));
});
