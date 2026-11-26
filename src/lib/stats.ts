// Turns the raw get_stats() rows into the numbers shown on the overview page. Pure → unit-tested.

export interface StatsRow {
  faculty: string;
  gender: "M" | "F" | "U";
  size: string;
  received: boolean;
  n: number;
}

export interface RawStats {
  rows: StatsRow[];
  given_by_size: { faculty: string; size: string; n: number }[];
  hourly: { hour: string; n: number }[];
  pending_scans: number;
  issues: { issue_type: string; n: number; resolved: number }[];
}

export interface Tally {
  total: number;
  received: number;
  remaining: number;
}

const tally = (rows: StatsRow[]): Tally => {
  const total = rows.reduce((a, r) => a + r.n, 0);
  const received = rows.filter((r) => r.received).reduce((a, r) => a + r.n, 0);
  return { total, received, remaining: total - received };
};

function groupBy(rows: StatsRow[], key: (r: StatsRow) => string, order: string[]) {
  const keys = [...new Set([...order.filter((k) => rows.some((r) => key(r) === k)), ...rows.map(key)])];
  return keys.map((k) => ({ key: k, ...tally(rows.filter((r) => key(r) === k)) }));
}

/** faculty = null → whole university. */
export function summarize(raw: RawStats, faculty: string | null, facultyOrder: string[], sizeOrder: string[]) {
  const rows = faculty ? raw.rows.filter((r) => r.faculty === faculty) : raw.rows;
  const remainingRows = rows.filter((r) => !r.received);
  return {
    all: tally(rows),
    byGender: groupBy(rows, (r) => r.gender, ["M", "F", "U"]),
    bySize: groupBy(rows, (r) => r.size, sizeOrder),
    byFaculty: groupBy(raw.rows, (r) => r.faculty, facultyOrder),
    remainingByGenderSize: groupBy(remainingRows, (r) => `${r.gender}|${r.size}`, []).map((g) => ({
      gender: g.key.split("|")[0],
      size: g.key.split("|")[1],
      n: g.total,
    })),
  };
}

// ---------- "สรุปผล" (copy text / CSV) — counts only, no names ----------

const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmt = (n: number) => n.toLocaleString("en-US");

/** Plain text for pasting into a chat group. */
export function summaryText(raw: RawStats, facultyOrder: string[], sizeOrder: string[], when: string, todayKey: string): string {
  const s = summarize(raw, null, facultyOrder, sizeOrder);
  const today = raw.hourly.filter((h) => h.hour.startsWith(todayKey)).reduce((a, h) => a + h.n, 0);
  const lines = [
    `สรุปผลแจกเสื้อ Freshly69 · ${when}`,
    `ทั้งหมด ${fmt(s.all.total)} คน · แจกแล้ว ${fmt(s.all.received)} (${pctOf(s.all.received, s.all.total)}%) · ยังไม่รับ ${fmt(s.all.remaining)}`,
    `แจกวันนี้ ${fmt(today)} ตัว · สแกนแล้วยังไม่ยืนยัน ${fmt(raw.pending_scans)} คน`,
    "",
    "แยกตามคณะ (แจกแล้ว/ทั้งหมด · เหลือ)",
    ...s.byFaculty.map((f) => `- ${f.key}: ${fmt(f.received)}/${fmt(f.total)} (${pctOf(f.received, f.total)}%) · เหลือ ${fmt(f.remaining)}`),
    "",
    "แยกตามไซส์ (แจกแล้ว/ทั้งหมด · เหลือ)",
    ...s.bySize.map((z) => `- ${z.key}: ${fmt(z.received)}/${fmt(z.total)} · เหลือ ${fmt(z.remaining)}`),
    "",
    `ชาย ${s.byGender.find((g) => g.key === "M")?.received ?? 0}/${s.byGender.find((g) => g.key === "M")?.total ?? 0} · หญิง ${s.byGender.find((g) => g.key === "F")?.received ?? 0}/${s.byGender.find((g) => g.key === "F")?.total ?? 0}`,
  ];
  if (raw.issues.length) {
    const n = raw.issues.reduce((a, i) => a + i.n, 0);
    const r = raw.issues.reduce((a, i) => a + i.resolved, 0);
    lines.push(`รหัสซ้ำ: แก้แล้ว ${r}/${n}`);
  }
  return lines.join("\n");
}

/** CSV: one row per faculty × size with total / received / remaining (opens in Excel / Sheets). */
export function summaryCsv(raw: RawStats, facultyOrder: string[], sizeOrder: string[]): string {
  const rows = [["คณะ", "ไซส์", "ทั้งหมด", "แจกแล้ว", "ยังไม่รับ"]];
  for (const f of facultyOrder) {
    const fr = raw.rows.filter((r) => r.faculty === f);
    for (const z of sizeOrder) {
      const cell = fr.filter((r) => r.size === z);
      const total = cell.reduce((a, r) => a + r.n, 0);
      if (!total) continue;
      const got = cell.filter((r) => r.received).reduce((a, r) => a + r.n, 0);
      rows.push([f, z, String(total), String(got), String(total - got)]);
    }
  }
  const all = summarize(raw, null, facultyOrder, sizeOrder).all;
  rows.push(["รวม", "", String(all.total), String(all.received), String(all.remaining)]);
  return "﻿" + rows.map((r) => r.join(",")).join("\r\n"); // BOM so Excel reads Thai
}
