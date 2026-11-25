"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- torch/zoom/focus are not in the TS DOM types yet */
import { useCallback, useEffect, useRef, useState } from "react";
import { BarcodeDetector } from "barcode-detector/ponyfill";
import { Flashlight, FlashlightOff, Keyboard, Loader2, SwitchCamera, X, ZoomIn } from "lucide-react";
import { normalizeStudentId } from "@/lib/rules";

interface Props {
  /** Called once per card. Scanning pauses while `paused` is true (result sheet open). */
  onDetect: (studentId: string) => void;
  onManual: () => void;
  onClose: () => void;
  paused: boolean;
  /** Faculty desk shown in the top bar. */
  faculty: string;
  /** A lookup is in flight → show a spinner over the video. */
  busy?: boolean;
}

// The KMUTNB card barcode is (probably) Code 128 holding the 13-digit id. We accept the other common
// 1-D formats too, so it still works if that guess is wrong.
const FORMATS = ["code_128", "code_39", "code_93", "codabar", "itf", "ean_13"] as const;

/**
 * Full-screen camera. Keeps running between students. Buttons: flash, switch lens, zoom,
 * tap-to-focus, type the id instead, close. Requires the same code twice in a row before
 * accepting it, to avoid misreads.
 */
export default function Scanner({ onDetect, onManual, onClose, paused, faculty, busy = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const pausedRef = useRef(paused);
  const lastRef = useRef<{ code: string; n: number }>({ code: "", n: 0 });
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camIndex, setCamIndex] = useState(-1); // -1 = let the browser pick the back camera
  const [caps, setCaps] = useState<any>({});
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [focusDot, setFocusDot] = useState<{ x: number; y: number } | null>(null);

  pausedRef.current = paused;

  const track = () => streamRef.current?.getVideoTracks()[0];

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // start / restart the camera when the chosen lens changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      stop();
      setError("");
      try {
        const deviceId = camIndex >= 0 ? cameras[camIndex]?.deviceId : undefined;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const t = stream.getVideoTracks()[0];
        const c: any = t.getCapabilities?.() ?? {};
        setCaps(c);
        setTorch(false);
        setZoom(c.zoom ? (t.getSettings() as any).zoom ?? c.zoom.min : null);
        if (c.focusMode?.includes("continuous")) t.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] }).catch(() => {});
        // device labels are only available after permission is granted
        if (cameras.length === 0) {
          const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
          setCameras(all);
        }
      } catch (e) {
        setError(
          (e as Error).name === "NotAllowedError"
            ? "ไม่ได้รับอนุญาตให้ใช้กล้อง — เปิดสิทธิ์กล้องในการตั้งค่าเบราว์เซอร์ แล้วลองใหม่"
            : "เปิดกล้องไม่ได้: " + (e as Error).message,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camIndex]);

  useEffect(() => stop, [stop]);

  // detection loop
  useEffect(() => {
    detectorRef.current ??= new BarcodeDetector({ formats: [...FORMATS] });
    let alive = true;
    let busy = false;
    const timer = setInterval(async () => {
      const v = videoRef.current;
      if (!alive || busy || pausedRef.current || !v || v.readyState < 2) return;
      busy = true;
      try {
        const codes = await detectorRef.current!.detect(v);
        for (const c of codes) {
          const id = normalizeStudentId(c.rawValue);
          if (!id) continue;
          const last = lastRef.current;
          lastRef.current = last.code === id ? { code: id, n: last.n + 1 } : { code: id, n: 1 };
          if (lastRef.current.n >= 2) {
            lastRef.current = { code: "", n: 0 };
            navigator.vibrate?.(80);
            onDetect(id);
          }
          break;
        }
      } catch {
        /* a frame failed to decode — ignore */
      } finally {
        busy = false;
      }
    }, 150);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [onDetect]);

  async function toggleTorch() {
    const t = track();
    if (!t) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch } as any] });
      setTorch(!torch);
    } catch {
      setError("เครื่องนี้เปิดแฟลชจากเว็บไม่ได้");
    }
  }

  function switchLens() {
    if (cameras.length < 2) return;
    setCamIndex((i) => (i + 1) % cameras.length);
  }

  async function changeZoom(z: number) {
    setZoom(z);
    await track()?.applyConstraints({ advanced: [{ zoom: z } as any] }).catch(() => {});
  }

  async function tapToFocus(e: React.PointerEvent<HTMLVideoElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setFocusDot({ x: e.clientX - r.left, y: e.clientY - r.top });
    setTimeout(() => setFocusDot(null), 700);
    const t = track();
    if (!t) return;
    const c: any = caps;
    const adv: any = {};
    if (c.focusMode?.includes("single-shot")) adv.focusMode = "single-shot";
    else if (c.focusMode?.includes("manual")) adv.focusMode = "continuous";
    if ("pointsOfInterest" in (t.getSettings() as any) || c.focusMode) adv.pointsOfInterest = [{ x, y }];
    await t.applyConstraints({ advanced: [adv] }).catch(() => {});
    // go back to continuous after the single shot
    if (adv.focusMode === "single-shot" && c.focusMode?.includes("continuous")) {
      setTimeout(() => t.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] }).catch(() => {}), 1500);
    }
  }

  const hasTorch = !!caps.torch;
  const lensName = camIndex >= 0 ? cameras[camIndex]?.label || `กล้อง ${camIndex + 1}` : "กล้องหลัง";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" onPointerDown={tapToFocus} />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <span className="rounded-full bg-brand-500 px-3 py-1 text-sm font-bold shadow-lg">โต๊ะ {faculty}</span>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur" aria-label="ปิดกล้อง">
            <X size={22} />
          </button>
        </div>

        {/* aiming frame for a 1-D barcode */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-32 w-[86%] max-w-md rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
              <span key={c} className={`absolute h-7 w-7 border-brand-400 ${c}`} />
            ))}
            {!paused && <span className="animate-scanline absolute inset-x-3 h-0.5 rounded-full bg-brand-400 shadow-[0_0_12px_2px_rgb(251_146_60/0.9)]" />}
          </div>
          <p className="absolute bottom-6 rounded-full bg-black/50 px-4 py-1.5 text-sm backdrop-blur">
            เล็งบาร์โค้ดหลังบัตรให้อยู่ในกรอบ · แตะจอเพื่อโฟกัส
          </p>
        </div>

        {focusDot && (
          <div className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-300" style={{ left: focusDot.x, top: focusDot.y }} />
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-brand-700 shadow-lg">
              <Loader2 size={18} className="animate-spin" /> กำลังค้นหา...
            </span>
          </div>
        )}
        {error && <p className="absolute inset-x-4 top-20 rounded-2xl bg-red-600/95 p-3 text-center text-sm">{error}</p>}
      </div>

      {zoom != null && caps.zoom && caps.zoom.max > caps.zoom.min && (
        <label className="flex items-center gap-3 bg-black px-5 pt-3 text-sm">
          <ZoomIn size={18} className="text-white/70" />
          <input type="range" className="flex-1 accent-orange-500" min={caps.zoom.min} max={Math.min(caps.zoom.max, 8)} step={caps.zoom.step || 0.1} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} />
          <span className="w-10 text-right tabular-nums">{zoom.toFixed(1)}x</span>
        </label>
      )}

      <div className="grid grid-cols-3 gap-3 bg-black px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
        <CtrlButton onClick={toggleTorch} disabled={!hasTorch} active={torch} label={hasTorch ? (torch ? "ปิดแฟลช" : "แฟลช") : "ไม่มีแฟลช"}>
          {torch ? <FlashlightOff size={24} /> : <Flashlight size={24} />}
        </CtrlButton>
        <CtrlButton onClick={switchLens} disabled={cameras.length < 2} label="เปลี่ยนเลนส์" title={lensName}>
          <SwitchCamera size={24} />
        </CtrlButton>
        <CtrlButton onClick={onManual} label="พิมพ์รหัส">
          <Keyboard size={24} />
        </CtrlButton>
      </div>
    </div>
  );
}

function CtrlButton({ children, label, active, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button {...p} className="flex flex-col items-center gap-1.5 text-xs font-medium text-white/85 disabled:opacity-35">
      <span className={`grid h-14 w-14 place-items-center rounded-full transition active:scale-90 ${active ? "bg-brand-500 text-white" : "bg-white/15"}`}>{children}</span>
      {label}
    </button>
  );
}
