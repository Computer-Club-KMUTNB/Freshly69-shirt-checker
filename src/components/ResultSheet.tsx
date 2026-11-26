"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Ban, Check, CheckCircle2, Loader2, MapPin, Pencil, SearchX, UserX, Users } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import { api, ApiError } from "@/lib/client";
import type { ActiveDistribution, Candidate, LookupResult } from "@/lib/rules";
import { fmtDateTime } from "@/lib/time";

interface Props {
  /** "/api" (real) or "/api/test" (test mode). */
  apiBase?: string;
  lookup: LookupResult;
  faculty: string;
  /** Re-run the lookup for this id (after "แก้ไข" or a conflict). */
  onRelookup: (studentId: string) => void;
  /** Close the sheet and go back to scanning the next card. */
  onDone: () => void;
}

const who = (c: Candidate) => `${c.title ?? ""}${c.fullName}`;
type Tone = "red" | "amber" | "orange" | "green";

const TONE: Record<Tone, { box: string; icon: string }> = {
  red: { box: "bg-red-50 text-red-900 border-red-200", icon: "bg-red-500" },
  amber: { box: "bg-amber-50 text-amber-950 border-amber-200", icon: "bg-amber-500" },
  orange: { box: "bg-brand-50 text-brand-700 border-brand-200", icon: "bg-brand-500" },
  green: { box: "bg-emerald-50 text-emerald-900 border-emerald-200", icon: "bg-emerald-500" },
};

function Status({ tone, icon, title, children }: { tone: Tone; icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <div className={`flex gap-3 rounded-2xl border p-3.5 ${t.box}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${t.icon}`}>{icon}</span>
      <div className="min-w-0 text-sm leading-relaxed">
        <div className="text-base font-bold leading-snug">{title}</div>
        {children}
      </div>
    </div>
  );
}

function Person({ c, studentId, size }: { c: Candidate; studentId: string; size?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4">
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight">{who(c)}</div>
        <div className="mt-1 font-mono text-sm tracking-wide text-muted">{studentId}</div>
      </div>
      <div className="shrink-0 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">ไซส์</div>
        <div className="mt-0.5 min-w-[4.5rem] rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 px-3 py-1.5 text-4xl font-bold text-white shadow-lg shadow-brand-200">
          {size ?? c.size}
        </div>
      </div>
    </div>
  );
}

/** Bottom sheet shown after a scan/search: the status popup + confirm / edit / done buttons. */
export default function ResultSheet({ apiBase = "/api", lookup, faculty, onRelookup, onDone }: Props) {
  const [rowId, setRowId] = useState<number | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<ActiveDistribution | null>(null);

  const r = lookup;
  const cands = "candidates" in r ? r.candidates : [];
  const latest = cands[cands.length - 1];

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ distribution: ActiveDistribution }>(`${apiBase}/distribute`, {
        body: { studentId: r.studentId, faculty, rowId, size },
      });
      navigator.vibrate?.([60, 40, 60]);
      setDone(res.distribution);
    } catch (e) {
      const err = e as ApiError;
      setError(err.status === 0 ? "ยังไม่ได้บันทึก! เน็ตหลุด — กดยืนยันอีกครั้ง" : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function edit() {
    if (!done) return;
    setBusy(true);
    setError("");
    try {
      await api(`${apiBase}/distribute/void`, { body: { distributionId: done.id, reason: "กดแก้ไขหลังยืนยัน" } });
      onRelookup(r.studentId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ---------- after confirm ----------
  if (done) {
    const c = cands.find((x) => x.rowId === rowId) ?? latest;
    return (
      <Sheet onClose={busy ? undefined : onDone}>
        <div className="flex flex-col items-center py-2 text-center">
          <span className="animate-pop grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
            <Check size={36} strokeWidth={3} />
          </span>
          <div className="mt-3 text-2xl font-bold">ยืนยันแจกเสื้อสำเร็จ</div>
          <div className="text-sm text-muted">บันทึกเมื่อ {fmtDateTime(done.created_at)}</div>
        </div>
        {c && <Person c={c} studentId={r.studentId} size={done.size} />}
        {error && <Status tone="red" icon={<AlertTriangle size={18} />} title={error} />}
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <button className="btn btn-ghost py-4" onClick={edit} disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Pencil size={18} />} แก้ไข
          </button>
          <button className="btn btn-primary py-4 text-lg" onClick={onDone} disabled={busy}>
            เสร็จสิ้น <ArrowRight size={20} />
          </button>
        </div>
      </Sheet>
    );
  }

  // ---------- status popups ----------
  let body: React.ReactNode;
  let canConfirm = false;

  switch (r.result) {
    case "invalid":
      body = <Status tone="red" icon={<AlertTriangle size={18} />} title="รหัสไม่ถูกต้อง">รหัสนักศึกษาต้องเป็นตัวเลข 13 หลัก ({r.studentId || "ว่าง"})</Status>;
      break;
    case "not_found":
      body = (
        <Status tone="red" icon={<SearchX size={18} />} title="ไม่มีข้อมูลนี้ในระบบ">
          หากเกิดข้อผิดพลาดโปรดติดต่อสตาฟ
          <div className="mt-1 font-mono">{r.studentId}</div>
        </Status>
      );
      break;
    case "not_freshman":
      body = (
        <>
          <Status tone="red" icon={<UserX size={18} />} title="ไม่ใช่นักศึกษาปี 1 — แจกไม่ได้">
            รหัสขึ้นต้นด้วย <b>{r.studentId.slice(0, 2)}</b> (ต้องเป็น 69) หากเกิดข้อผิดพลาดโปรดติดต่อสตาฟ
          </Status>
          {latest && <Person c={latest} studentId={r.studentId} />}
        </>
      );
      break;
    case "received":
      body = (
        <>
          <Status tone="red" icon={<Ban size={18} />} title="รับเสื้อไปแล้ว">
            ข้อมูลดังกล่าวมีสถานะการรับเสื้อเป็นเสร็จสิ้นไปแล้ว หากเกิดข้อผิดพลาดโปรดติดต่อสตาฟ
            <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-red-800">
              รับเมื่อ {fmtDateTime(r.distribution.created_at)} · ไซส์ {r.distribution.size} · แจกที่คณะ {r.distribution.faculty}
              {r.distribution.device_name ? ` · โดย ${r.distribution.device_name}` : ""}
            </div>
          </Status>
          {latest && <Person c={latest} studentId={r.studentId} size={r.distribution.size} />}
        </>
      );
      break;
    case "wrong_faculty":
      body = (
        <>
          <Status tone="orange" icon={<MapPin size={18} />} title={`ให้ไปรับที่แถวคณะ ${r.correctFaculty}`}>
            น้องอยู่คณะ <b>{r.correctFaculty}</b> แต่ตอนนี้กำลังแจกคณะ <b>{r.selectedFaculty}</b> — ยังแจกไม่ได้
          </Status>
          {cands.length > 1 && (
            <Status tone="amber" icon={<AlertTriangle size={18} />} title="น้องกรอกฟอร์มมากกว่า 1 ครั้ง">
              {cands.map((c) => `${c.formFaculty} ${c.size}`).join(" / ")} — แจ้งน้องให้ทราบ
            </Status>
          )}
          {latest && <Person c={latest} studentId={r.studentId} />}
        </>
      );
      break;
    case "ok":
      canConfirm = true;
      body = (
        <>
          <Status tone="green" icon={<CheckCircle2 size={18} />} title="พบข้อมูล — แจกได้" />
          <Person c={latest} studentId={r.studentId} />
        </>
      );
      break;
    case "dup_same":
      canConfirm = true;
      body = (
        <>
          <Status tone="amber" icon={<AlertTriangle size={18} />} title={`กรอกซ้ำ ${cands.length} ฟอร์ม · ไซส์ตรงกัน`}>
            ฟอร์ม {cands.map((c) => c.formFaculty).join(", ")} ไซส์ <b>{latest.size}</b> ทั้งหมด — แจ้งน้องให้ทราบก่อน แล้วแจกได้
          </Status>
          <Person c={latest} studentId={r.studentId} />
        </>
      );
      break;
    case "dup_size":
      canConfirm = !!size;
      body = (
        <>
          <Status tone="amber" icon={<AlertTriangle size={18} />} title="ไซส์ไม่ตรงกัน — ถามน้องก่อน">
            {cands.map((c) => `${c.size} (${c.formFaculty} ${fmtDateTime(c.submittedAt)})`).join(" / ")}
          </Status>
          <div className="rounded-2xl border border-line p-4">
            <div className="text-xl font-bold">{who(latest)}</div>
            <div className="font-mono text-sm text-muted">{r.studentId}</div>
            <div className="mt-3 text-sm font-semibold">น้องจะเอาไซส์ไหน?</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {[...new Set(cands.map((c) => c.size))].map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`btn py-5 text-3xl ${size === s ? "btn-primary" : "btn-ghost"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      );
      break;
    case "dup_person":
      canConfirm = rowId != null;
      body = (
        <>
          <Status tone="red" icon={<Users size={18} />} title={`รหัสนี้มี ${cands.length} คน — ยืนยันตัวตนก่อน`}>
            ดูชื่อบนบัตรนักศึกษา แล้วเลือกคนที่ชื่อตรง
          </Status>
          <div className="font-mono text-sm text-muted">{r.studentId}</div>
          <div className="flex flex-col gap-2">
            {cands.map((c) => (
              <button
                key={c.rowId}
                onClick={() => setRowId(c.rowId)}
                className={`btn justify-between py-4 text-left ${rowId === c.rowId ? "btn-primary" : "btn-ghost"}`}
              >
                <span>
                  {who(c)} <span className="text-xs opacity-75">({c.formFaculty})</span>
                </span>
                <span className="text-2xl">{c.size}</span>
              </button>
            ))}
          </div>
        </>
      );
      break;
  }

  const showConfirm = ["ok", "dup_same", "dup_size", "dup_person"].includes(r.result);

  return (
    <Sheet onClose={busy ? undefined : onDone}>
      <div className="flex items-center justify-between pr-11 text-sm">
        <span className="font-semibold text-muted">ผลการตรวจ</span>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">คณะ {faculty}</span>
      </div>
      {body}
      {error && <Status tone="red" icon={<AlertTriangle size={18} />} title={error} />}
      <div className={`grid gap-3 ${showConfirm ? "grid-cols-[1fr_2fr]" : "grid-cols-1"}`}>
        <button className="btn btn-ghost py-4" onClick={onDone} disabled={busy}>
          {showConfirm ? "ยกเลิก" : <>สแกนคนต่อไป <ArrowRight size={18} /></>}
        </button>
        {showConfirm && (
          <button className="btn py-4 text-lg text-white shadow-lg shadow-emerald-200 bg-gradient-to-br from-emerald-500 to-emerald-600" onClick={confirm} disabled={busy || !canConfirm}>
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Check size={22} strokeWidth={3} />} {busy ? "กำลังบันทึก..." : "ยืนยันแจก"}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  // swipe down = same as ยกเลิก / เสร็จสิ้น; a stray tap on the backdrop must not close it
  return (
    <BottomSheet onClose={onClose} backdropClose={false}>
      {children}
    </BottomSheet>
  );
}
