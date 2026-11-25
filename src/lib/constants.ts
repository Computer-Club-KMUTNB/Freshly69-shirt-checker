// Faculty keys are the sheet names of Freshly69-shirt-checker.xlsx. They are stored as-is in the DB.
export const FACULTIES = [
  { key: "วิศวะ", label: "คณะวิศวกรรมศาสตร์" },
  { key: "สถาปัต", label: "คณะสถาปัตยกรรมและการออกแบบ" },
  { key: "วิทยา", label: "คณะวิทยาศาสตร์ประยุกต์" },
  { key: "วทอ", label: "วิทยาลัยเทคโนโลยีอุตสาหกรรม" },
  { key: "พัฒอุต", label: "คณะพัฒนาธุรกิจและอุตสาหกรรม" },
  { key: "นานาชาติ", label: "วิทยาลัยนานาชาติ" },
  { key: "เทคโนโลยีสารสนเทศ", label: "คณะเทคโนโลยีสารสนเทศและนวัตกรรมดิจิทัล" },
  { key: "ครุ", label: "คณะครุศาสตร์อุตสาหกรรม" },
  { key: "TGGS", label: "บัณฑิตวิทยาลัยวิศวกรรมศาสตร์นานาชาติสิรินธร ไทย-เยอรมัน (TGGS)" },
] as const;

export type FacultyKey = (typeof FACULTIES)[number]["key"];

export const FACULTY_KEYS: string[] = FACULTIES.map((f) => f.key);

export const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL", "9XL"];

export const ISSUE_LABEL: Record<string, string> = {
  dup_same: "กรอกซ้ำ ไซส์ตรงกัน",
  dup_size: "กรอกซ้ำ ไซส์ไม่ตรง",
  dup_person: "รหัสเดียว 2 คน",
};

export const ACTION_LABEL: Record<string, string> = {
  unlock: "ปลดล็อก",
  unlock_fail: "ปลดล็อกไม่สำเร็จ",
  scan: "สแกน",
  search: "ค้นหา",
  confirm: "ยืนยันแจก",
  void: "ยกเลิก/แก้ไข",
  view_pending: "เปิดรายชื่อยังไม่รับ",
  settings: "แก้การตั้งค่า",
  reset: "เริ่มใหม่ (ล้างข้อมูลทดสอบ)",
};

export const TIMEZONE = "Asia/Bangkok";

/** Word the admin must type to wipe test data (Settings → เริ่มใหม่). */
export const RESET_WORD = "เริ่มใหม่";
