"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { FACULTY_KEYS, ISSUE_LABEL, SIZES } from "@/lib/constants";
import { api } from "@/lib/client";
import { summarize, type RawStats, type Tally } from "@/lib/stats";

export default function OverviewPage() {
  return (
    <Shell>
      <Overview />
    </Shell>
  );
}

const GENDER: Record<string, string> = { M: "ชาย", F: "หญิง", U: "ไม่ระบุ" };
const pct = (t: Tally) => (t.total ? Math.round((t.received / t.total) * 100) : 0);

function Bar({ t }: { t: Tally }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
      <div className="h-full bg-green-500" style={{ width: `${pct(t)}%` }} />
    </div>
  );
}

function Big({ label, value, tone = "" }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="card text-center">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-3xl font-bold ${tone}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

/** Counts only — staff never sees names or phone numbers here. */
function Overview() {
  const [raw, setRaw] = useState<RawStats | null>(null);
  const [faculty, setFaculty] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    api<RawStats>("/api/stats")
      .then((d) => {
        setRaw(d);
        setUpdated(new Date());
        setError("");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (!raw) return <p className="text-gray-500">{error || "กำลังโหลด..."}</p>;
  const s = summarize(raw, faculty, FACULTY_KEYS, SIZES);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const todayHours = raw.hourly.filter((h) => h.hour.startsWith(today));
  const todayTotal = todayHours.reduce((a, h) => a + h.n, 0);
  const maxHour = Math.max(1, ...todayHours.map((h) => h.n));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[null, ...FACULTY_KEYS].map((f) => (
          <button key={f ?? "all"} onClick={() => setFaculty(f)} className={`btn shrink-0 px-3 py-1.5 text-sm ${faculty === f ? "bg-orange-600 text-white" : "btn-ghost"}`}>
            {f ?? "ทุกคณะ"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Big label="ทั้งหมด" value={s.all.total} />
        <Big label="แจกแล้ว" value={s.all.received} tone="text-green-600" />
        <Big label="ยังไม่รับ" value={s.all.remaining} tone="text-orange-600" />
      </div>
      <div className="card">
        <div className="mb-1 flex justify-between text-sm"><span>ความคืบหน้า</span><b>{pct(s.all)}%</b></div>
        <Bar t={s.all} />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>แจกวันนี้ <b>{todayTotal.toLocaleString()}</b> ตัว</div>
          <div className="text-amber-700">สแกนแล้วยังไม่ยืนยัน <b>{raw.pending_scans}</b> คน</div>
        </div>
      </div>

      <section className="card">
        <h3 className="mb-2 font-semibold">ชาย / หญิง</h3>
        <table className="w-full text-sm">
          <thead className="text-gray-500"><tr><th className="text-left">เพศ</th><th className="text-right">ทั้งหมด</th><th className="text-right">แจกแล้ว</th><th className="text-right">ยังไม่รับ</th></tr></thead>
          <tbody>
            {s.byGender.map((g) => (
              <tr key={g.key} className="border-t"><td className="py-1.5">{GENDER[g.key] ?? g.key}</td><td className="text-right">{g.total}</td><td className="text-right text-green-700">{g.received}</td><td className="text-right font-semibold text-orange-700">{g.remaining}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3 className="mb-2 font-semibold">แยกตามไซส์ {faculty ? `(คณะ ${faculty})` : ""}</h3>
        <table className="w-full text-sm">
          <thead className="text-gray-500"><tr><th className="text-left">ไซส์</th><th className="text-right">ทั้งหมด</th><th className="text-right">แจกแล้ว</th><th className="text-right">ยังไม่รับ</th></tr></thead>
          <tbody>
            {s.bySize.map((g) => (
              <tr key={g.key} className="border-t"><td className="py-1.5 font-semibold">{g.key}</td><td className="text-right">{g.total}</td><td className="text-right text-green-700">{g.received}</td><td className="text-right font-semibold text-orange-700">{g.remaining}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3 className="mb-2 font-semibold">ยังไม่รับ แยกเพศ × ไซส์</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500"><tr><th className="text-left">เพศ</th>{SIZES.map((z) => <th key={z} className="px-1 text-right">{z}</th>)}</tr></thead>
            <tbody>
              {["M", "F"].map((g) => (
                <tr key={g} className="border-t">
                  <td className="py-1.5">{GENDER[g]}</td>
                  {SIZES.map((z) => <td key={z} className="px-1 text-right">{s.remainingByGenderSize.find((x) => x.gender === g && x.size === z)?.n ?? 0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!faculty && (
        <section className="card">
          <h3 className="mb-2 font-semibold">แยกตามคณะ</h3>
          <div className="flex flex-col gap-3">
            {s.byFaculty.map((f) => (
              <button key={f.key} onClick={() => setFaculty(f.key)} className="text-left">
                <div className="flex justify-between text-sm"><span className="font-semibold">{f.key}</span><span>{f.received}/{f.total} · เหลือ <b className="text-orange-700">{f.remaining}</b></span></div>
                <Bar t={f} />
              </button>
            ))}
          </div>
        </section>
      )}

      {todayHours.length > 0 && (
        <section className="card">
          <h3 className="mb-2 font-semibold">แจกวันนี้ รายชั่วโมง</h3>
          <div className="flex flex-col gap-1 text-sm">
            {todayHours.map((h) => (
              <div key={h.hour} className="flex items-center gap-2">
                <span className="w-12">{h.hour.slice(11)}:00</span>
                <div className="h-3 rounded bg-orange-400" style={{ width: `${(h.n / maxHour) * 70}%` }} />
                <span>{h.n}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h3 className="mb-2 font-semibold">รายการที่มีปัญหา (รหัสซ้ำ)</h3>
        {raw.issues.map((i) => (
          <div key={i.issue_type} className="flex justify-between border-t py-1.5 text-sm">
            <span>{ISSUE_LABEL[i.issue_type] ?? i.issue_type}</span>
            <span>แก้แล้ว {i.resolved}/{i.n}</span>
          </div>
        ))}
      </section>

      <p className="text-center text-xs text-gray-400">
        อัปเดตอัตโนมัติทุก 30 วินาที {updated && `· ล่าสุด ${updated.toLocaleTimeString("th-TH")}`} {error && `· ${error}`}
      </p>
    </div>
  );
}
