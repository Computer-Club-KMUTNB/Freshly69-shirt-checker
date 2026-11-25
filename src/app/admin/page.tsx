"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { ACTION_LABEL, FACULTIES, FACULTY_KEYS, ISSUE_LABEL, RESET_WORD } from "@/lib/constants";
import { api } from "@/lib/client";
import { useCached } from "@/lib/useCached";
import { AlertTriangle, Copy, Dices, RotateCcw } from "lucide-react";
import DateMultiPicker from "@/components/DateMultiPicker";
import { fmtDateTime } from "@/lib/time";

const TABS = [
  { key: "pending", label: "ยังไม่รับ" },
  { key: "issues", label: "ปัญหา" },
  { key: "recent", label: "แจกล่าสุด" },
  { key: "logs", label: "Log" },
  { key: "devices", label: "เครื่อง" },
  { key: "settings", label: "ตั้งค่า" },
] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  return (
    <Shell adminOnly>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`chip ${tab === t.key ? "chip-on" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "pending" && <Pending />}
      {tab === "issues" && <Issues />}
      {tab === "recent" && <Recent />}
      {tab === "logs" && <Logs />}
      {tab === "devices" && <Devices />}
      {tab === "settings" && <SettingsTab />}
    </Shell>
  );
}

/** In-memory stale-while-revalidate (names/phones are never written to storage). */
function useLoad<T>(url: string | null) {
  const { data, error, reload, setData, loading } = useCached<T>(url);
  return { data: data ?? null, error, reload, setData: (d: T) => setData(d), loading };
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}
    </div>
  );
}

const Err = ({ e }: { e: string }) => (e ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{e}</p> : null);

// ---------- not received yet (names + phones, admin only) ----------
interface PendingRow { student_id: string; title: string | null; full_name: string; faculty: string; size: string; phone: string | null; issue_type: string }

function Pending() {
  const [faculty, setFaculty] = useState(FACULTY_KEYS[0]);
  const [q, setQ] = useState("");
  const { data, error } = useLoad<PendingRow[]>(`/api/admin/pending?faculty=${encodeURIComponent(faculty)}`);
  const rows = (data ?? []).filter((r) => !q || r.full_name.includes(q) || r.student_id.includes(q) || (r.phone ?? "").includes(q));
  const tel = (p: string | null) => (p ?? "").replace(/[^\d+]/g, "");
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">🔒 ข้อมูลส่วนบุคคล — ใช้ติดตามน้องเท่านั้น ห้ามแคปหรือส่งต่อ (ทุกการเปิดหน้านี้ถูกบันทึก)</p>
      <div>
        <div className="mb-2 px-1 text-sm font-semibold">เลือกคณะ</div>
        <div className="grid grid-cols-3 gap-2">
          {FACULTIES.map((f) => (
            <button key={f.key} onClick={() => setFaculty(f.key)} className={`chip py-2.5 ${faculty === f.key ? "chip-on" : ""}`} title={f.label}>
              {f.key === "เทคโนโลยีสารสนเทศ" ? "ไอที" : f.key}
            </button>
          ))}
        </div>
        <div className="mt-2 px-1 text-xs text-muted">{FACULTIES.find((f) => f.key === faculty)?.label}</div>
      </div>
      <input className="input" placeholder="ค้นหาชื่อ / รหัส / เบอร์" value={q} onChange={(e) => setQ(e.target.value)} />
      <Err e={error} />
      {!data && !error && <ListSkeleton />}
      <div className="text-sm text-muted">ยังไม่รับ {rows.length.toLocaleString()} คน</div>
      {rows.map((r) => (
        <div key={r.student_id} className="card flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{r.title}{r.full_name}</div>
            <div className="font-mono text-xs text-muted">{r.student_id} · ไซส์ {r.size}{r.issue_type !== "none" ? ` · ⚠️ ${ISSUE_LABEL[r.issue_type]}` : ""}</div>
          </div>
          {r.phone ? <a href={`tel:${tel(r.phone)}`} className="btn btn-soft shrink-0 px-3 py-2 text-sm">📞 {r.phone}</a> : <span className="text-xs text-muted">ไม่มีเบอร์</span>}
        </div>
      ))}
    </div>
  );
}

// ---------- duplicate-id problem list ----------
interface IssueGroup {
  studentId: string;
  issueType: string;
  rows: { id: number; title: string | null; full_name: string; form_faculty: string; id_faculty: string | null; size: string; phone: string | null; submitted_at: string }[];
  distribution: { size: string; faculty: string; device_name: string | null; created_at: string; student_row_id: number } | null;
}

function Issues() {
  const { data, error } = useLoad<IssueGroup[]>("/api/admin/issues");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const groups = (data ?? []).filter((g) => filter === "all" || (filter === "done") === !!g.distribution);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(["open", "done", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "chip-on" : ""}`}>
            {{ open: "ยังไม่แก้", done: "แก้แล้ว", all: "ทั้งหมด" }[f]}
          </button>
        ))}
      </div>
      <Err e={error} />
      <p className="text-sm text-muted">&ldquo;แก้แล้ว&rdquo; = แจกเสื้อผ่านหน้าสแกนแล้ว ระบบติ๊กให้อัตโนมัติ ({groups.length} รายการ)</p>
      {groups.map((g) => (
        <div key={g.studentId} className="card flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="font-mono">{g.studentId}</span>
            <span className="text-sm">{g.distribution ? "✅ แก้แล้ว" : "⏳ ยังไม่แก้"} · {ISSUE_LABEL[g.issueType]}</span>
          </div>
          {g.rows.map((r) => (
            <div key={r.id} className={`rounded-lg p-2 text-sm ${g.distribution?.student_row_id === r.id ? "bg-emerald-50" : "bg-brand-50/50"}`}>
              <b>{r.title}{r.full_name}</b> · ไซส์ <b>{r.size}</b> · ฟอร์ม {r.form_faculty} · {fmtDateTime(r.submitted_at)} · {r.phone}
            </div>
          ))}
          {g.distribution && (
            <div className="text-xs text-muted">แจกไซส์ {g.distribution.size} ที่โต๊ะ {g.distribution.faculty} เมื่อ {fmtDateTime(g.distribution.created_at)} {g.distribution.device_name ? `โดย ${g.distribution.device_name}` : ""}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- latest handouts ----------
interface RecentRow { id: number; student_id: string; size: string; faculty: string; device_name: string | null; created_at: string; voided_at: string | null; students: { title: string | null; full_name: string } | null }

function Recent() {
  const { data, error, reload } = useLoad<RecentRow[]>("/api/admin/recent");
  useEffect(() => {
    const t = setInterval(reload, 15_000);
    return () => clearInterval(t);
  }, [reload]);
  return (
    <div className="flex flex-col gap-2">
      <Err e={error} />
      {(data ?? []).map((r) => (
        <div key={r.id} className={`card py-3 text-sm ${r.voided_at ? "opacity-50 line-through" : ""}`}>
          <div className="flex justify-between"><b>{r.students?.title}{r.students?.full_name}</b><span className="font-bold">{r.size}</span></div>
          <div className="text-xs text-muted">{r.student_id} · {r.faculty} · {fmtDateTime(r.created_at)} · {r.device_name ?? "-"}{r.voided_at ? " · ยกเลิกแล้ว" : ""}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- logs ----------
interface LogRow { id: number; at: string; action: string; role: string | null; device_id: string | null; device_name: string | null; ip: string | null; user_agent: string | null; student_id: string | null; faculty: string | null; detail: Record<string, unknown> | null }

function Logs() {
  const [action, setAction] = useState("");
  const [studentId, setStudentId] = useState("");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (before?: number) => {
      const p = new URLSearchParams();
      if (action) p.set("action", action);
      if (studentId) p.set("studentId", studentId);
      if (before) p.set("before", String(before));
      try {
        const d = await api<{ logs: LogRow[]; more: boolean }>(`/api/admin/logs?${p}`);
        setRows((old) => (before ? [...old, ...d.logs] : d.logs));
        setMore(d.more);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [action, studentId],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <select className="input text-base" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">ทุกการกระทำ</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input text-base" placeholder="รหัสนักศึกษา" inputMode="numeric" value={studentId} onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))} />
      </div>
      <Err e={error} />
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-black/5">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-brand-50/50 text-left text-muted">
            <tr><th className="p-2">เวลา</th><th>การกระทำ</th><th>ผล</th><th>รหัส นศ.</th><th>คณะ</th><th>เครื่อง</th><th>IP</th></tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t align-top">
                <td className="whitespace-nowrap p-2">{fmtDateTime(l.at)}</td>
                <td>{ACTION_LABEL[l.action] ?? l.action}<div className="text-muted">{l.role}</div></td>
                <td>{l.detail ? String(l.detail.result ?? l.detail.size ?? (l.detail.changed as string[] | undefined)?.join(",") ?? "") : ""}</td>
                <td className="font-mono">{l.student_id}</td>
                <td>{l.faculty}</td>
                <td title={l.user_agent ?? ""}>{l.device_name ?? "-"}<div className="font-mono text-muted">{l.device_id}</div></td>
                <td className="font-mono">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more && <button className="btn btn-ghost" onClick={() => load(rows[rows.length - 1]?.id)}>โหลดเพิ่ม</button>}
    </div>
  );
}

// ---------- devices ----------
interface DeviceRow { device_id: string; name: string | null; role: string | null; user_agent: string | null; ip: string | null; first_seen: string; last_seen: string }

function Devices() {
  const { data, error } = useLoad<DeviceRow[]>("/api/admin/devices");
  return (
    <div className="flex flex-col gap-2">
      <Err e={error} />
      <p className="text-sm text-muted">รหัสเครื่องสร้างจากเบราว์เซอร์ตอนปลดล็อกครั้งแรก (เว็บอ่านหมายเลขเครื่องจริงไม่ได้)</p>
      {(data ?? []).map((d) => (
        <div key={d.device_id} className="card py-3 text-sm">
          <div className="flex justify-between"><b>{d.name ?? "(ไม่ได้ตั้งชื่อ)"}</b><span className="font-mono">{d.device_id}</span></div>
          <div className="text-xs text-muted">{d.role} · IP {d.ip} · เห็นครั้งแรก {fmtDateTime(d.first_seen)} · ล่าสุด {fmtDateTime(d.last_seen)}</div>
          <div className="truncate text-xs text-muted">{d.user_agent}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- settings ----------
interface SettingsView {
  staffPinDaily: boolean;
  askDeviceName: boolean;
  schedule: { enabled: boolean; days: string[]; start: string; end: string };
  adminPinSet: boolean;
  staffPinSet: boolean;
  dailyPins: Record<string, string> | null;
}

/** Random 6-digit PIN from the browser crypto RNG (never Math.random). */
function randomPin(avoid?: string): string {
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const p = String(n).padStart(6, "0");
    if (p !== avoid && !/^(\d)\1{5}$/.test(p) && p !== "123456") return p;
  }
}

function PinField({ value, onChange, onSave, avoid }: { value: string; onChange: (v: string) => void; onSave: () => void; avoid?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="input font-mono text-xl tracking-[0.35em]"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <button type="button" className="btn btn-soft shrink-0 px-3" onClick={() => onChange(randomPin(avoid))} title="สุ่มรหัสใหม่">
          <Dices size={18} /> สุ่ม
        </button>
      </div>
      {value.length === 6 && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50/70 px-3 py-2 text-sm">
          <span className="text-brand-700">จดรหัสนี้ไว้ก่อนกดบันทึก</span>
          <span className="flex gap-2">
            <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => navigator.clipboard?.writeText(value)}>
              <Copy size={15} /> คัดลอก
            </button>
            <button type="button" className="btn btn-primary px-3 py-1.5 text-sm" onClick={onSave}>
              บันทึก
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const { data, error, setData } = useLoad<SettingsView>("/api/admin/settings");
  const [adminPin, setAdminPin] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState("16:00");
  const [end, setEnd] = useState("20:00");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!data) return;
    setDays(data.schedule.days);
    setStart(data.schedule.start);
    setEnd(data.schedule.end);
  }, [data]);

  useEffect(() => {
    if (!msg && !err) return;
    const t = setTimeout(() => (setMsg(""), setErr("")), err ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [msg, err]);

  async function saveSettings(body: Record<string, unknown>) {
    setMsg("");
    setErr("");
    try {
      const d = await api<SettingsView>("/api/admin/settings", { body });
      setData(d);
      setMsg("บันทึกแล้ว ✓");
      setAdminPin("");
      setStaffPin("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (!data) return error ? <Err e={error} /> : <ListSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      {/* toast above the bottom bar so the result of a tap is always visible, wherever the page is scrolled */}
      {(msg || err) && (
        <div className="fixed inset-x-4 bottom-28 z-40 mx-auto max-w-md">
          <p className={`animate-sheet rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ${err ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
            {err || msg}
          </p>
        </div>
      )}

      <section className="card flex flex-col gap-3">
        <h3 className="font-bold">รหัสแอดมิน</h3>
        <p className="text-sm text-muted">{data.adminPinSet ? "ตั้งในระบบแล้ว" : "ยังใช้ค่า ADMIN_PIN จาก Vercel — ควรตั้งใหม่ที่นี่"}</p>
        <PinField value={adminPin} onChange={setAdminPin} avoid={staffPin} onSave={() => saveSettings({ adminPin })} />
      </section>

      <section className="card flex flex-col gap-3">
        <h3 className="font-bold">รหัสสตาฟ</h3>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-orange-600" checked={data.staffPinDaily} onChange={(e) => saveSettings({ staffPinDaily: e.target.checked })} />
          เปลี่ยนรหัสสตาฟอัตโนมัติทุกวัน
        </label>
        {data.staffPinDaily && data.dailyPins ? (
          <div className="grid grid-cols-2 gap-2 text-center">
            {Object.entries(data.dailyPins).map(([d, p], i) => (
              <div key={d} className="rounded-xl bg-brand-50/60 p-3">
                <div className="text-xs text-muted">{i === 0 ? "วันนี้" : "พรุ่งนี้"} {d}</div>
                <div className="font-mono text-2xl font-bold tracking-widest">{p}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">{data.staffPinSet ? "ตั้งในระบบแล้ว (ใช้รหัสเดิมทุกวัน)" : "ยังใช้ค่า STAFF_PIN จาก Vercel"}</p>
            <PinField value={staffPin} onChange={setStaffPin} avoid={adminPin} onSave={() => saveSettings({ staffPin })} />
          </>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h3 className="font-bold">ตอนปลดล็อก</h3>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-orange-600" checked={data.askDeviceName} onChange={(e) => saveSettings({ askDeviceName: e.target.checked })} />
          ให้ใส่ชื่อเล่น/ชื่อโต๊ะ (ข้อมูลเครื่องถูกเก็บเสมอ)
        </label>
      </section>

      <section className="card flex flex-col gap-3">
        <h3 className="font-bold">วันและเวลาเปิดระบบ (สำหรับสตาฟ)</h3>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-orange-600" checked={data.schedule.enabled} onChange={(e) => saveSettings({ schedule: { ...data.schedule, enabled: e.target.checked } })} />
          จำกัดวัน/เวลา (ปิดไว้ = สตาฟใช้ได้ตลอด; แอดมินใช้ได้ตลอดเสมอ)
        </label>
        <div className="text-sm font-semibold">วันที่เปิดให้สตาฟใช้</div>
        <DateMultiPicker value={days} onChange={setDays} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-semibold">เริ่ม<input type="time" className="input mt-1" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="text-sm font-semibold">สิ้นสุด<input type="time" className="input mt-1" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <button className="btn btn-primary" onClick={() => saveSettings({ schedule: { enabled: data.schedule.enabled, days, start, end } })}>
          บันทึกวันเวลา
        </button>
      </section>

      <ResetSection />
    </div>
  );
}

/** Danger zone: wipe handouts + logs collected while testing. Requires typing RESET_WORD. */
function ResetSection() {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  async function reset() {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ deleted: Record<string, number> }>("/api/admin/reset", { body: { confirm: word } });
      setResult(`ล้างแล้ว: แจกเสื้อ ${r.deleted.distributions} รายการ · Log ${r.deleted.logs} รายการ · เครื่อง ${r.deleted.devices} เครื่อง`);
      try {
        sessionStorage.removeItem("swr:/api/stats");
      } catch {}
      setOpen(false);
      setWord("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card flex flex-col gap-3 border-red-200">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-red-600"><RotateCcw size={17} /></span>
        <h3 className="font-bold">เริ่มใหม่ (ล้างข้อมูลทดสอบ)</h3>
      </div>
      <p className="text-sm text-muted">
        ใช้หลังทดสอบระบบ ก่อนเริ่มแจกจริง จะ<b className="text-red-700">ลบ</b>การแจกเสื้อทั้งหมด, Log, รายชื่อเครื่อง และประวัติใส่รหัส
        <br />จะ<b>ไม่ลบ</b>รายชื่อนักศึกษาและการตั้งค่า (รหัส / วันเวลา) · ลบแล้วกู้คืนไม่ได้
      </p>
      {result && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{result}</p>}
      <button className="btn border border-red-200 bg-white text-red-600 active:bg-red-50" onClick={() => setOpen(true)}>
        <RotateCcw size={18} /> เริ่มใหม่
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-[2px]" onClick={() => !busy && setOpen(false)}>
          <div className="animate-sheet mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-[1.75rem] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={22} />
              <h3 className="text-lg font-bold">ยืนยันล้างข้อมูลทั้งหมด?</h3>
            </div>
            <p className="text-sm text-muted">
              สถานะ &ldquo;รับเสื้อแล้ว&rdquo; ของทุกคนจะกลับเป็นยังไม่รับ และ Log ทั้งหมดจะหายไป ห้ามกดระหว่างวันแจกจริง
            </p>
            <label className="text-sm font-semibold">
              พิมพ์ <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">{RESET_WORD}</span> เพื่อยืนยัน
              <input className="input mt-1" value={word} onChange={(e) => setWord(e.target.value)} autoFocus />
            </label>
            {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-ghost py-3.5" onClick={() => setOpen(false)} disabled={busy}>ยกเลิก</button>
              <button className="btn bg-red-600 py-3.5 text-white" onClick={reset} disabled={busy || word.trim() !== RESET_WORD}>
                {busy ? "กำลังล้าง..." : "ล้างข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
