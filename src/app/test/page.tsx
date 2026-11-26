"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Barcode as BarcodeIcon, FlaskConical, Pencil, Plus, ScanLine, Sparkles, Trash2, Undo2, X } from "lucide-react";
import Shell from "@/components/Shell";
import ScanScreen from "@/components/ScanScreen";
import Barcode from "@/components/Barcode";
import BottomSheet from "@/components/BottomSheet";
import { FACULTIES, FACULTY_KEYS, SIZES } from "@/lib/constants";
import { api } from "@/lib/client";
import { useCached } from "@/lib/useCached";
import { PROBLEMS, fakeId, type TestCase, type TestProblem } from "@/lib/testcases";

const Scanner = dynamic(() => import("@/components/Scanner"), { ssr: false });

type Row = TestCase & { given: { size: string; faculty: string; created_at: string } | null };
const short = (k: string) => (k === "เทคโนโลยีสารสนเทศ" ? "ไอที" : k);
const problemLabel = (p: string) => PROBLEMS.find((x) => x.key === p)?.label ?? p;

/** What the scan popup should show for this case at its own faculty desk. */
function expected(c: TestCase): string {
  if (c.year !== 1) return `⛔ ไม่ใช่นักศึกษาปี 1 (ตั้งไว้ปี ${c.year})`;
  if (c.problem === "received") return "⛔ รับเสื้อไปแล้ว";
  if (c.problem === "dup_same") return "⚠️ กรอกซ้ำ ไซส์ตรงกัน → แจกได้";
  if (c.problem === "dup_size") return "⚠️ ไซส์ไม่ตรง → ต้องเลือกไซส์ก่อนยืนยัน";
  if (c.problem === "dup_person") return "❗ รหัสนี้มี 2 คน → ต้องเลือกคนก่อนยืนยัน";
  return "✅ พบข้อมูล → แจกได้";
}

export default function TestPage() {
  const [tab, setTab] = useState<"cases" | "scan" | "codes">("cases");
  return (
    <Shell adminOnly>
      <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900">
        <FlaskConical size={22} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <div className="font-bold">โหมดทดสอบ</div>
          ใช้ข้อมูลทดสอบแยกต่างหาก ไม่แตะรายชื่อจริง ไม่นับในภาพรวม และไม่บันทึก Log — กดยืนยันแจกได้เต็มที่
        </div>
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {([
          ["cases", "ข้อมูลทดสอบ"],
          ["scan", "สแกนทดสอบ"],
          ["codes", "บาร์โค้ดทั้งหมด"],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? "chip-on" : ""}`}>{l}</button>
        ))}
      </div>
      {tab === "cases" && <Cases onScan={() => setTab("scan")} />}
      {tab === "scan" && <ScanScreen apiBase="/api/test" test />}
      {tab === "codes" && <AllCodes />}
    </Shell>
  );
}

// ---------------------------------------------------------------- cases list
function Cases({ onScan }: { onScan: () => void }) {
  const { data, error, reload } = useCached<Row[]>("/api/test/cases");
  const [edit, setEdit] = useState<Partial<TestCase> | null>(null);
  const [show, setShow] = useState<Row | null>(null);
  const [genFaculty, setGenFaculty] = useState(FACULTY_KEYS[0]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function act(label: string, fn: () => Promise<unknown>, done: string) {
    setBusy(label);
    setMsg("");
    try {
      await fn();
      setMsg(done);
      await reload();
    } catch (e) {
      setMsg("❌ " + (e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <section className="card flex flex-col gap-3">
        <div className="flex items-center gap-2 font-bold"><Sparkles size={18} className="text-brand-500" /> สร้างข้อมูลทดสอบอัตโนมัติ</div>
        <p className="text-sm text-muted">สร้างคนปลอม 8 คน ครบทุกปัญหา (รหัสขึ้นต้น 6999 ไม่ซ้ำคนจริง) ให้อยู่คณะที่เลือก — กดซ้ำ = สร้างชุดใหม่แทนชุดเดิม</p>
        <div className="flex gap-2">
          <select className="input py-2.5 text-base" value={genFaculty} onChange={(e) => setGenFaculty(e.target.value)}>
            {FACULTIES.map((f) => <option key={f.key} value={f.key}>{short(f.key)} — {f.label}</option>)}
          </select>
          <button className="btn btn-primary shrink-0" disabled={!!busy} onClick={() => act("gen", () => api("/api/test/generate", { body: { faculty: genFaculty } }), "สร้างข้อมูลอัตโนมัติแล้ว ✓")}>
            {busy === "gen" ? "กำลังสร้าง..." : "สร้าง"}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-primary" onClick={() => setEdit({ year: 1, problem: "none", title: "นาย", faculty: genFaculty, size: "M" })}>
          <Plus size={18} /> เพิ่มเอง
        </button>
        <button className="btn btn-soft" onClick={onScan}><ScanLine size={18} /> ไปสแกนทดสอบ</button>
        <button className="btn btn-ghost text-sm" disabled={!!busy} onClick={() => act("reset", () => api("/api/test/reset", { body: { what: "handouts" } }), "ล้างการแจกทดสอบแล้ว ✓")}>
          <Undo2 size={16} /> ล้างการแจก
        </button>
        <button
          className="btn btn-ghost text-sm text-red-600"
          disabled={!!busy}
          onClick={() => confirm("ลบข้อมูลทดสอบทั้งหมด?") && act("all", () => api("/api/test/reset", { body: { what: "all" } }), "ลบข้อมูลทดสอบทั้งหมดแล้ว ✓")}
        >
          <Trash2 size={16} /> ลบทั้งหมด
        </button>
      </div>

      {msg && <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${msg.startsWith("❌") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error} — ถ้าเพิ่งเปิดใช้ครั้งแรก ต้องรันไฟล์ <code>supabase/test-mode.sql</code> ใน Supabase ก่อน
        </p>
      )}
      {!data && !error && [0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}
      {data && rows.length === 0 && <p className="py-6 text-center text-sm text-muted">ยังไม่มีข้อมูลทดสอบ — กด &ldquo;สร้าง&rdquo; หรือ &ldquo;เพิ่มเอง&rdquo;</p>}

      {rows.map((r) => (
        <article key={r.id} className="card flex flex-col gap-2 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-bold">{r.title}{r.full_name}</div>
              <div className="font-mono text-sm tracking-wide text-muted">{r.student_id}</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-2.5 py-1 text-xl font-bold text-white">{r.size}</div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{short(r.faculty)}</span>
            <span className={`rounded-full px-2 py-0.5 ${r.year === 1 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>ปี {r.year}</span>
            <span className={`rounded-full px-2 py-0.5 ${r.problem === "none" ? "bg-gray-100 text-gray-700" : "bg-amber-50 text-amber-800"}`}>{problemLabel(r.problem)}</span>
            {r.given && <span className="rounded-full bg-ink px-2 py-0.5 text-white">แจกแล้ว {r.given.size}</span>}
            {r.auto && <span className="rounded-full border border-line px-2 py-0.5 text-muted">อัตโนมัติ</span>}
          </div>
          <div className="text-xs text-muted">ผลที่ควรเห็นเมื่อสแกนที่คณะ {short(r.faculty)}: {expected(r)}</div>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn btn-soft py-2 text-sm" onClick={() => setShow(r)}><BarcodeIcon size={16} /> บาร์โค้ด</button>
            <button className="btn btn-ghost py-2 text-sm" onClick={() => setEdit(r)}><Pencil size={15} /> แก้ไข</button>
            <button className="btn btn-ghost py-2 text-sm text-red-600" onClick={() => act("del", () => api(`/api/test/cases?id=${r.id}`, { method: "DELETE" }), "ลบแล้ว ✓")}>
              <Trash2 size={15} /> ลบ
            </button>
          </div>
        </article>
      ))}

      {edit && <Editor initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setMsg("บันทึกแล้ว ✓"); reload(); }} />}
      {show && <BarcodeSheet c={show} onClose={() => setShow(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- editor
function Editor({ initial, onClose, onSaved }: { initial: Partial<TestCase>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<TestCase>>(initial);
  const [scan, setScan] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof TestCase, v: unknown) => setF((o) => ({ ...o, [k]: v }));
  const p = (f.problem ?? "none") as TestProblem;

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/test/cases", { body: f });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-1.5 text-sm font-semibold">{children}</div>;

  return (
    <>
      <BottomSheet onClose={busy ? undefined : onClose} className="gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{f.id ? "แก้ไขข้อมูลทดสอบ" : "เพิ่มข้อมูลทดสอบ"}</h3>
        </div>

        <div>
          <Label>รหัสนักศึกษา (13 หลัก) — ใส่รหัสบัตรของตัวเองได้</Label>
          <div className="flex gap-2">
            <input
              className="input font-mono tracking-wider"
              inputMode="numeric"
              maxLength={13}
              placeholder="เช่น บัตรปี 3 ของสตาฟ"
              value={f.student_id ?? ""}
              onChange={(e) => set("student_id", e.target.value.replace(/\D/g, "").slice(0, 13))}
            />
            <button type="button" className="btn btn-primary shrink-0 px-3" onClick={() => setScan(true)}><ScanLine size={18} /> สแกนบัตร</button>
          </div>
          <button type="button" className="mt-1.5 text-xs font-semibold text-brand-600" onClick={() => set("student_id", fakeId())}>หรือสุ่มรหัสปลอม</button>
        </div>

        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <div>
            <Label>คำนำหน้า</Label>
            <select className="input text-base" value={f.title ?? ""} onChange={(e) => set("title", e.target.value)}>
              <option value="นาย">นาย</option>
              <option value="นางสาว">นางสาว</option>
              <option value="">(ไม่มี)</option>
            </select>
          </div>
          <div>
            <Label>ชื่อ-สกุล</Label>
            <input className="input text-base" value={f.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} placeholder="ใส่ชื่อจริงหรือชื่อสมมติ" />
          </div>
        </div>

        <div>
          <Label>คณะของคนนี้</Label>
          <div className="grid grid-cols-3 gap-2">
            {FACULTIES.map((x) => (
              <button type="button" key={x.key} onClick={() => set("faculty", x.key)} className={`chip py-2 ${f.faculty === x.key ? "chip-on" : ""}`}>{short(x.key)}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>ไซส์</Label>
          <div className="grid grid-cols-6 gap-1.5">
            {SIZES.map((z) => (
              <button type="button" key={z} onClick={() => set("size", z)} className={`chip px-1 py-2 ${f.size === z ? "chip-on" : ""}`}>{z}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>ให้ระบบถือว่าอยู่ปีไหน (ปี 1 เท่านั้นที่รับได้)</Label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((y) => (
              <button type="button" key={y} onClick={() => set("year", y)} className={`chip py-2 ${f.year === y ? "chip-on" : ""}`}>ปี {y}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>ปัญหา</Label>
          <div className="flex flex-col gap-2">
            {PROBLEMS.map((x) => (
              <button
                type="button"
                key={x.key}
                onClick={() => set("problem", x.key)}
                className={`rounded-2xl border px-3.5 py-2.5 text-left transition ${p === x.key ? "border-brand-400 bg-brand-50 ring-2 ring-brand-100" : "border-line bg-white"}`}
              >
                <div className="text-sm font-bold">{x.label}</div>
                <div className="text-xs text-muted">{x.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {(p === "dup_same" || p === "dup_person") && (
          <div>
            <Label>{p === "dup_same" ? "ฟอร์มที่ 2 กรอกในคณะ" : "คนที่ 2 กรอกในฟอร์มคณะ"}</Label>
            <select className="input text-base" value={f.second_faculty ?? ""} onChange={(e) => set("second_faculty", e.target.value)}>
              <option value="">{p === "dup_same" ? "(อัตโนมัติ: คณะอื่น)" : "(คณะเดียวกัน)"}</option>
              {FACULTIES.map((x) => <option key={x.key} value={x.key}>{short(x.key)}</option>)}
            </select>
          </div>
        )}
        {(p === "dup_size" || p === "dup_person") && (
          <div>
            <Label>{p === "dup_size" ? "ไซส์ในฟอร์มที่ 2" : "ไซส์ของคนที่ 2"}</Label>
            <div className="grid grid-cols-6 gap-1.5">
              {SIZES.map((z) => (
                <button type="button" key={z} onClick={() => set("second_size", z)} className={`chip px-1 py-2 ${f.second_size === z ? "chip-on" : ""}`}>{z}</button>
              ))}
            </div>
          </div>
        )}
        {p === "dup_person" && (
          <div>
            <Label>ชื่อคนที่ 2</Label>
            <input className="input text-base" value={f.second_name ?? ""} onChange={(e) => set("second_name", e.target.value)} placeholder="เช่น สมหญิง ทดสอบ" />
          </div>
        )}

        {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <button className="btn btn-primary py-4 text-lg" disabled={busy} onClick={submit}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
      </BottomSheet>

      {scan && (
        // own stacking context above the sheet (z-50), camera itself is z-40
        <div className="relative z-[60]">
          <Scanner
            faculty="สแกนบัตรเพื่อกรอกรหัส"
            paused={false}
            onDetect={(id) => {
              set("student_id", id);
              setScan(false);
            }}
            onManual={() => setScan(false)}
            onClose={() => setScan(false)}
          />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- barcodes
function BarcodeSheet({ c, onClose }: { c: TestCase; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="animate-pop w-full max-w-md rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <div className="font-bold">{c.title}{c.full_name}</div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-muted" aria-label="ปิด"><X size={20} /></button>
        </div>
        <div className="text-sm text-muted">เลือกคณะ <b className="text-brand-700">{short(c.faculty)}</b> แล้วสแกนจากอีกเครื่อง</div>
        <Barcode value={c.student_id} className="my-4 rounded-xl border border-line p-2" />
        <div className="rounded-xl bg-brand-50 px-3 py-2 text-sm">ควรเห็น: {expected(c)}</div>
        <div className="mt-2 text-xs text-muted">สแกนที่คณะอื่น → 🟧 คณะไม่ตรง{c.year !== 1 ? " (แต่ถ้าไม่ใช่ปี 1 จะขึ้นไม่ใช่ปี 1 ก่อน)" : ""}</div>
      </div>
    </div>
  );
}

function AllCodes() {
  const { data } = useCached<Row[]>("/api/test/cases");
  const [notFound] = useState(() => fakeId());
  const special = [
    { id: notFound, title: "ไม่มีในระบบ", expect: "❌ ไม่มีข้อมูลนี้ในระบบ (รหัสนี้ไม่อยู่ในข้อมูลทดสอบ)" },
    { id: "699900000000", title: "บาร์โค้ดผิด (12 หลัก)", expect: "ไม่ควรมีอะไรเด้ง — กล้องสแกนต่อ" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">เปิดหน้านี้บนคอมหรืออีกเครื่อง แล้วใช้มือถือที่เปิดแท็บ &ldquo;สแกนทดสอบ&rdquo; สแกน</p>
      {(data ?? []).map((c) => (
        <article key={c.id} className="card">
          <div className="flex justify-between text-sm"><b>{c.title}{c.full_name}</b><span className="text-brand-700">คณะ {short(c.faculty)}</span></div>
          <Barcode value={c.student_id} className="my-2" />
          <div className="text-xs text-muted">ควรเห็น: {expected(c)}</div>
        </article>
      ))}
      <h3 className="mt-2 px-1 font-bold">กรณีที่ไม่ต้องมีข้อมูล</h3>
      {special.map((s) => (
        <article key={s.id} className="card">
          <div className="text-sm font-bold">{s.title}</div>
          <Barcode value={s.id} className="my-2" />
          <div className="text-xs text-muted">ควรเห็น: {s.expect}</div>
        </article>
      ))}
    </div>
  );
}
