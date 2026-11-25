"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Camera, ChevronRight, Keyboard, Loader2, Search } from "lucide-react";
import Shell from "@/components/Shell";
import ResultSheet from "@/components/ResultSheet";
import { FACULTIES } from "@/lib/constants";
import { api, save, store } from "@/lib/client";
import { normalizeStudentId, type LookupResult } from "@/lib/rules";

// camera code only runs in the browser
const Scanner = dynamic(() => import("@/components/Scanner"), { ssr: false });

export default function ScanPage() {
  return (
    <Shell>
      <ScanScreen />
    </Shell>
  );
}

const short = (key: string) => (key === "เทคโนโลยีสารสนเทศ" ? "ไอที" : key);

function ScanScreen() {
  const [faculty, setFaculty] = useState("");
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [lastFaculty, setLastFaculty] = useState("");

  useEffect(() => {
    setLastFaculty(store("f69_faculty", "")); // highlight only; staff always picks the desk first
    import("@/components/Scanner"); // warm the camera bundle so the button opens instantly
  }, []);

  function pickFaculty(f: string) {
    setFaculty(f);
    setLastFaculty(f);
    save("f69_faculty", f);
    setError("");
  }

  function changeFaculty() {
    setCamera(false);
    setManual(false);
    setTyped("");
    setError("");
    setFaculty("");
  }

  const run = useCallback(
    async (rawId: string, source: "scan" | "search") => {
      setBusy(true);
      setError("");
      try {
        const r = await api<LookupResult>("/api/lookup", { body: { studentId: rawId, faculty, source } });
        setResult(r);
        setSheetKey((k) => k + 1);
        setManual(false);
        setTyped("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [faculty],
  );

  const onDetect = useCallback((id: string) => run(id, "scan"), [run]);

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizeStudentId(typed)) return setError("รหัสนักศึกษาต้องเป็นตัวเลข 13 หลัก");
    run(typed, "search");
  }

  const manualForm = (autoFocus = false) => (
    <form onSubmit={submitTyped} className="flex gap-2">
      <div className="relative flex-1">
        <Keyboard size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className={`input pl-11 ${typed ? "font-mono tracking-wider" : ""}`}
          inputMode="numeric"
          placeholder="รหัสนักศึกษา 13 หลัก"
          value={typed}
          maxLength={13}
          autoFocus={autoFocus}
          onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 13))}
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted">{typed.length}/13</span>
      </div>
      <button className="btn btn-soft shrink-0 px-4" disabled={busy || typed.length !== 13} aria-label="ค้นหา">
        {busy ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
      </button>
    </form>
  );

  const facultyLabel = FACULTIES.find((f) => f.key === faculty)?.label;

  return (
    <div className="flex flex-col gap-4">
      {!faculty ? (
        <section className="animate-sheet flex flex-col gap-3">
          <div className="px-1">
            <h2 className="text-xl font-bold">เลือกคณะที่จะแจก</h2>
            <p className="text-sm text-muted">ระบบจะตรวจว่าน้องที่สแกนอยู่คณะนี้</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {FACULTIES.map((f) => (
              <button
                key={f.key}
                onClick={() => pickFaculty(f.key)}
                className={`flex items-center justify-between rounded-2xl border bg-white px-4 py-3.5 text-left transition active:scale-[0.98] ${lastFaculty === f.key ? "border-brand-300 ring-2 ring-brand-100" : "border-line"}`}
              >
                <span>
                  <span className="block font-bold">{short(f.key)}</span>
                  <span className="block text-xs text-muted">{f.label}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-brand-600">
                  {lastFaculty === f.key && "ใช้ล่าสุด"}
                  <ChevronRight size={20} />
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <button onClick={changeFaculty} className="flex w-fit items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-muted active:bg-brand-50">
            <ArrowLeft size={16} /> เปลี่ยนคณะ
          </button>

          <section className="animate-sheet relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-[0_20px_40px_-20px_rgb(194_65_12/0.9)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-16 -left-6 h-40 w-40 rounded-full bg-white/10" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 shadow-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> กำลังแจก
              </span>
              <div className="mt-4 text-3xl font-bold leading-snug tracking-tight drop-shadow-sm">{facultyLabel}</div>
              <button
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-6 text-xl font-bold text-brand-600 shadow-lg transition active:scale-[0.98]"
                onClick={() => setCamera(true)}
              >
                <Camera size={30} strokeWidth={2.4} /> เปิดกล้องสแกน
              </button>
            </div>
          </section>

          <section className="card">
            <div className="mb-2 text-sm font-semibold text-muted">ค้นหารหัสนักศึกษา</div>
            {manualForm()}
            {error && !result && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </section>
        </>
      )}

      {camera && faculty && (
        <Scanner
          faculty={short(faculty)}
          busy={busy}
          paused={!!result || manual || busy}
          onDetect={onDetect}
          onManual={() => setManual(true)}
          onClose={() => setCamera(false)}
        />
      )}

      {camera && manual && !result && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-[2px]" onClick={() => setManual(false)}>
          <div className="animate-sheet w-full rounded-t-[1.75rem] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            <h3 className="mb-3 font-bold">ค้นหาด้วยการพิมพ์รหัส</h3>
            {manualForm(true)}
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </div>
        </div>
      )}

      {result && (
        <ResultSheet key={sheetKey} lookup={result} faculty={faculty} onRelookup={(id) => run(id, "search")} onDone={() => setResult(null)} />
      )}
    </div>
  );
}
