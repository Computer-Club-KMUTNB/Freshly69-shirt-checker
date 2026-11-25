/**
 * Only rear cameras: a card barcode is never scanned with the selfie camera.
 * Labels look like "Back Camera" / "Back Ultra Wide Camera" (iOS) or "camera2 0, facing back" (Android).
 * If no label says back/rear, fall back to everything that does not say front.
 */
export function backCameras(all: MediaDeviceInfo[]): MediaDeviceInfo[] {
  const back = all.filter((d) => /back|rear|environment|หลัง/i.test(d.label));
  if (back.length) return back;
  return all.filter((d) => !/front|user|face ?time|หน้า/i.test(d.label));
}

/**
 * Index of the lens to open by default: the one most likely to give a sharp, close-up barcode.
 * 1. the lens this phone used last time (saved when staff switch lenses), if it still exists;
 * 2. iPhone virtual cameras (Triple / Dual Wide / Dual) — they auto-switch to macro up close;
 * 3. the plain main lens ("Back Camera" on iOS, the lowest "camera2 N" on Android);
 * never ultra-wide / telephoto / depth lenses unless nothing else exists.
 */
export function pickMainCamera(back: MediaDeviceInfo[], savedId?: string | null): number {
  if (back.length === 0) return -1;
  if (savedId) {
    const i = back.findIndex((d) => d.deviceId === savedId);
    if (i >= 0) return i;
  }
  const score = (label: string): number => {
    const l = label.toLowerCase();
    if (/triple/.test(l)) return 100;
    if (/dual wide/.test(l)) return 90;
    if (/dual/.test(l)) return 80;
    if (/ultra|wide|tele|depth|macro|infrared|\bir\b|tof/.test(l)) return 5;
    if (/^back camera$|^rear camera$|กล้องหลัง$/.test(l.trim())) return 70;
    const n = l.match(/camera2? ?(\d+)/);
    if (n) return 60 - Math.min(Number(n[1]), 50);
    return 30;
  };
  let best = 0;
  back.forEach((d, i) => {
    if (score(d.label) > score(back[best].label)) best = i;
  });
  return best;
}
