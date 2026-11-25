"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const thaiShort = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}. ${y + 543 - 2500}`;
};

/** Calendar where you tap days on/off. Value = sorted YYYY-MM-DD strings (Bangkok calendar days). */
export default function DateMultiPicker({ value, onChange }: { value: string[]; onChange: (days: string[]) => void }) {
  const first = value[0] ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const [ym, setYm] = useState(() => {
    const [y, m] = first.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const selected = new Set(value);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

  const startDow = new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const move = (delta: number) =>
    setYm(({ y, m }) => {
      const n = m + delta;
      return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
    });

  function toggle(day: string) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange([...next].sort());
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="grid h-9 w-9 place-items-center rounded-full text-muted active:bg-brand-50" aria-label="เดือนก่อน">
          <ChevronLeft size={20} />
        </button>
        <div className="font-bold">
          {MONTHS[ym.m]} {ym.y + 543}
        </div>
        <button type="button" onClick={() => move(1)} className="grid h-9 w-9 place-items-center rounded-full text-muted active:bg-brand-50" aria-label="เดือนถัดไป">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d) => (
          <div key={d} className="py-1 text-xs font-semibold text-muted">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <div key={`e${i}`} />;
          const key = iso(ym.y, ym.m, d);
          const on = selected.has(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => toggle(key)}
              className={`aspect-square rounded-xl text-sm font-semibold transition active:scale-90 ${
                on ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-200" : key === today ? "text-brand-600 ring-1 ring-brand-300" : "text-ink hover:bg-brand-50"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-muted">แตะวันที่ในปฏิทินเพื่อเลือก (เลือกได้หลายวัน)</span>}
        {value.map((d) => (
          <span key={d} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-brand-700">
            {thaiShort(d)}
            <button type="button" onClick={() => toggle(d)} className="grid h-5 w-5 place-items-center rounded-full hover:bg-brand-100" aria-label={`ลบ ${d}`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
