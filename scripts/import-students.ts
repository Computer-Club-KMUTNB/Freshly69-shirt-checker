/**
 * Load the student list from the cleaned Excel file into Supabase.
 *
 *   npm run import -- "C:/path/Freshly69-shirt-checker.xlsx" --dry-run   # check only, uploads nothing
 *   npm run import -- "C:/path/Freshly69-shirt-checker.xlsx"             # REPLACES the students table
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * The Excel file has personal data — keep it OUT of git (.gitignore blocks *.xlsx).
 *
 * Expected workbook: one sheet per faculty (sheet name = faculty key in src/lib/constants.ts),
 * columns as in the Google Form export:
 *   A ประทับเวลา | B อีเมล | C คำหน้านาม | D ชื่อ-สกุล | E รหัสนักศึกษา | ... | H เบอร์โทร | ... | J ไซส์
 */
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { FACULTY_KEYS } from "../src/lib/constants";
import { classifyGroup, normalizeStudentId, type IssueType } from "../src/lib/rules";

const COL = { time: 1, email: 2, title: 3, name: 4, id: 5, phone: 8, size: 10 };

interface Row {
  student_id: string;
  title: string | null;
  full_name: string;
  form_faculty: string;
  id_faculty: string | null;
  size: string;
  phone: string | null;
  submitted_at: string | null;
  issue_type: IssueType;
}

function text(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "text" in v) return String(v.text);
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v);
}

/** Excel stores the form timestamp as a Bangkok wall-clock time without zone. */
function toIso(v: ExcelJS.CellValue): string | null {
  if (!(v instanceof Date)) return null;
  // exceljs reads the wall-clock value as if it were UTC → shift by -7h to get the real instant
  return new Date(v.getTime() - 7 * 3600_000).toISOString();
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dry = args.includes("--dry-run");
  if (!file) throw new Error('Usage: npm run import -- "<path to xlsx>" [--dry-run]');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const rows: Row[] = [];
  const problems: string[] = [];
  for (const ws of wb.worksheets) {
    if (!FACULTY_KEYS.includes(ws.name)) {
      problems.push(`skip sheet "${ws.name}" (not a faculty key)`);
      continue;
    }
    ws.eachRow((r, i) => {
      if (i === 1) return;
      const email = text(r.getCell(COL.email).value).trim();
      if (!email) return;
      const fromMail = normalizeStudentId(email.match(/^s(\d{13})@/i)?.[1] ?? "");
      const fromCell = normalizeStudentId(text(r.getCell(COL.id).value).replace(/\.0$/, ""));
      const studentId = fromCell ?? fromMail;
      if (!studentId) {
        problems.push(`${ws.name} row ${i}: no valid student id`);
        return;
      }
      if (fromMail && fromCell && fromMail !== fromCell) problems.push(`${ws.name} row ${i}: id ≠ e-mail (using id column)`);
      rows.push({
        student_id: studentId,
        title: text(r.getCell(COL.title).value).trim() || null,
        full_name: text(r.getCell(COL.name).value).replace(/\s+/g, " ").trim(),
        form_faculty: ws.name,
        id_faculty: null,
        size: text(r.getCell(COL.size).value).trim().toUpperCase(),
        phone: text(r.getCell(COL.phone).value).replace(/\u200b/g, "").trim() || null,
        submitted_at: toIso(r.getCell(COL.time).value),
        issue_type: "none",
      });
    });
  }

  // id prefix (first 4 digits) → faculty, learned from the data itself (majority vote)
  const votes = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const p = r.student_id.slice(0, 4);
    const m = votes.get(p) ?? new Map();
    m.set(r.form_faculty, (m.get(r.form_faculty) ?? 0) + 1);
    votes.set(p, m);
  }
  const prefixMap = new Map<string, string>();
  for (const [p, m] of votes) {
    const [best, n] = [...m].sort((a, b) => b[1] - a[1])[0];
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    if (total >= 5 && n / total >= 0.8) prefixMap.set(p, best); // only trust clear majorities with enough data
  }
  for (const r of rows) r.id_faculty = prefixMap.get(r.student_id.slice(0, 4)) ?? null;

  // duplicate classification
  const byId = new Map<string, Row[]>();
  for (const r of rows) byId.set(r.student_id, [...(byId.get(r.student_id) ?? []), r]);
  for (const group of byId.values()) {
    const t = classifyGroup(group);
    group.forEach((r) => (r.issue_type = t));
  }

  const count = (t: IssueType) => [...byId.values()].filter((g) => g[0].issue_type === t).length;
  console.log(`rows: ${rows.length}  people: ${byId.size}`);
  console.log(`issues: dup_same ${count("dup_same")}, dup_size ${count("dup_size")}, dup_person ${count("dup_person")}`);
  console.log("prefix → faculty:", Object.fromEntries(prefixMap));
  console.log(`rows without id_faculty: ${rows.filter((r) => !r.id_faculty).length}`);
  if (problems.length) console.log("notes:\n  " + problems.slice(0, 30).join("\n  ") + (problems.length > 30 ? `\n  ... +${problems.length - 30}` : ""));

  if (dry) {
    console.log("\n--dry-run: nothing uploaded.");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { count: given } = await sb.from("distributions").select("id", { count: "exact", head: true });
  if ((given ?? 0) > 0 && !args.includes("--force")) {
    throw new Error(`distributions already has ${given} rows. Re-importing would detach them from student rows. Add --force if you really mean it.`);
  }

  const del = await sb.from("students").delete().gte("id", 0);
  if (del.error) throw del.error;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("students").insert(rows.slice(i, i + 500));
    if (error) throw error;
    process.stdout.write(`\ruploaded ${Math.min(i + 500, rows.length)}/${rows.length}`);
  }
  console.log("\ndone ✓");
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
