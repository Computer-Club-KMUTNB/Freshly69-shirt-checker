"use client";

/** Random id for this phone/browser, created on first use and kept in localStorage. */
export function getDeviceId(): string {
  const KEY = "f69_device_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "D-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "D-NOSTORAGE-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
}

export function store<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: Record<string, unknown> = {}) {
    super(message);
  }
}

/** fetch JSON; a 401 sends the user back to the unlock screen. Network errors → status 0. */
export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "เชื่อมต่อเน็ตไม่ได้ ลองใหม่อีกครั้ง");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.href = "/";
  }
  // 403 = this browser's login changed role (e.g. staff unlocked in another tab) → let Shell re-check.
  if (res.status === 403 && typeof window !== "undefined") window.dispatchEvent(new Event("f69:recheck-session"));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "เกิดข้อผิดพลาด", data);
  return data as T;
}
