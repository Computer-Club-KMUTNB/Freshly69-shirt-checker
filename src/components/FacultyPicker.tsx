"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import { FACULTIES } from "@/lib/constants";

const short = (k: string) => (k === "เทคโนโลยีสารสนเทศ" ? "ไอที" : k);

/** "คณะ: …" button that opens a popup list of faculties (+ "ทั้งหมด"). value "" = all faculties. */
export default function FacultyPicker({ value, onChange, allowAll = true }: { value: string; onChange: (f: string) => void; allowAll?: boolean }) {
  const [open, setOpen] = useState(false);
  const options = [...(allowAll ? [{ key: "", label: "ทุกคณะ" }] : []), ...FACULTIES];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="input flex items-center justify-between gap-2 text-left text-base">
        <span className="min-w-0 truncate">
          <span className="text-muted">คณะ: </span>
          <b>{value ? FACULTIES.find((f) => f.key === value)?.label ?? value : "ทุกคณะ"}</b>
        </span>
        <ChevronDown size={18} className="shrink-0 text-muted" />
      </button>

      {open && (
        <BottomSheet onClose={() => setOpen(false)}>
          <h3 className="pr-11 text-lg font-bold">เลือกคณะที่จะดู</h3>
          <div className="flex flex-col gap-2">
            {options.map((f) => (
              <button
                key={f.key || "all"}
                onClick={() => {
                  onChange(f.key);
                  setOpen(false);
                }}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] ${
                  value === f.key ? "border-brand-400 bg-brand-50 ring-2 ring-brand-100" : "border-line bg-white"
                }`}
              >
                <span>
                  <span className="block font-bold">{f.key ? short(f.key) : "ทั้งหมด"}</span>
                  <span className="block text-xs text-muted">{f.label}</span>
                </span>
                {value === f.key && <Check size={20} className="shrink-0 text-brand-600" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
