import { describe, expect, it } from "vitest";
import { dailyPin, hashPin, verifyPin } from "./pin";
import { summarize, type RawStats } from "./stats";
import { isOpen, nextBangkokMidnight } from "./time";

describe("pin", () => {
  it("hash + verify", () => {
    const h = hashPin("123456");
    expect(verifyPin("123456", h)).toBe(true);
    expect(verifyPin("654321", h)).toBe(false);
    expect(verifyPin("123456", null)).toBe(false);
  });
  it("daily pin is 6 digits, stable per day, different across days", () => {
    const a = dailyPin("secret".repeat(8), "2026-12-02");
    expect(a).toMatch(/^\d{6}$/);
    expect(dailyPin("secret".repeat(8), "2026-12-02")).toBe(a);
    expect(dailyPin("secret".repeat(8), "2026-12-03")).not.toBe(a);
  });
});

describe("time (Bangkok)", () => {
  const sched = { enabled: true, days: ["2026-12-02"], start: "16:00", end: "20:00" };
  it("open inside the window", () => expect(isOpen(sched, new Date("2026-12-02T10:30:00Z"))).toBe(true)); // 17:30 BKK
  it("closed before / after / other day", () => {
    expect(isOpen(sched, new Date("2026-12-02T08:59:00Z"))).toBe(false); // 15:59
    expect(isOpen(sched, new Date("2026-12-02T13:00:00Z"))).toBe(false); // 20:00
    expect(isOpen(sched, new Date("2026-12-03T10:30:00Z"))).toBe(false);
  });
  it("disabled schedule = always open", () => expect(isOpen({ ...sched, enabled: false }, new Date("2026-01-01"))).toBe(true));
  it("session ends at the next Bangkok midnight", () => {
    // 2026-12-02 23:30 BKK → expires 2026-12-03 00:00 BKK = 2026-12-02 17:00Z
    expect(nextBangkokMidnight(new Date("2026-12-02T16:30:00Z"))).toBe(Date.UTC(2026, 11, 2, 17) / 1000);
  });
});

describe("stats summarize", () => {
  const raw: RawStats = {
    rows: [
      { faculty: "วทอ", gender: "M", size: "L", received: true, n: 3 },
      { faculty: "วทอ", gender: "F", size: "M", received: false, n: 2 },
      { faculty: "ครุ", gender: "M", size: "L", received: false, n: 5 },
    ],
    given_by_size: [],
    hourly: [],
    pending_scans: 0,
    issues: [],
  };
  it("totals", () => expect(summarize(raw, null, [], []).all).toEqual({ total: 10, received: 3, remaining: 7 }));
  it("faculty filter", () => expect(summarize(raw, "วทอ", [], []).all).toEqual({ total: 5, received: 3, remaining: 2 }));
  it("remaining by gender × size", () =>
    expect(summarize(raw, null, [], []).remainingByGenderSize).toEqual(
      expect.arrayContaining([{ gender: "F", size: "M", n: 2 }, { gender: "M", size: "L", n: 5 }]),
    ));
});

describe("summary (สรุปผล)", () => {
  const raw: RawStats = {
    rows: [
      { faculty: "วทอ", gender: "M", size: "L", received: true, n: 3 },
      { faculty: "วทอ", gender: "F", size: "M", received: false, n: 2 },
      { faculty: "ครุ", gender: "M", size: "L", received: false, n: 5 },
    ],
    given_by_size: [],
    hourly: [{ hour: "2026-12-02 16", n: 3 }],
    pending_scans: 1,
    issues: [{ issue_type: "dup_same", n: 2, resolved: 1 }],
  };
  it("text has totals, today, per faculty and duplicates", async () => {
    const { summaryText } = await import("./stats");
    const t = summaryText(raw, ["วทอ", "ครุ"], ["M", "L"], "02/12 18:00", "2026-12-02");
    expect(t).toContain("ทั้งหมด 10 คน · แจกแล้ว 3 (30%) · ยังไม่รับ 7");
    expect(t).toContain("แจกวันนี้ 3 ตัว");
    expect(t).toContain("- วทอ: 3/5 (60%) · เหลือ 2");
    expect(t).toContain("รหัสซ้ำ: แก้แล้ว 1/2");
  });
  it("csv has a row per faculty×size and a total", async () => {
    const { summaryCsv } = await import("./stats");
    const lines = summaryCsv(raw, ["วทอ", "ครุ"], ["M", "L"]).replace("﻿", "").split("\r\n");
    expect(lines).toContain("วทอ,L,3,3,0");
    expect(lines).toContain("ครุ,L,5,0,5");
    expect(lines[lines.length - 1]).toBe("รวม,,10,3,7");
  });
});
