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
