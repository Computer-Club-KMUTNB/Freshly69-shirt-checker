import { describe, expect, it } from "vitest";
import { dailyPin, hashPin } from "./pin";
import { ENV_ID, MAX_PINS_PER_ROLE, matchPin, newPin, pinStillValid, publicPins, usableAdminPins, type PinEntry, type PinSettings } from "./pins";

const SECRET = "s".repeat(40);
const env = { adminPin: "999999", staffPin: "888888", secret: SECRET, today: "2026-12-02" };
const entry = (pin: string, label: string, enabled = true): PinEntry => ({ id: label, label, hash: hashPin(pin), createdAt: "", enabled });
const settings = (o: Partial<PinSettings> = {}): PinSettings => ({ adminPins: [], staffPins: [], staffPinDaily: false, ...o });

describe("matchPin (several PINs per role)", () => {
  const s = settings({
    adminPins: [entry("111111", "บอส"), entry("222222", "แอดมินสอง")],
    staffPins: [entry("333333", "โต๊ะ 1"), entry("444444", "โต๊ะ 2", false)],
  });
  it("any admin PIN works and says whose it is", () => expect(matchPin("222222", s, env)).toEqual({ role: "admin", label: "แอดมินสอง", pinId: "แอดมินสอง" }));
  it("staff PIN works", () => expect(matchPin("333333", s, env)?.label).toBe("โต๊ะ 1"));
  it("a switched-off PIN does not work", () => expect(matchPin("444444", s, env)).toBeNull());
  it("wrong / malformed PIN", () => {
    expect(matchPin("555555", s, env)).toBeNull();
    expect(matchPin("12345", s, env)).toBeNull();
  });
  it("Vercel env PINs work until switched off (legacy 'removed' = off)", () => {
    expect(matchPin("999999", s, env)?.pinId).toBe(ENV_ID.admin);
    expect(matchPin("888888", s, env)?.pinId).toBe(ENV_ID.staff);
    expect(matchPin("999999", { ...s, envPins: { admin: "off" } }, env)).toBeNull();
    expect(matchPin("888888", { ...s, envPins: { staff: "removed" } }, env)).toBeNull();
  });
  it("daily staff PIN replaces the staff list", () => {
    const d = settings({ ...s, staffPinDaily: true });
    expect(matchPin(dailyPin(SECRET, "2026-12-02"), d, env)?.pinId).toBe("daily:2026-12-02");
    expect(matchPin("333333", d, env)).toBeNull();
    expect(matchPin("111111", d, env)?.role).toBe("admin");
  });
});

describe("pinStillValid (kick out when a PIN is removed / switched off)", () => {
  const s = settings({ adminPins: [entry("111111", "บอส")], staffPins: [entry("333333", "โต๊ะ 1")] });
  it("valid while the PIN is on", () => expect(pinStillValid("staff", "โต๊ะ 1", s, env)).toBe(true));
  it("invalid once switched off", () => expect(pinStillValid("staff", "โต๊ะ 1", settings({ ...s, staffPins: [entry("333333", "โต๊ะ 1", false)] }), env)).toBe(false));
  it("invalid once deleted", () => expect(pinStillValid("staff", "โต๊ะ 1", settings({ ...s, staffPins: [] }), env)).toBe(false));
  it("env PIN session ends when the env PIN is switched off", () => {
    expect(pinStillValid("admin", ENV_ID.admin, s, env)).toBe(true);
    expect(pinStillValid("admin", ENV_ID.admin, { ...s, envPins: { admin: "off" } }, env)).toBe(false);
  });
  it("old sessions without a PIN id are logged out", () => expect(pinStillValid("admin", undefined, s, env)).toBe(false));
  it("a staff PIN id cannot be used as admin", () => expect(pinStillValid("admin", "โต๊ะ 1", s, env)).toBe(false));
  it("turning on daily mode ends list-based staff sessions; daily session only for today", () => {
    const d = settings({ ...s, staffPinDaily: true });
    expect(pinStillValid("staff", "โต๊ะ 1", d, env)).toBe(false);
    expect(pinStillValid("staff", "daily:2026-12-02", d, env)).toBe(true);
    expect(pinStillValid("staff", "daily:2026-12-01", d, env)).toBe(false);
  });
});

describe("newPin / lists", () => {
  const s = settings({ adminPins: [entry("111111", "บอส")] });
  it("creates a hashed, enabled entry", () => {
    const p = newPin("staff", "654320", " โต๊ะ 3 ", s, env);
    expect(p).toMatchObject({ label: "โต๊ะ 3", enabled: true });
    expect(p.hash).not.toContain("654320");
  });
  it("rejects duplicates across roles and the env PINs", () => {
    expect(() => newPin("staff", "111111", "x", s, env)).toThrow("มีอยู่แล้ว");
    expect(() => newPin("staff", "999999", "x", s, env)).toThrow("Vercel");
  });
  it("needs 6 digits and a label", () => {
    expect(() => newPin("staff", "12ab56", "x", s, env)).toThrow();
    expect(() => newPin("staff", "654320", "  ", s, env)).toThrow();
  });
  it("caps the list", () => {
    const full = settings({ staffPins: Array.from({ length: MAX_PINS_PER_ROLE }, (_, i) => entry(String(100000 + i), `t${i}`)) });
    expect(() => newPin("staff", "765432", "x", full, env)).toThrow("สูงสุด");
  });
  it("counts usable admin PINs (list + env)", () => {
    expect(usableAdminPins(s, env)).toBe(2);
    expect(usableAdminPins({ ...s, envPins: { admin: "off" } }, env)).toBe(1);
  });
  it("public list shows the env PIN first, never a hash", () => {
    const pub = publicPins("admin", s, env);
    expect(pub[0]).toMatchObject({ id: ENV_ID.admin, env: true, enabled: true });
    expect(JSON.stringify(pub)).not.toContain(s.adminPins[0].hash);
  });
  it("env PIN can't be hidden: a legacy 'removed' one shows again, switched off", () => {
    const pub = publicPins("admin", { ...s, envPins: { admin: "removed" } }, env);
    expect(pub).toHaveLength(2);
    expect(pub[0]).toMatchObject({ id: ENV_ID.admin, env: true, enabled: false });
    expect(usableAdminPins({ ...s, envPins: { admin: "removed" } }, env)).toBe(1);
  });
  it("a switched-off env PIN still can't be reused as a new PIN", () => {
    expect(() => newPin("staff", "999999", "x", { ...s, envPins: { admin: "off" } }, env)).toThrow("Vercel");
  });
});

describe("reveal (admin 'show PIN' button)", () => {
  it("encrypt → decrypt round trip; wrong secret gives null", async () => {
    const { encryptPin, decryptPin } = await import("./pin");
    const e = encryptPin("123987", SECRET);
    expect(e).not.toContain("123987");
    expect(decryptPin(e, SECRET)).toBe("123987");
    expect(decryptPin(e, "x".repeat(40))).toBeNull();
  });
  it("new PINs can be revealed, old hash-only ones cannot", async () => {
    const { revealPin } = await import("./pins");
    const p = newPin("staff", "246810", "โต๊ะ 9", settings(), env);
    const s = settings({ staffPins: [p, entry("135791", "เก่า")] });
    expect(revealPin("staff", p.id, s, env)).toBe("246810");
    expect(revealPin("staff", "เก่า", s, env)).toBeNull();
    expect(publicPins("staff", s, env).find((x) => x.id === "เก่า")?.revealable).toBe(false);
  });
  it("env PIN is revealed from the environment (also when switched off)", async () => {
    const { revealPin } = await import("./pins");
    expect(revealPin("admin", ENV_ID.admin, settings(), env)).toBe("999999");
    expect(revealPin("admin", ENV_ID.admin, settings({ envPins: { admin: "removed" } }), env)).toBe("999999");
    expect(revealPin("staff", ENV_ID.admin, settings(), env)).toBeNull();
  });
});

describe("renamePin (edit admin / staff names)", () => {
  it("renames a list PIN and the unlock label follows", async () => {
    const { renamePin, currentPinLabel } = await import("./pins");
    const s = settings({ staffPins: [entry("333333", "โต๊ะ 1")] });
    const next = { ...s, ...renamePin("staff", "โต๊ะ 1", "  Staff ECE  ", s) };
    expect(next.staffPins[0].label).toBe("Staff ECE");
    expect(matchPin("333333", next, env)?.label).toBe("Staff ECE");
    expect(currentPinLabel("staff", "โต๊ะ 1", next)).toBe("Staff ECE");
  });
  it("renames a Vercel env PIN", async () => {
    const { renamePin, currentPinLabel, publicPins: pub } = await import("./pins");
    const s = settings();
    const next = { ...s, ...renamePin("admin", ENV_ID.admin, "JR", s) };
    expect(pub("admin", next, env)[0].label).toBe("JR");
    expect(matchPin("999999", next, env)?.label).toBe("JR");
    expect(currentPinLabel("admin", ENV_ID.admin, next)).toBe("JR");
  });
  it("rejects an empty name or unknown PIN", async () => {
    const { renamePin } = await import("./pins");
    expect(() => renamePin("staff", "x", "   ", settings())).toThrow();
    expect(() => renamePin("staff", "nope", "A", settings())).toThrow("ไม่พบ");
  });
});
