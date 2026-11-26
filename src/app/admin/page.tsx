"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { ACTION_LABEL, RESET_WORD } from "@/lib/constants";
import { api } from "@/lib/client";
import { useCached } from "@/lib/useCached";
import { describeLog } from "@/lib/logtext";
import { AlertTriangle, Copy, Dices, Eye, EyeOff, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import DateMultiPicker from "@/components/DateMultiPicker";
import FacultyPicker from "@/components/FacultyPicker";
import BottomSheet from "@/components/BottomSheet";
import { fmtDateTime } from "@/lib/time";

// ยังไม่รับ / แจกล่าสุด / ปัญหา moved to the "รายชื่อ" page (staff + admin)
const TABS = [
  { key: "logs", label: "Log" },
  { key: "settings", label: "ตั้งค่า" },
] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("logs");
  return (
    <Shell adminOnly>
      <div className="seg mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`seg-item ${tab === t.key ? "!bg-brand-600 !text-white shadow" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "logs" && <Logs />}
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

// ---------- logs ----------
interface LogRow { id: number; at: string; action: string; role: string | null; device_name: string | null; student_id: string | null; faculty: string | null; detail: Record<string, unknown> | null }

/** "YYYY-MM-DDTHH:mm" in the phone's local time (what <input type="datetime-local"> uses). */
const localInput = (d: Date) => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};
const dayRange = (offsetDays: number) => {
  const s = new Date();
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() + offsetDays);
  const e = new Date(s);
  e.setHours(23, 59, 0, 0);
  return [localInput(s), localInput(e)] as const;
};

function Logs() {
  const [action, setAction] = useState("");
  const [studentId, setStudentId] = useState("");
  const [faculty, setFaculty] = useState(""); // "" = ทุกคณะ
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (before?: number) => {
      const p = new URLSearchParams();
      if (action) p.set("action", action);
      if (studentId) p.set("studentId", studentId);
      if (faculty) p.set("faculty", faculty);
      if (from) p.set("from", new Date(from).toISOString());
      if (to) p.set("to", new Date(to).toISOString());
      if (before) p.set("before", String(before));
      setLoading(true);
      try {
        const d = await api<{ logs: LogRow[]; more: boolean }>(`/api/admin/logs?${p}`);
        setRows((old) => (before ? [...old, ...d.logs] : d.logs));
        setMore(d.more);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [action, studentId, faculty, from, to],
  );
  useEffect(() => {
    load();
  }, [load]);

  const quick = (k: "today" | "yesterday" | "all") => {
    if (k === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const [a, b] = dayRange(k === "today" ? 0 : -1);
    setFrom(a);
    setTo(b);
  };
  const [tA, tB] = dayRange(0);
  const [yA, yB] = dayRange(-1);
  const active = !from && !to ? "all" : from === tA && to === tB ? "today" : from === yA && to === yB ? "yesterday" : "";

  return (
    <div className="flex flex-col gap-3">
      <section className="card flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold">ตัวกรอง</span>
          <div className="flex gap-1.5">
            {([
              ["today", "วันนี้"],
              ["yesterday", "เมื่อวาน"],
              ["all", "ทั้งหมด"],
            ] as const).map(([k, l]) => (
              <button key={k} onClick={() => quick(k)} className={`chip px-2.5 py-1 text-xs ${active === k ? "chip-on" : ""}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          <label>
            <span className="field-label">ตั้งแต่</span>
            <input type="datetime-local" className="input-sm px-2" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span className="field-label">ถึง</span>
            <input type="datetime-local" className="input-sm px-2" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="field-label">การกระทำ</span>
            <select className="input-sm" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">ทั้งหมด</option>
              <option value="scan_search">สแกน / ค้นหา</option>
              <option value="confirm">ยืนยันแจก</option>
              <option value="void">ยกเลิก/แก้ไข</option>
            </select>
          </label>
          <label>
            <span className="field-label">รหัสนักศึกษา</span>
            <input className="input-sm" placeholder="13 หลัก" inputMode="numeric" value={studentId} onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))} />
          </label>
        </div>
        <div>
          <span className="field-label">คณะ</span>
          <FacultyPicker value={faculty} onChange={setFaculty} compact />
        </div>
        {(from || to || action || studentId || faculty) && (
          <button
            className="self-end text-xs font-semibold text-brand-700"
            onClick={() => {
              setFrom("");
              setTo("");
              setAction("");
              setStudentId("");
              setFaculty("");
            }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </section>

      <Err e={error} />
      <div className="text-xs text-muted">{loading ? "กำลังโหลด..." : `${rows.length}${more ? "+" : ""} รายการ`}</div>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-black/5">
        <table className="w-full min-w-[640px] table-fixed text-xs">
          {/* six equal columns */}
          <colgroup>{Array.from({ length: 6 }).map((_, i) => <col key={i} className="w-1/6" />)}</colgroup>
          <thead className="bg-brand-50/50 text-left text-muted">
            <tr>{["เวลา", "ใคร", "การกระทำ", "คณะ", "รหัส นศ.", "ผลลัพธ์"].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t align-top">
                <td className="px-2 py-2">{fmtDateTime(l.at)}</td>
                <td className="break-words px-2 py-2">{l.device_name ?? "-"}<div className="text-muted">{l.role === "admin" ? "แอดมิน" : l.role === "staff" ? "สตาฟ" : ""}</div></td>
                <td className="px-2 py-2">{ACTION_LABEL[l.action] ?? l.action}</td>
                <td className="px-2 py-2">{l.faculty}</td>
                <td className="break-all px-2 py-2 font-mono">{l.student_id}</td>
                <td className="break-words px-2 py-2">{describeLog(l.action, l.detail)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted">ไม่มีรายการในช่วงนี้</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {more && <button className="btn btn-ghost" disabled={loading} onClick={() => load(rows[rows.length - 1]?.id)}>โหลดเพิ่ม</button>}
    </div>
  );
}

// ---------- settings ----------
interface PinInfo {
  id: string;
  label: string;
  createdAt: string | null;
  enabled: boolean;
  env: boolean; // ADMIN_PIN / STAFF_PIN from Vercel
  revealable: boolean; // false = old PIN saved only as a hash
}

/** "••••••" with an eye button: asks the server for the PIN (logged), hides again after 30 s. */
function PinSecret({ role, id, revealable }: { role: "admin" | "staff"; id: string; revealable: boolean }) {
  const [pin, setPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pin) return;
    const t = setTimeout(() => setPin(null), 30_000);
    return () => clearTimeout(t);
  }, [pin]);

  async function toggle() {
    if (pin) return setPin(null);
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ pin: string }>("/api/admin/pins/reveal", { body: { role, id } });
      setPin(r.pin);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!pin) return;
    await navigator.clipboard?.writeText(pin).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (!revealable) return <span className="text-xs text-muted">•••••• (ดูย้อนหลังไม่ได้)</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {pin ? (
        <button type="button" onClick={copy} className="rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-base font-bold tracking-[0.3em] text-brand-700" title="แตะเพื่อคัดลอก">
          {copied ? "คัดลอกแล้ว" : pin}
        </button>
      ) : (
        <span className="font-mono tracking-[0.25em]">••••••</span>
      )}
      <button type="button" onClick={toggle} disabled={busy} className="grid h-7 w-7 place-items-center rounded-full text-muted active:bg-brand-50" aria-label={pin ? "ซ่อนรหัส" : "ดูรหัส"}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : pin ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}

interface SettingsView {
  adminPins: PinInfo[];
  staffPins: PinInfo[];
  staffPinDaily: boolean;
  askDeviceName: boolean;
  schedule: { enabled: boolean; days: string[]; start: string; end: string };
  dailyPins: Record<string, string> | null;
}

/** Random 6-digit PIN from the browser crypto RNG (never Math.random). */
function randomPin(): string {
  for (;;) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const p = String(n).padStart(6, "0");
    if (!/^(\d)\1{5}$/.test(p) && p !== "123456" && p !== "654321") return p;
  }
}

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${on ? "bg-emerald-500" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
    </button>
  );
}

/** One role's PINs: on/off switch + delete per PIN, and add (type or random). */
function PinList({
  role,
  title,
  pins,
  disabledNote,
  onSave,
}: {
  role: "admin" | "staff";
  title: string;
  pins: PinInfo[];
  disabledNote?: string;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [pin, setPin] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const onCount = pins.filter((p) => p.enabled).length;

  async function add() {
    setBusy(true);
    const ok = await onSave({ addPin: { role, pin, label } });
    setBusy(false);
    if (ok) {
      setAdding(false);
      setPin("");
      setLabel("");
    }
  }

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{title}</h3>
        <span className="text-xs text-muted">เปิดใช้ {onCount} / {pins.length} รหัส</span>
      </div>
      {disabledNote && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{disabledNote}</p>}
      <p className="text-xs text-muted">ปิดหรือลบรหัส → คนที่ใช้รหัสนั้นอยู่จะถูกออกจากระบบภายใน ~30 วินาที</p>

      <div className="flex flex-col gap-2">
        {pins.length === 0 && <p className="rounded-xl bg-brand-50/50 px-3 py-2 text-sm text-muted">ยังไม่มีรหัส</p>}
        {pins.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition ${p.enabled ? "border-line bg-white" : "border-dashed border-gray-300 bg-gray-50"}`}>
            <div className="min-w-0 flex-1">
              <div className={`truncate font-semibold ${p.enabled ? "" : "text-muted line-through"}`}>{p.label}</div>
              <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                <PinSecret role={role} id={p.id} revealable={p.revealable} />
                <span>· {p.enabled ? "เปิดใช้" : "ปิดอยู่"}{p.env && " · ตั้งใน Vercel"}</span>
              </div>
            </div>
            <Switch on={p.enabled} onChange={(v) => onSave({ togglePin: { role, id: p.id, enabled: v } })} />
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-red-600 active:bg-red-50"
              aria-label={`ลบรหัส ${p.label}`}
              onClick={() =>
                confirm(
                  p.env
                    ? `เอา "${p.label}" ออกจากรายการ? รหัสนี้จะใช้ไม่ได้อีก (ค่าใน Vercel ยังอยู่ แต่ระบบจะไม่รับ)`
                    : `ลบรหัสของ "${p.label}"? คนที่ใช้รหัสนี้อยู่จะถูกออกจากระบบ`,
                ) && onSave({ removePin: { role, id: p.id } })
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>

      {!adding ? (
        <button className="btn btn-soft" onClick={() => setAdding(true)}>
          <Plus size={18} /> เพิ่มรหัส{role === "admin" ? "แอดมิน" : "สตาฟ"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50/40 p-3">
          <input className="input-sm" placeholder="ชื่อเจ้าของรหัส เช่น บอส / ทีม A" maxLength={30} value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="flex gap-2">
            <input
              className="input-sm font-mono tracking-[0.3em]"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <button type="button" className="btn btn-ghost shrink-0 px-3" onClick={() => setPin(randomPin())} title="สุ่มรหัส">
              <Dices size={18} /> สุ่ม
            </button>
          </div>
          {pin.length === 6 && (
            <p className="flex items-center justify-between gap-2 text-sm text-brand-700">
              จดรหัสไว้ หรือกดรูปตาในรายการเพื่อดูภายหลังได้
              <button type="button" className="btn btn-ghost px-2.5 py-1 text-xs" onClick={() => navigator.clipboard?.writeText(pin)}>
                <Copy size={14} /> คัดลอก
              </button>
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={() => setAdding(false)} disabled={busy}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={add} disabled={busy || pin.length !== 6 || !label.trim()}>
              {busy ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SettingsTab() {
  const { data, error, setData } = useLoad<SettingsView>("/api/admin/settings");
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

  async function saveSettings(body: Record<string, unknown>): Promise<boolean> {
    setMsg("");
    setErr("");
    try {
      const d = await api<SettingsView>("/api/admin/settings", { body });
      setData(d);
      setMsg("บันทึกแล้ว ✓");
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
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

      <PinList role="admin" title="รหัสแอดมิน" pins={data.adminPins} onSave={saveSettings} />

      <PinList
        role="staff"
        title="รหัสสตาฟ"
        pins={data.staffPins}
        disabledNote={data.staffPinDaily ? "ตอนนี้เปิด \"เปลี่ยนรหัสสตาฟทุกวัน\" อยู่ — รหัสในรายการนี้จะใช้ไม่ได้จนกว่าจะปิด" : undefined}
        onSave={saveSettings}
      />

      <section className="card flex flex-col gap-3">
        <h3 className="font-bold">รหัสสตาฟรายวัน</h3>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-orange-600" checked={data.staffPinDaily} onChange={(e) => saveSettings({ staffPinDaily: e.target.checked })} />
          ใช้รหัสสตาฟรหัสเดียวที่เปลี่ยนเองทุกวัน (แทนรายการด้านบน)
        </label>
        {data.staffPinDaily && data.dailyPins && (
          <div className="grid grid-cols-2 gap-2 text-center">
            {Object.entries(data.dailyPins).map(([d, p], i) => (
              <div key={d} className="rounded-xl bg-brand-50/60 p-3">
                <div className="text-xs text-muted">{i === 0 ? "วันนี้" : "พรุ่งนี้"} {d}</div>
                <div className="font-mono text-2xl font-bold tracking-widest">{p}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h3 className="font-bold">ตอนปลดล็อก</h3>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-orange-600" checked={data.askDeviceName} onChange={(e) => saveSettings({ askDeviceName: e.target.checked })} />
          ให้ใส่ชื่อเล่นตอนปลดล็อก (บันทึกใน Log ว่าใครทำ)
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
          <label className="text-sm font-semibold">เริ่ม<input type="time" className="input-sm mt-1" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="text-sm font-semibold">สิ้นสุด<input type="time" className="input-sm mt-1" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
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
      setResult(`ล้างแล้ว: แจกเสื้อ ${r.deleted.distributions} รายการ · Log ${r.deleted.logs} รายการ`);
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
        ใช้หลังทดสอบระบบ ก่อนเริ่มแจกจริง จะ<b className="text-red-700">ลบ</b>การแจกเสื้อทั้งหมด, Log และประวัติใส่รหัส
        <br />จะ<b>ไม่ลบ</b>รายชื่อนักศึกษาและการตั้งค่า (รหัส / วันเวลา) · ลบแล้วกู้คืนไม่ได้
      </p>
      {result && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{result}</p>}
      <button className="btn border border-red-200 bg-white text-red-600 active:bg-red-50" onClick={() => setOpen(true)}>
        <RotateCcw size={18} /> เริ่มใหม่
      </button>

      {open && (
        <BottomSheet onClose={busy ? undefined : () => setOpen(false)} className="max-w-md gap-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={22} />
              <h3 className="text-lg font-bold">ยืนยันล้างข้อมูลทั้งหมด?</h3>
            </div>
            <p className="text-sm text-muted">
              สถานะ &ldquo;รับเสื้อแล้ว&rdquo; ของทุกคนจะกลับเป็นยังไม่รับ และ Log ทั้งหมดจะหายไป ห้ามกดระหว่างวันแจกจริง
            </p>
            <label className="text-sm font-semibold">
              พิมพ์ <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">{RESET_WORD}</span> เพื่อยืนยัน
              <input className="input-sm mt-1" value={word} onChange={(e) => setWord(e.target.value)} autoFocus />
            </label>
            {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-ghost py-3.5" onClick={() => setOpen(false)} disabled={busy}>ยกเลิก</button>
              <button className="btn bg-red-600 py-3.5 text-white" onClick={reset} disabled={busy || word.trim() !== RESET_WORD}>
                {busy ? "กำลังล้าง..." : "ล้างข้อมูล"}
              </button>
            </div>
        </BottomSheet>
      )}
    </section>
  );
}
