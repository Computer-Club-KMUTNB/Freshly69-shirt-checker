"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import type { ActiveDistribution, Candidate, LookupResult } from "@/lib/rules";
import { fmtDateTime } from "@/lib/time";

interface Props {
  lookup: LookupResult;
  faculty: string;
  /** Re-run the lookup for this id (after "แก้ไข" or a conflict). */
  onRelookup: (studentId: string) => void;
  /** Close the sheet and go back to scanning the next card. */
  onDone: () => void;
}

const fmtShort = (iso: string | null) => fmtDateTime(iso);
const who = (c: Candidate) => `${c.title ?? ""}${c.fullName}`;

function Banner({ tone, children }: { tone: "red" | "amber" | "orange" | "green" | "gray"; children: React.ReactNode }) {
  const cls = {
    red: "bg-red-50 text-red-800 ring-red-200",
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    orange: "bg-orange-50 text-orange-900 ring-orange-200",
    green: "bg-green-50 text-green-800 ring-green-200",
    gray: "bg-gray-50 text-gray-800 ring-gray-200",
  }[tone];
  return <div className={`rounded-xl p-3 ring-1 ${cls}`}>{children}</div>;
}

function Person({ c, studentId, size }: { c: Candidate; studentId: string; size?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xl font-bold">{who(c)}</div>
        <div className="font-mono text-gray-600">{studentId}</div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-500">ไซส์</div>
        <div className="min-w-16 rounded-xl bg-orange-600 px-3 py-1 text-4xl font-bold text-white">{size ?? c.size}</div>
      </div>
    </div>
  );
}

/** Bottom sheet shown after a scan/search: the status popup + confirm / edit / done buttons. */
export default function ResultSheet({ lookup, faculty, onRelookup, onDone }: Props) {
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
      const res = await api<{ distribution: ActiveDistribution }>("/api/distribute", {
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
      await api("/api/distribute/void", { body: { distributionId: done.id, reason: "กดแก้ไขหลังยืนยัน" } });
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
      <Sheet>
        <Banner tone="green">
          <div className="text-2xl font-bold">✅ ยืนยันแจกเสื้อสำเร็จ</div>
          <div className="text-sm">บันทึกเวลา {fmtShort(done.created_at)}</div>
        </Banner>
        {c && <Person c={c} studentId={r.studentId} size={done.size} />}
        {error && <Banner tone="red">{error}</Banner>}
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-ghost py-4" onClick={edit} disabled={busy}>✏️ แก้ไข</button>
          <button className="btn btn-primary py-4 text-lg" onClick={onDone} disabled={busy}>เสร็จสิ้น ➜</button>
        </div>
      </Sheet>
    );
  }

  // ---------- status popups ----------
  let body: React.ReactNode;
  let canConfirm = false;

  switch (r.result) {
    case "invalid":
      body = <Banner tone="red">รหัสนักศึกษาต้องเป็นตัวเลข 13 หลัก ({r.studentId || "ว่าง"})</Banner>;
      break;
    case "not_found":
      body = (
        <Banner tone="red">
          <div className="text-lg font-bold">❌ ไม่มีข้อมูลนี้ในระบบ</div>
          หากเกิดข้อผิดพลาดโปรดติดต่อสตาฟ
          <div className="mt-1 font-mono">{r.studentId}</div>
        </Banner>
      );
      break;
    case "not_freshman":
      body = (
        <>
          <Banner tone="red">
            <div className="text-lg font-bold">⛔ ไม่ใช่นักศึกษาปี 1 — แจกไม่ได้</div>
            รหัสขึ้นต้นด้วย <b>{r.studentId.slice(0, 2)}</b> (ต้องเป็น 69) หากเกิดข้อผิดพลาดโปรดติดต่อสตาฟ
          </Banner>
          {latest && <Person c={latest} studentId={r.studentId} />}
        </>
      );
      break;
    case "received":
      body = (
        <>
          <Banner tone="red">
            <div className="text-lg font-bold">⛔ รับเสื้อไปแล้ว</div>
            ข้อมูลดังกล่าวมีสถานะการรับเสื้อเป็นเสร็จสิ้นไปแล้ว หากเกิดข้อผิดพลาดโปรดติดต่อสตาฟ
            <div className="mt-2 text-sm">
              รับเมื่อ {fmtShort(r.distribution.created_at)} · ไซส์ {r.distribution.size} · คณะ {r.distribution.faculty}
              {r.distribution.device_name ? ` · โดย ${r.distribution.device_name}` : ""}
            </div>
          </Banner>
          {latest && <Person c={latest} studentId={r.studentId} size={r.distribution.size} />}
        </>
      );
      break;
    case "wrong_faculty":
      body = (
        <>
          <Banner tone="orange">
            <div className="text-lg font-bold">🟧 คณะไม่ตรง — ยังแจกไม่ได้</div>
            น้องอยู่คณะ <b>{r.correctFaculty}</b> แต่โต๊ะนี้แจกคณะ <b>{r.selectedFaculty}</b>
            <div className="mt-1">→ ให้น้องไปรับที่แถวคณะ <b>{r.correctFaculty}</b></div>
          </Banner>
          {cands.length > 1 && (
            <Banner tone="amber">⚠️ น้องคนนี้กรอกฟอร์มมากกว่า 1 ครั้ง ({cands.map((c) => `${c.formFaculty} ${c.size}`).join(" / ")}) — แจ้งน้องให้ทราบ</Banner>
          )}
          {latest && <Person c={latest} studentId={r.studentId} />}
        </>
      );
      break;
    case "ok":
      canConfirm = true;
      body = <Person c={latest} studentId={r.studentId} />;
      break;
    case "dup_same":
      canConfirm = true;
      body = (
        <>
          <Banner tone="amber">
            ⚠️ กรอกซ้ำ {cands.length} ฟอร์ม ({cands.map((c) => c.formFaculty).join(", ")}) ไซส์ตรงกัน: <b>{latest.size}</b>
            <div className="text-sm">แจ้งน้องให้ทราบก่อน แล้วแจกได้</div>
          </Banner>
          <Person c={latest} studentId={r.studentId} />
        </>
      );
      break;
    case "dup_size":
      canConfirm = !!size;
      body = (
        <>
          <Banner tone="amber">
            ⚠️ ไซส์ไม่ตรง: {cands.map((c) => `${c.size} (${c.formFaculty} ${fmtShort(c.submittedAt)})`).join(" / ")}
            <div className="font-semibold">→ แจ้งน้อง แล้วถามว่าจะเอาไซส์ไหน</div>
          </Banner>
          <div className="text-xl font-bold">{who(latest)}</div>
          <div className="font-mono text-gray-600">{r.studentId}</div>
          <div className="grid grid-cols-2 gap-3">
            {[...new Set(cands.map((c) => c.size))].map((s) => (
              <button key={s} onClick={() => setSize(s)} className={`btn py-4 text-3xl ${size === s ? "bg-orange-600 text-white" : "btn-ghost"}`}>
                {s}
              </button>
            ))}
          </div>
        </>
      );
      break;
    case "dup_person":
      canConfirm = rowId != null;
      body = (
        <>
          <Banner tone="red">
            ❗ รหัสนี้มี {cands.length} คน: {cands.map((c) => c.fullName).join(" / ")}
            <div className="font-semibold">→ ดูชื่อบนบัตรนักศึกษา แล้วเลือกคนที่ชื่อตรง</div>
          </Banner>
          <div className="font-mono text-gray-600">{r.studentId}</div>
          <div className="flex flex-col gap-2">
            {cands.map((c) => (
              <button key={c.rowId} onClick={() => setRowId(c.rowId)} className={`btn justify-between py-4 text-left ${rowId === c.rowId ? "bg-orange-600 text-white" : "btn-ghost"}`}>
                <span>{who(c)} <span className="text-xs opacity-75">({c.formFaculty})</span></span>
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
    <Sheet>
      <div className="text-sm text-gray-500">โต๊ะคณะ {faculty}</div>
      {body}
      {error && <Banner tone="red">{error}</Banner>}
      <div className={`grid gap-3 ${showConfirm ? "grid-cols-[1fr_2fr]" : "grid-cols-1"}`}>
        <button className="btn btn-ghost py-4" onClick={onDone} disabled={busy}>
          {showConfirm ? "ยกเลิก" : "สแกนคนต่อไป ➜"}
        </button>
        {showConfirm && (
          <button className="btn bg-green-600 py-4 text-xl text-white" onClick={confirm} disabled={busy || !canConfirm}>
            {busy ? "กำลังบันทึก..." : "✔ ยืนยันแจก"}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="mx-auto flex max-h-[90dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-gray-900">
        {children}
      </div>
    </div>
  );
}
