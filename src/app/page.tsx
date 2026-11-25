"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getDeviceId, save, store } from "@/lib/client";

interface Me {
  session: { role: string } | null;
  askDeviceName: boolean;
  open: boolean;
}

/** Unlock screen: one 6-digit PIN (admin or staff), once per day. */
export default function UnlockPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(store("f69_device_name", ""));
    api<Me>("/api/auth/me")
      .then((m) => (m.session ? router.replace("/scan") : setMe(m)))
      .catch((e) => setError(e.message));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (name) save("f69_device_name", name);
      await api("/api/auth/unlock", { body: { pin, deviceId: getDeviceId(), deviceName: name || null } });
      router.replace("/scan");
    } catch (err) {
      setError((err as Error).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <div className="text-5xl">👕</div>
        <h1 className="mt-2 text-2xl font-bold">Freshly69 แจกเสื้อ</h1>
        <p className="text-gray-500">สำหรับสตาฟเท่านั้น</p>
      </div>
      <form onSubmit={submit} className="card flex flex-col gap-4">
        {me?.askDeviceName && (
          <label className="flex flex-col gap-1">
            <span className="font-semibold">ชื่อเล่น / ชื่อโต๊ะ</span>
            <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="เช่น บอส โต๊ะ 2" required />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-semibold">รหัสปลดล็อก 6 หลัก</span>
          <input
            className="input text-center text-3xl tracking-[0.5em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
            required
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
        {me && !me.open && <p className="rounded-lg bg-amber-50 p-3 text-amber-800">ตอนนี้นอกเวลาแจกเสื้อ (แอดมินยังเข้าได้)</p>}
        <button className="btn btn-primary text-lg" disabled={busy || pin.length !== 6}>
          {busy ? "กำลังตรวจ..." : "ปลดล็อก"}
        </button>
      </form>
      <p className="text-center text-xs text-gray-400">ปลดล็อกครั้งเดียวต่อวัน · ระบบบันทึกข้อมูลเครื่องทุกครั้ง</p>
    </main>
  );
}
