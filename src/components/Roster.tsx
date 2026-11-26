"use client";

import { useState } from "react";
import { Phone, Search } from "lucide-react";
import FacultyPicker from "@/components/FacultyPicker";
import { ISSUE_LABEL } from "@/lib/constants";
import { save, store } from "@/lib/client";
import { fmtDateTime } from "@/lib/time";
import { useCached } from "@/lib/useCached";

/**
 * "รายชื่อ" page (staff + admin): ยังไม่รับ · แจกล่าสุด · ปัญหา, all with a faculty popup and a search box.
 * Names / phones are kept in memory only (useCached without persist).
 */
const TABS = [
  { key: "pending", label: "ยังไม่รับ" },
  { key: "recent", label: "แจกล่าสุด" },
  { key: "issues", label: "ปัญหา" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const tel = (p: string | null) => (p ?? "").replace(/[^\d+]/g, "");
const matches = (q: string, ...xs: (string | null | undefined)[]) => !q || xs.some((x) => (x ?? "").toLowerCase().includes(q.toLowerCase()));
const MAX_ROWS = 300; // "ทุกคณะ" can be thousands of people — render the first 300, search narrows it down

export default function Roster() {
  const [tab, setTabState] = useState<Tab>(() => (typeof window === "undefined" ? "pending" : store<Tab>("f69_roster_tab", "pending")));
  const [faculty, setFacultyState] = useState(() => (typeof window === "undefined" ? "" : store("f69_roster_faculty", "")));
  const [q, setQ] = useState("");
  const setTab = (t: Tab) => {
    setTabState(t);
    save("f69_roster_tab", t);
  };
  const setFaculty = (f: string) => {
    setFacultyState(f);
    save("f69_roster_faculty", f);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-white p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-xl py-2 text-sm font-semibold transition ${tab === t.key ? "bg-brand-600 text-white shadow" : "text-muted"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">🔒 ข้อมูลส่วนบุคคล — ใช้ติดตามน้องเท่านั้น ห้ามแคปหรือส่งต่อ</p>
      <FacultyPicker value={faculty} onChange={setFaculty} />
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-11" placeholder="ค้นหาชื่อ / รหัส / เบอร์" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {tab === "pending" && <Pending faculty={faculty} q={q} />}
      {tab === "recent" && <Recent faculty={faculty} q={q} />}
      {tab === "issues" && <Issues faculty={faculty} q={q} />}
    </div>
  );
}

function Loading({ error }: { error: string }) {
  if (error) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  return <>{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</>;
}

const Count = ({ shown, total, unit }: { shown: number; total: number; unit: string }) => (
  <div className="px-1 text-sm text-muted">
    {total.toLocaleString()} {unit}
    {shown < total && ` · แสดง ${shown} รายการแรก — พิมพ์ค้นหาเพื่อหาคนที่ต้องการ`}
  </div>
);

// ---------- ยังไม่รับ ----------
interface PendingRow { student_id: string; title: string | null; full_name: string; faculty: string; size: string; phone: string | null; issue_type: string }

function Pending({ faculty, q }: { faculty: string; q: string }) {
  const { data, error } = useCached<PendingRow[]>(`/api/roster/pending?faculty=${encodeURIComponent(faculty)}`, { refreshMs: 60_000 });
  if (!data) return <Loading error={error} />;
  const rows = data.filter((r) => matches(q, r.full_name, r.student_id, r.phone));
  return (
    <>
      <Count shown={Math.min(rows.length, MAX_ROWS)} total={rows.length} unit="คนยังไม่รับ" />
      {rows.slice(0, MAX_ROWS).map((r) => (
        <div key={r.student_id} className="card flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{r.title}{r.full_name}</div>
            <div className="font-mono text-xs text-muted">
              {r.student_id} · ไซส์ {r.size}{!faculty && ` · ${r.faculty}`}
              {r.issue_type !== "none" ? ` · ⚠️ ${ISSUE_LABEL[r.issue_type]}` : ""}
            </div>
          </div>
          {r.phone ? (
            <a href={`tel:${tel(r.phone)}`} className="btn btn-soft shrink-0 px-3 py-2 text-sm"><Phone size={15} /> {r.phone}</a>
          ) : (
            <span className="text-xs text-muted">ไม่มีเบอร์</span>
          )}
        </div>
      ))}
    </>
  );
}

// ---------- แจกล่าสุด ----------
interface RecentRow { id: number; student_id: string; size: string; faculty: string; device_name: string | null; created_at: string; voided_at: string | null; students: { title: string | null; full_name: string } | null }

function Recent({ faculty, q }: { faculty: string; q: string }) {
  const { data, error } = useCached<RecentRow[]>(`/api/roster/recent?faculty=${encodeURIComponent(faculty)}`, { refreshMs: 15_000 });
  if (!data) return <Loading error={error} />;
  const rows = data.filter((r) => matches(q, r.students?.full_name, r.student_id, r.device_name));
  return (
    <>
      <div className="px-1 text-sm text-muted">ล่าสุด {rows.length} รายการ (สูงสุด 100) · อัปเดตทุก 15 วินาที</div>
      {rows.map((r) => (
        <div key={r.id} className={`card py-3 text-sm ${r.voided_at ? "opacity-50" : ""}`}>
          <div className="flex justify-between gap-2">
            <b className={r.voided_at ? "line-through" : ""}>{r.students?.title}{r.students?.full_name}</b>
            <span className="font-bold">{r.size}</span>
          </div>
          <div className="text-xs text-muted">
            {r.student_id} · {r.faculty} · {fmtDateTime(r.created_at)} · {r.device_name ?? "-"}
            {r.voided_at ? " · ยกเลิกแล้ว" : ""}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- ปัญหา (รหัสซ้ำ) ----------
interface IssueGroup {
  studentId: string;
  issueType: string;
  rows: { id: number; title: string | null; full_name: string; form_faculty: string; id_faculty: string | null; size: string; phone: string | null; submitted_at: string }[];
  distribution: { size: string; faculty: string; device_name: string | null; created_at: string; student_row_id: number } | null;
}

function Issues({ faculty, q }: { faculty: string; q: string }) {
  const { data, error } = useCached<IssueGroup[]>("/api/roster/issues");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  if (!data) return <Loading error={error} />;
  const groups = data.filter(
    (g) =>
      (filter === "all" || (filter === "done") === !!g.distribution) &&
      (!faculty || g.rows.some((r) => (r.id_faculty ?? r.form_faculty) === faculty || r.form_faculty === faculty)) &&
      (!q || g.rows.some((r) => matches(q, r.full_name, g.studentId, r.phone))),
  );
  return (
    <>
      <div className="flex gap-2">
        {(["open", "done", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "chip-on" : ""}`}>
            {{ open: "ยังไม่แก้", done: "แก้แล้ว", all: "ทั้งหมด" }[f]}
          </button>
        ))}
      </div>
      <p className="px-1 text-sm text-muted">&ldquo;แก้แล้ว&rdquo; = แจกเสื้อผ่านหน้าสแกนแล้ว ระบบติ๊กให้อัตโนมัติ ({groups.length} รายการ)</p>
      {groups.map((g) => (
        <div key={g.studentId} className="card flex flex-col gap-2">
          <div className="flex justify-between gap-2">
            <span className="font-mono">{g.studentId}</span>
            <span className="text-sm">{g.distribution ? "✅ แก้แล้ว" : "⏳ ยังไม่แก้"} · {ISSUE_LABEL[g.issueType]}</span>
          </div>
          {g.rows.map((r) => (
            <div key={r.id} className={`rounded-lg p-2 text-sm ${g.distribution?.student_row_id === r.id ? "bg-emerald-50" : "bg-brand-50/50"}`}>
              <b>{r.title}{r.full_name}</b> · ไซส์ <b>{r.size}</b> · ฟอร์ม {r.form_faculty} · {fmtDateTime(r.submitted_at)}
              {r.phone && (
                <> · <a className="font-semibold text-brand-700 underline" href={`tel:${tel(r.phone)}`}>{r.phone}</a></>
              )}
            </div>
          ))}
          {g.distribution && (
            <div className="text-xs text-muted">
              แจกไซส์ {g.distribution.size} ที่คณะ {g.distribution.faculty} เมื่อ {fmtDateTime(g.distribution.created_at)}
              {g.distribution.device_name ? ` โดย ${g.distribution.device_name}` : ""}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
