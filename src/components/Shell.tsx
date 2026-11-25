"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/client";

export interface SessionInfo {
  role: "admin" | "staff";
  deviceId: string;
  deviceName: string | null;
}

const Ctx = createContext<SessionInfo | null>(null);
export const useSession = () => useContext(Ctx);

/** Logged-in frame: loads the session (or bounces to "/") and shows the bottom tab bar. */
export default function Shell({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [s, setS] = useState<SessionInfo | null>(null);

  useEffect(() => {
    api<{ session: SessionInfo | null }>("/api/auth/me").then(({ session }) => {
      if (!session) router.replace("/");
      else if (adminOnly && session.role !== "admin") router.replace("/scan");
      else setS(session);
    });
  }, [router, adminOnly]);

  async function lock() {
    await api("/api/auth/lock", { method: "POST" });
    router.replace("/");
  }

  if (!s) return <div className="grid min-h-dvh place-items-center text-gray-400">กำลังโหลด...</div>;

  const tabs = [
    { href: "/scan", label: "สแกน", icon: "📷" },
    { href: "/overview", label: "ภาพรวม", icon: "📊" },
    ...(s.role === "admin" ? [{ href: "/admin", label: "แอดมิน", icon: "🛠️" }] : []),
  ];

  return (
    <Ctx.Provider value={s}>
      <header className="sticky top-0 z-20 flex items-center justify-between bg-white/90 px-4 py-2 text-sm backdrop-blur ring-1 ring-black/5">
        <span className="font-semibold">👕 Freshly69</span>
        <span className="text-gray-500">
          {s.role === "admin" ? "แอดมิน" : "สตาฟ"}
          {s.deviceName ? ` · ${s.deviceName}` : ""}
          <button onClick={lock} className="ml-3 text-orange-700 underline">ล็อก</button>
        </span>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t bg-white pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`flex flex-1 flex-col items-center py-2 text-sm ${path.startsWith(t.href) ? "font-bold text-orange-700" : "text-gray-500"}`}>
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>
    </Ctx.Provider>
  );
}
