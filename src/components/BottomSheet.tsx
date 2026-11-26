"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * Height of the on-screen keyboard. iOS Safari does not shrink the layout when the keyboard opens,
 * so a sheet pinned to the bottom would hide under it — we lift the sheet by this amount instead.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

const CLOSE_DISTANCE = 90; // px dragged down to close

/**
 * Sheet that slides up from the bottom.
 * - Swipe the handle (or the sheet when scrolled to the top) down to close → calls onClose.
 *   Pass onClose={undefined} while something is saving to block closing.
 * - Tapping the dark backdrop also closes (unless `backdropClose` is false).
 * - ✕ button top-right (hidden while onClose is undefined, e.g. while saving).
 * - Stays above the on-screen keyboard on iOS.
 */
export default function BottomSheet({
  children,
  onClose,
  backdropClose = true,
  className = "",
  z = "z-50",
}: {
  children: React.ReactNode;
  onClose?: () => void;
  backdropClose?: boolean;
  className?: string;
  z?: string;
}) {
  const inset = useKeyboardInset();
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; active: boolean } | null>(null);
  const [dy, setDy] = useState(0);

  function onPointerDown(e: React.PointerEvent) {
    if (!onClose) return;
    const t = e.target as HTMLElement;
    // never hijack taps on controls, and only drag the body when it is scrolled to the top
    if (t.closest("input, textarea, select, button, a, [data-no-drag]")) return;
    const onHandle = !!t.closest("[data-sheet-handle]");
    if (!onHandle && (sheetRef.current?.scrollTop ?? 0) > 0) return;
    drag.current = { startY: e.clientY, active: true };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current?.active) return;
    const d = e.clientY - drag.current.startY;
    if (d > 0) {
      setDy(d);
      if (d > 8) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }

  function onPointerUp() {
    if (!drag.current) return;
    const close = dy > CLOSE_DISTANCE;
    drag.current = null;
    setDy(0);
    if (close) onClose?.();
  }

  return (
    <div
      className={`fixed inset-0 ${z} flex items-end bg-black/50 backdrop-blur-[2px]`}
      style={{ paddingBottom: inset }}
      onClick={() => backdropClose && onClose?.()}
    >
      <div
        ref={sheetRef}
        className={`animate-sheet relative mx-auto flex max-h-[92dvh] w-full max-w-2xl touch-pan-y flex-col gap-3 overflow-y-auto rounded-t-3xl bg-[#fffaf6] p-4 text-ink ${
          inset ? "pb-4" : "pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        } ${className}`}
        style={{
          maxHeight: inset ? `calc(100dvh - ${inset}px - 1rem)` : undefined,
          transform: dy ? `translateY(${dy}px)` : undefined,
          transition: dy ? "none" : "transform 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div data-sheet-handle className="-mx-4 -mt-4 flex shrink-0 cursor-grab justify-center pb-1 pt-2.5 active:cursor-grabbing" aria-hidden>
          <div className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-muted shadow-sm ring-1 ring-line active:bg-brand-50"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
