"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Delete, Loader2, Shirt } from "lucide-react";
import { api, getDeviceId, save, store } from "@/lib/client";

interface Me {
  session: { role: string; deviceId: string; deviceName: string | null } | null;
  askDeviceName: boolean;
  open: boolean;
}

/** Unlock screen: one 6-digit PIN (admin or staff), once per day. Big keypad for one-thumb use. */
export default function UnlockPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("out") === "pin") {
      setError("ออกจากระบบแล้ว — รหัสที่ใช้อยู่ถูกปิด/ลบ หรือหมดอายุ กรุณาปลดล็อกใหม่");
    }
    setName(store("f69_device_name", ""));
    api<Me>("/api/auth/me")
      .then((m) => {
        if (m.session) {
          sessionStorage.setItem("f69_session_cache", JSON.stringify(m.session));
          router.replace("/scan");
        } else setMe(m);
      })
      .catch((e) => setError(e.message));
    router.prefetch("/scan");
  }, [router]);

  async function unlock(code: string) {
    if (me?.askDeviceName && !name.trim()) {
      setError("ใส่ชื่อเล่นก่อน");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (name) save("f69_device_name", name.trim());
      const r = await api<{ role: string; deviceName: string | null }>("/api/auth/unlock", {
        body: { pin: code, deviceId: getDeviceId(), deviceName: name.trim() || null },
      });
      sessionStorage.setItem("f69_session_cache", JSON.stringify({ role: r.role, deviceId: getDeviceId(), deviceName: r.deviceName }));
      router.replace("/scan");
    } catch (err) {
      setError((err as Error).message);
      setPin("");
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy || pin.length >= 6) return;
    setError("");
    const next = pin + d;
    setPin(next);
    if (next.length === 6) setTimeout(() => unlock(next), 80); // auto-submit on the 6th digit
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-sm flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-100 via-brand-50 to-transparent" />

      <div className="flex flex-col items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-xl shadow-brand-200">
          <Shirt size={32} strokeWidth={2.2} />
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight">Freshly69 แจกเสื้อ</h1>
        <p className="text-sm text-muted">ระบบยืนยันการรับเสื้อ · สำหรับสตาฟ</p>
      </div>

      {me?.askDeviceName && (
        <label className="mt-7 flex flex-col gap-1.5">
          <span className="text-sm font-semibold">ชื่อเล่น</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="เช่น บอส" />
        </label>
      )}

      <div className="mt-7 text-center text-sm font-semibold text-muted">ใส่รหัสปลดล็อก 6 หลัก</div>
      <div className="mt-3 flex justify-center gap-3" style={shake ? { animation: "shake 0.35s" } : undefined}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition-all ${i < pin.length ? "scale-110 bg-brand-500" : "bg-brand-100"}`}
          />
        ))}
      </div>

      <div className="mt-4 min-h-12">
        {busy && (
          <p className="flex items-center justify-center gap-2 text-sm text-brand-700">
            <Loader2 size={16} className="animate-spin" /> กำลังตรวจรหัส...
          </p>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-700">{error}</p>}
        {me && !me.open && !error && (
          <p className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
            <Clock size={15} /> ตอนนี้นอกเวลาแจกเสื้อ (แอดมินยังเข้าได้)
          </p>
        )}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={busy}>{d}</Key>
        ))}
        <span />
        <Key onClick={() => press("0")} disabled={busy}>0</Key>
        <button
          className="grid h-14 place-items-center rounded-xl text-muted active:bg-brand-50 disabled:opacity-40"
          onClick={() => setPin((p) => p.slice(0, -1))}
          disabled={busy || !pin}
          aria-label="ลบ"
        >
          <Delete size={24} />
        </button>
      </div>
      <p className="mt-5 text-center text-xs text-muted">ปลดล็อกครั้งเดียวต่อวัน</p>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </main>
  );
}

function Key({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className="h-14 rounded-xl border border-line bg-white text-xl font-semibold shadow-sm transition active:scale-95 active:bg-brand-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
