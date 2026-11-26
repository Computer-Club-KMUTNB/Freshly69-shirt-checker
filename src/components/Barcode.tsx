"use client";

import { useMemo } from "react";
import { toSVG } from "bwip-js/browser";

/** Code 128 barcode as inline SVG (same symbology we expect on the KMUTNB card). Digits only. */
export default function Barcode({ value, className = "" }: { value: string; className?: string }) {
  const svg = useMemo(() => {
    if (!/^\d{1,20}$/.test(value)) return "";
    try {
      return toSVG({
        bcid: "code128",
        text: value,
        scale: 3,
        height: 12,
        includetext: true,
        textxalign: "center",
        textsize: 11,
        paddingwidth: 12,
        paddingheight: 8,
        backgroundcolor: "FFFFFF",
      });
    } catch {
      return "";
    }
  }, [value]);
  if (!svg) return <div className={`text-sm text-red-600 ${className}`}>สร้างบาร์โค้ดไม่ได้</div>;
  // svg is generated locally from a digits-only string, so injecting it is safe
  return <div className={`[&>svg]:h-auto [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
