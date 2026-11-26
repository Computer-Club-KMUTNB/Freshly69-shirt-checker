"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { BarChart3, FlaskConical, LogOut, ScanLine, Shirt, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/client";

export interface SessionInfo {
  role: "admin" | "staff";
  deviceId: string;
  deviceName: string | null;
}

const Ctx = createContext<SessionInfo | null>(null);
export const useSession = () => useContext(Ctx);

const KEY = "f69_session_cache";

function cachedSession(): SessionInfo | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v ? (JSON.parse(v) as SessionInfo) : null;
  } catch {
    return null;
  }
}

/**
 * Logged-in frame. Renders instantly from the session cached in sessionStorage, then confirms it
 * with the server in the background (bounces to "/" if it expired).
 */
export default function Shell({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [s, setS] = useState<SessionInfo | null>(null);

  useEffect(() => {
    const c = cachedSession();
    if (c && !(adminOnly && c.role !== "admin")) setS(c);

    const check = () =>
      api<{ session: SessionInfo | null }>("/api/auth/me")
        .then(({ session }) => {
          if (!session) {
            const hadSession = !!cachedSession();
            sessionStorage.removeItem(KEY);
            router.replace(hadSession ? "/?out=pin" : "/");
          } else {
            sessionStorage.setItem(KEY, JSON.stringify(session));
            setS(session);
            if (adminOnly && session.role !== "admin") router.replace("/scan");
          }
        })
        .catch(() => {
          /* offline: keep the cached session; API calls will show their own errors */
        });

    check();
    // The login cookie is shared by every tab of this browser: unlocking as staff in another tab
    // replaces an admin login. Re-check whenever this tab comes back into view.
    const onVisible = () => document.visibilityState === "visible" && check();
    // a PIN removed / switched off by the admin logs its users out within ~30 s even if they are idle
    const timer = setInterval(() => document.visibilityState === "visible" && check(), 30_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("f69:recheck-session", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("f69:recheck-session", check);
    };
  }, [router, adminOnly]);

  async function lock() {
    try {
      sessionStorage.clear();
    } catch {}
    await api("/api/auth/lock", { method: "POST" }).catch(() => {});
    router.replace("/");
  }

  const tabs = [
    { href: "/scan", label: "สแกน", Icon: ScanLine },
    { href: "/overview", label: "ภาพรวม", Icon: BarChart3 },
    // everyone: รายชื่อ (ยังไม่รับ · แจกล่าสุด · ปัญหา) · admin only: test mode + admin tools
    ...(s ? [{ href: "/roster", label: "รายชื่อ", Icon: Users }] : []),
    ...(s?.role === "admin"
      ? [
          { href: "/test", label: "ทดสอบ", Icon: FlaskConical },
          { href: "/admin", label: "แอดมิน", Icon: ShieldCheck },
        ]
      : []),
  ];

  return (
    <Ctx.Provider value={s}>
      <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-200">
              <Shirt size={18} strokeWidth={2.4} />
            </span>
            <span className="font-bold tracking-tight">Freshly69</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {s && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.role === "admin" ? "bg-ink text-white" : "bg-brand-50 text-brand-700"}`}>
                {s.role === "admin" ? "แอดมิน" : "สตาฟ"}
                {s.deviceName ? ` · ${s.deviceName}` : ""}
              </span>
            )}
            <button
              onClick={lock}
              className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-brand-50 active:scale-95"
              aria-label="ออกจากระบบ"
            >
              <LogOut size={15} /> ออก
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-2xl px-4 pb-32 pt-4">{s ? children : <PageSkeleton />}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="mx-auto flex max-w-md justify-around rounded-2xl border border-line bg-white/95 p-1.5 shadow-[0_12px_32px_-12px_rgb(124_45_18/0.35)] backdrop-blur">
          {tabs.map(({ href, label, Icon }) => {
            const on = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${on ? "bg-brand-50 text-brand-600" : "text-muted"}`}
              >
                <Icon size={20} strokeWidth={on ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </Ctx.Provider>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton h-28" />
      <div className="skeleton h-48" />
      <div className="skeleton h-20" />
    </div>
  );
}
