// Human-readable Thai text for the Log tab's "ผล" column. Pure → unit-tested in logtext.test.ts.

export const RESULT_LABEL: Record<string, string> = {
  ok: "พบข้อมูล แจกได้",
  dup_same: "กรอกซ้ำ ไซส์ตรง",
  dup_size: "ไซส์ไม่ตรง",
  dup_person: "รหัสเดียว 2 คน",
  not_found: "ไม่มีในระบบ",
  received: "รับไปแล้ว",
  wrong_faculty: "คณะไม่ตรง",
  not_freshman: "ไม่ใช่ปี 1",
  invalid: "รหัสผิดรูปแบบ",
};

const ROLE = (r: string) => (r === "admin" ? "แอดมิน" : r === "staff" ? "สตาฟ" : r);

/** "addPin:staff:ทีม A" / "togglePin:admin:env:off" / "schedule" → Thai */
function settingText(item: string): string {
  const [op, role, ...rest] = item.split(":");
  const tail = rest.join(":");
  const isEnv = tail === "env" || tail.startsWith("env:");
  const name = isEnv ? "รหัสตั้งต้น (Vercel)" : tail.replace(/:(on|off)$/, "");
  const state = /:on$/.test(item) ? "เปิด" : /:off$/.test(item) ? "ปิด" : "";
  switch (op) {
    case "addPin":
      return `เพิ่มรหัส${ROLE(role)} ${name}`;
    case "removePin":
      return `ลบรหัส${ROLE(role)} ${name}`;
    case "togglePin":
      return `${state}รหัส${ROLE(role)} ${name}`;
    case "staffPinDaily":
      return "ตั้งรหัสสตาฟรายวัน";
    case "askDeviceName":
      return "ตั้งช่องชื่อเล่น";
    case "schedule":
      return "แก้วันเวลาเปิดระบบ";
    case "adminPin":
      return "เปลี่ยนรหัสแอดมิน";
    case "staffPin":
      return "เปลี่ยนรหัสสตาฟ";
    default:
      return item;
  }
}

/** The "ผล" text for one log line. */
export function describeLog(action: string, detail: Record<string, unknown> | null | undefined): string {
  const d = detail ?? {};
  switch (action) {
    case "scan":
    case "search":
      return RESULT_LABEL[String(d.result)] ?? String(d.result ?? "");
    case "confirm":
      return d.size ? `แจกไซส์ ${d.size}` : "แจกแล้ว";
    case "void":
      return d.size ? `ยกเลิกการแจกไซส์ ${d.size}` : "ยกเลิกการแจก";
    case "unlock":
    case "reveal_pin":
      return d.pin ? String(d.pin) : action === "unlock" ? "รหัสตั้งต้น / รหัสรายวัน" : "";
    case "settings":
      return Array.isArray(d.changed) ? (d.changed as string[]).map(settingText).join(", ") : "";
    case "reset":
      return `ลบการแจก ${d.distributions ?? 0} · Log ${d.logs ?? 0}`;
    case "view_pending":
      return d.count != null ? `${d.count} คน` : "";
    default:
      return "";
  }
}
