"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
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

function ScanScreen() {
  const [faculty, setFaculty] = useState("");
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setFaculty(store("f69_faculty", "")), []);

  function pickFaculty(f: string) {
    setFaculty(f);
    save("f69_faculty", f);
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

  const manualForm = (
    <form onSubmit={submitTyped} className="flex gap-2">
      <input
        ref={inputRef}
        className="input font-mono"
        inputMode="numeric"
        placeholder="พิมพ์รหัสนักศึกษา 13 หลัก"
        value={typed}
        maxLength={13}
        onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 13))}
      />
      <button className="btn btn-ghost shrink-0" disabled={busy || typed.length !== 13}>
        {busy ? "..." : "ค้นหา"}
      </button>
    </form>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="card">
        <h2 className="mb-2 font-semibold">1. เลือกคณะที่กำลังแจก</h2>
        <div className="grid grid-cols-3 gap-2">
          {FACULTIES.map((f) => (
            <button
              key={f.key}
              onClick={() => pickFaculty(f.key)}
              className={`btn px-2 py-2 text-sm ${faculty === f.key ? "bg-orange-600 text-white" : "btn-ghost"}`}
              title={f.label}
            >
              {f.key === "เทคโนโลยีสารสนเทศ" ? "ไอที" : f.key}
            </button>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="font-semibold">2. สแกนบัตรนักศึกษา {faculty && <span className="text-orange-700">· คณะ {faculty}</span>}</h2>
        <button className="btn btn-primary py-8 text-2xl shadow-lg shadow-orange-200" disabled={!faculty} onClick={() => setCamera(true)}>
          📷 เปิดกล้องสแกน
        </button>
        {!faculty && <p className="text-center text-sm text-gray-500">เลือกคณะก่อนจึงจะสแกนได้</p>}
        <div className="text-center text-xs text-gray-400">หรือพิมพ์รหัส (สำรอง)</div>
        {faculty && manualForm}
        {error && !result && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      </section>

      {camera && faculty && (
        <Scanner paused={!!result || manual || busy} onDetect={onDetect} onManual={() => setManual(true)} onClose={() => setCamera(false)} />
      )}

      {camera && manual && !result && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setManual(false)}>
          <div className="w-full rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">ค้นหาด้วยการพิมพ์รหัส</h3>
            {manualForm}
            {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
          </div>
        </div>
      )}

      {result && (
        <ResultSheet
          key={sheetKey}
          lookup={result}
          faculty={faculty}
          onRelookup={(id) => run(id, "search")}
          onDone={() => setResult(null)}
        />
      )}
    </div>
  );
}
