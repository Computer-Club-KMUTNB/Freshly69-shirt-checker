"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./client";

// Stale-while-revalidate: show the last result instantly, refresh in the background.
// `persist` keeps a copy in sessionStorage (survives page reloads) — use ONLY for data without
// personal info (e.g. counts). Lists with names/phones stay in memory only.
const memory = new Map<string, unknown>();

function readPersisted<T>(key: string): T | undefined {
  try {
    const v = sessionStorage.getItem("swr:" + key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function useCached<T>(url: string | null, opts: { persist?: boolean; refreshMs?: number } = {}) {
  const { persist = false, refreshMs } = opts;
  const [data, setData] = useState<T | undefined>(() => (url ? (memory.get(url) as T | undefined) : undefined));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const urlRef = useRef(url);
  urlRef.current = url;

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const d = await api<T>(url);
      memory.set(url, d);
      if (persist) {
        try {
          sessionStorage.setItem("swr:" + url, JSON.stringify(d));
        } catch {}
      }
      if (urlRef.current === url) {
        setData(d);
        setError("");
      }
    } catch (e) {
      if (urlRef.current === url) setError((e as Error).message);
    } finally {
      if (urlRef.current === url) setLoading(false);
    }
  }, [url, persist]);

  useEffect(() => {
    if (!url) return;
    const cached = (memory.get(url) as T | undefined) ?? (persist ? readPersisted<T>(url) : undefined);
    setData(cached);
    reload();
    if (!refreshMs) return;
    const t = setInterval(() => document.visibilityState === "visible" && reload(), refreshMs);
    return () => clearInterval(t);
  }, [url, persist, refreshMs, reload]);

  return { data, error, loading, reload, setData };
}
