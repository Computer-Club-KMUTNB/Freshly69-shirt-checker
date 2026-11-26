import { describe, expect, it } from "vitest";
import { describeLog } from "./logtext";

describe("describeLog (Log tab ผล column)", () => {
  it("scan results in Thai", () => {
    expect(describeLog("scan", { result: "ok" })).toBe("พบข้อมูล แจกได้");
    expect(describeLog("search", { result: "not_freshman" })).toBe("ไม่ใช่ปี 1");
    expect(describeLog("scan", { result: "wrong_faculty" })).toBe("คณะไม่ตรง");
  });
  it("handouts", () => {
    expect(describeLog("confirm", { size: "L" })).toBe("แจกไซส์ L");
    expect(describeLog("void", { size: "M" })).toBe("ยกเลิกการแจกไซส์ M");
  });
  it("unlock shows the PIN label", () => {
    expect(describeLog("unlock", { pin: "ทีม A" })).toBe("ทีม A");
    expect(describeLog("unlock", { pin: null })).toBe("รหัสตั้งต้น / รหัสรายวัน");
  });
  it("settings changes", () => {
    expect(describeLog("settings", { changed: ["addPin:staff:ทีม A"] })).toBe("เพิ่มรหัสสตาฟ ทีม A");
    expect(describeLog("settings", { changed: ["togglePin:staff:ทีม A:off"] })).toBe("ปิดรหัสสตาฟ ทีม A");
    expect(describeLog("settings", { changed: ["togglePin:admin:env:on", "schedule"] })).toBe("เปิดรหัสแอดมิน รหัสตั้งต้น (Vercel), แก้วันเวลาเปิดระบบ");
    expect(describeLog("settings", { changed: ["removePin:admin:env"] })).toBe("ลบรหัสแอดมิน รหัสตั้งต้น (Vercel)");
  });
  it("reset and unknown", () => {
    expect(describeLog("reset", { distributions: 3, logs: 40 })).toBe("ลบการแจก 3 · Log 40");
    expect(describeLog("something", null)).toBe("");
  });
});
