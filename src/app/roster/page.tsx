"use client";

import Shell from "@/components/Shell";
import Roster from "@/components/Roster";

/** รายชื่อ: ยังไม่รับ · แจกล่าสุด · ปัญหา (staff + admin). */
export default function RosterPage() {
  return (
    <Shell>
      <h2 className="mb-3 px-1 text-xl font-bold">รายชื่อ</h2>
      <Roster />
    </Shell>
  );
}
