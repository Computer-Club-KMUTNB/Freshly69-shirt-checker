"use client";

import { useState } from "react";
import { AlertTriangle, Clock, RefreshCw, ScanLine } from "lucide-react";
import Shell from "@/components/Shell";
import { FACULTY_KEYS, ISSUE_LABEL, SIZES } from "@/lib/constants";
import { summarize, type RawStats, type Tally } from "@/lib/stats";
import { useCached } from "@/lib/useCached";

export default function OverviewPage() {
  return (
    <Shell>
      <Overview />
    </Shell>
  );
}

const GENDER: Record<string, string> = { M: "ชาย", F: "หญิง", U: "ไม่ระบุ" };
const pct = (t: Tally) => (t.total ? Math.round((t.received / t.total) * 100) : 0);
const n = (x: number) => x.toLocaleString("th-TH");
const short = (k: string) => (k === "เทคโนโลยีสารสนเทศ" ? "ไอที" : k);

function Ring({ value }: { value: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 110 110" className="h-28 w-28 -rotate-90">
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="11" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="white" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

function Bar({ t }: { t: Tally }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-50">
      <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500" style={{ width: `${pct(t)}%` }} />
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-xs text-muted">
          {head.map((h, i) => <th key={h} className={`pb-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])} className="border-t border-line">
            {r.map((c, i) => (
              <td key={i} className={`py-2 ${i === 0 ? "font-semibold" : "text-right"} ${i === 2 ? "text-emerald-600" : ""} ${i === 3 ? "font-bold text-brand-600" : ""}`}>
                {typeof c === "number" ? n(c) : c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Counts only — staff never sees names or phone numbers here. */
function Overview() {
  const { data: raw, error, loading, reload } = useCached<RawStats>("/api/stats", { persist: true, refreshMs: 30_000 });
  const [faculty, setFaculty] = useState<string | null>(null);

  if (!raw) {
    return (
      <div className="flex flex-col gap-4">
        <div className="skeleton h-10" />
        <div className="skeleton h-40 rounded-[1.75rem]" />
        <div className="grid grid-cols-2 gap-3"><div className="skeleton h-24" /><div className="skeleton h-24" /></div>
        <div className="skeleton h-56" />
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  const s = summarize(raw, faculty, FACULTY_KEYS, SIZES);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const todayHours = raw.hourly.filter((h) => h.hour.startsWith(today));
  const todayTotal = todayHours.reduce((a, h) => a + h.n, 0);
  const maxHour = Math.max(1, ...todayHours.map((h) => h.n));
  const remaining = (g: string, z: string) => s.remainingByGenderSize.find((x) => x.gender === g && x.size === z)?.n ?? 0;
  const sizesWithData = SIZES.filter((z) => remaining("M", z) + remaining("F", z) + remaining("U", z) > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[null, ...FACULTY_KEYS].map((f) => (
          <button key={f ?? "all"} onClick={() => setFaculty(f)} className={`chip ${faculty === f ? "chip-on" : ""}`}>
            {f ? short(f) : "ทุกคณะ"}
          </button>
        ))}
      </div>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-500 to-brand-600 p-5 text-white shadow-[0_20px_40px_-20px_rgb(234_88_12/0.8)]">
        <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-5">
          <div className="relative">
            <Ring value={pct(s.all)} />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="text-2xl font-bold leading-none">{pct(s.all)}%</div>
                <div className="text-[11px] text-white/80">แจกแล้ว</div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-white/80">{faculty ? `คณะ ${faculty}` : "ทุกคณะ"}</div>
            <div className="text-4xl font-bold tabular-nums">{n(s.all.received)}<span className="text-lg font-medium text-white/75"> / {n(s.all.total)}</span></div>
            <div className="mt-1 text-sm">ยังไม่รับ <b className="text-lg">{n(s.all.remaining)}</b> คน</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted"><Clock size={14} /> แจกวันนี้</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{n(todayTotal)}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><ScanLine size={14} /> สแกนแล้วยังไม่ยืนยัน</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-amber-600">{n(raw.pending_scans)}</div>
        </div>
      </div>

      <Section title="ชาย / หญิง">
        <div className="grid grid-cols-2 gap-3">
          {s.byGender.filter((g) => g.key !== "U" || g.total > 0).map((g) => (
            <div key={g.key} className="rounded-2xl bg-brand-50/60 p-3">
              <div className="text-sm font-semibold">{GENDER[g.key] ?? g.key}</div>
              <div className="text-2xl font-bold tabular-nums text-brand-600">{n(g.remaining)}<span className="text-sm font-medium text-muted"> ยังไม่รับ</span></div>
              <div className="mt-1.5"><Bar t={g} /></div>
              <div className="mt-1 text-xs text-muted">แจกแล้ว {n(g.received)} / {n(g.total)}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="แยกตามไซส์">
        <Table head={["ไซส์", "ทั้งหมด", "แจกแล้ว", "ยังไม่รับ"]} rows={s.bySize.map((g) => [g.key, g.total, g.received, g.remaining])} />
      </Section>

      {sizesWithData.length > 0 && (
        <Section title="ยังไม่รับ · เพศ × ไซส์">
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-2 text-left font-semibold">เพศ</th>
                  {sizesWithData.map((z) => <th key={z} className="px-1.5 pb-2 text-right font-semibold">{z}</th>)}
                </tr>
              </thead>
              <tbody>
                {["M", "F"].map((g) => (
                  <tr key={g} className="border-t border-line">
                    <td className="py-2 font-semibold">{GENDER[g]}</td>
                    {sizesWithData.map((z) => <td key={z} className="px-1.5 text-right">{n(remaining(g, z))}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {!faculty && (
        <Section title="แยกตามคณะ">
          <div className="flex flex-col gap-3.5">
            {s.byFaculty.map((f) => (
              <button key={f.key} onClick={() => setFaculty(f.key)} className="text-left">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold">{f.key}</span>
                  <span className="tabular-nums text-muted">{n(f.received)}/{n(f.total)} · เหลือ <b className="text-brand-600">{n(f.remaining)}</b></span>
                </div>
                <Bar t={f} />
              </button>
            ))}
          </div>
        </Section>
      )}

      {todayHours.length > 0 && (
        <Section title="แจกวันนี้ รายชั่วโมง">
          <div className="flex h-32 items-end gap-1.5">
            {todayHours.map((h) => (
              <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-semibold tabular-nums">{h.n}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-300" style={{ height: `${(h.n / maxHour) * 80}px` }} />
                <span className="text-[10px] text-muted">{h.hour.slice(11)}น.</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="รายการที่มีปัญหา" right={<AlertTriangle size={18} className="text-amber-500" />}>
        <div className="flex flex-col gap-2">
          {raw.issues.map((i) => (
            <div key={i.issue_type} className="flex items-center justify-between text-sm">
              <span>{ISSUE_LABEL[i.issue_type] ?? i.issue_type}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${i.resolved === i.n ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                แก้แล้ว {i.resolved}/{i.n}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <button onClick={reload} className="mx-auto flex items-center gap-1.5 text-xs text-muted">
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> อัปเดตอัตโนมัติทุก 30 วินาที · แตะเพื่อรีเฟรช
        {error && <span className="text-red-600"> · {error}</span>}
      </button>
    </div>
  );
}
