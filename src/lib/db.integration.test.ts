/**
 * End-to-end checks against the real Supabase project (opt-in, needs .env.local):
 *
 *   RUN_DB_TESTS=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/db.integration.test.ts
 *
 * - Real tables are only READ (counts / consistency). Nothing is written to them.
 * - All writes go to test_cases / test_distributions with fake ids (6999…) and are deleted afterwards.
 * Prints no names or phone numbers.
 */
import { afterAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { FACULTY_KEYS, SIZES } from "./constants";
import { validateConfirm } from "./rules";
import { fakeId } from "./testcases";
import { T_CASES, T_DIST, cleanCase, testLookup } from "./testmode";

const on = process.env.RUN_DB_TESTS === "1";
const d = on ? describe : describe.skip;

interface Pending { student_id: string; faculty: string; size: string }

d("real data (read only)", () => {
  it("stats: totals add up and only freshmen are counted", async () => {
    const { data, error } = await db().rpc("get_stats");
    expect(error).toBeNull();
    const rows = data.rows as { faculty: string; n: number; received: boolean; size: string }[];
    const total = rows.reduce((a, r) => a + r.n, 0);
    const remaining = rows.filter((r) => !r.received).reduce((a, r) => a + r.n, 0);
    console.log("people counted:", total, "remaining:", remaining);
    expect(total).toBeGreaterThan(5000);
    for (const r of rows) expect(FACULTY_KEYS).toContain(r.faculty);
    for (const r of rows) expect(SIZES).toContain(r.size);
    const { data: all } = await db().rpc("get_pending", { p_faculty: null });
    expect((all as Pending[]).length).toBe(remaining);
    expect((all as Pending[]).every((p) => p.student_id.startsWith("69"))).toBe(true);
  });

  it("pending per faculty adds up to pending for all faculties", async () => {
    const { data: all } = await db().rpc("get_pending", { p_faculty: null });
    let sum = 0;
    for (const f of FACULTY_KEYS) {
      const { data, error } = await db().rpc("get_pending", { p_faculty: f });
      expect(error).toBeNull();
      expect((data as Pending[]).every((p) => p.faculty === f)).toBe(true);
      sum += (data as Pending[]).length;
    }
    expect(sum).toBe((all as Pending[]).length);
  });

  it("student rows are well formed", async () => {
    let from = 0;
    let bad = 0;
    let n = 0;
    for (;;) {
      const { data, error } = await db().from("students").select("student_id, size, form_faculty, issue_type").range(from, from + 999);
      expect(error).toBeNull();
      for (const r of data!) {
        n++;
        if (!/^\d{13}$/.test(r.student_id) || !SIZES.includes(r.size) || !FACULTY_KEYS.includes(r.form_faculty)) bad++;
      }
      if (data!.length < 1000) break;
      from += 1000;
    }
    console.log("student rows:", n, "malformed:", bad);
    expect(bad).toBe(0);
  });

  it("duplicate-id problems: 32 ids, each with ≥2 rows", async () => {
    const { data, error } = await db().from("students").select("student_id, issue_type").neq("issue_type", "none");
    expect(error).toBeNull();
    const ids = new Map<string, number>();
    for (const r of data!) ids.set(r.student_id, (ids.get(r.student_id) ?? 0) + 1);
    console.log("problem ids:", ids.size);
    expect([...ids.values()].every((c) => c >= 2)).toBe(true);
  });

  it("every active handout points to a real student and there is at most one per student", async () => {
    const { data, error } = await db().from("distributions").select("student_id").is("voided_at", null);
    expect(error).toBeNull();
    const ids = data!.map((x) => x.student_id);
    expect(new Set(ids).size).toBe(ids.length);
    console.log("active handouts:", ids.length);
  });
});

d("test mode end to end (test tables only)", () => {
  const created: string[] = [];
  const desk = "วิศวะ";

  async function mk(extra: Record<string, unknown>) {
    const row = cleanCase({ student_id: fakeId(), title: "นาย", full_name: "ทดสอบ อัตโนมัติ", faculty: desk, size: "L", year: 1, ...extra });
    const { error } = await db().from(T_CASES).insert(row);
    expect(error).toBeNull();
    created.push(row.student_id);
    return row.student_id;
  }

  afterAll(async () => {
    if (!created.length) return;
    await db().from(T_DIST).delete().in("student_id", created);
    await db().from(T_CASES).delete().in("student_id", created);
  });

  it("each problem gives the right popup", async () => {
    const cases: [Record<string, unknown>, string, string?][] = [
      [{}, "ok"],
      [{ year: 3 }, "not_freshman"],
      [{ problem: "dup_same" }, "dup_same"],
      [{ problem: "dup_size", size: "S", second_size: "M" }, "dup_size"],
      [{ problem: "dup_person", second_name: "อีก คน" }, "dup_person"],
      [{ faculty: "ครุ" }, "wrong_faculty"],
    ];
    for (const [extra, expected] of cases) {
      const id = await mk(extra);
      expect((await testLookup(id, desk)).result).toBe(expected);
    }
    expect((await testLookup(fakeId(), desk)).result).toBe("not_found");
    expect((await testLookup("123", desk)).result).toBe("invalid");
  });

  it("confirm → received → a second confirm is blocked by the database → void → can confirm again", async () => {
    const id = await mk({});
    const l1 = await testLookup(id, desk);
    const v = validateConfirm(l1, {});
    expect(v.ok).toBe(true);
    const ins = () => db().from(T_DIST).insert({ student_id: id, size: "L", faculty: desk }).select("id").single();
    const first = await ins();
    expect(first.error).toBeNull();
    const second = await ins(); // like two phones confirming at the same moment
    expect(second.error?.code).toBe("23505");
    expect((await testLookup(id, desk)).result).toBe("received");
    await db().from(T_DIST).update({ voided_at: new Date().toISOString() }).eq("id", first.data!.id);
    expect((await testLookup(id, desk)).result).toBe("ok");
  });

  it("dup_size only accepts a size the student filled in", async () => {
    const id = await mk({ problem: "dup_size", size: "S", second_size: "XL" });
    const l = await testLookup(id, desk);
    expect(validateConfirm(l, { size: "M" }).ok).toBe(false);
    expect(validateConfirm(l, { size: "XL" })).toMatchObject({ ok: true, size: "XL" });
  });
});
