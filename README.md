# Freshly69 shirt checker 👕

ระบบยืนยันการรับเสื้อเฟรชชี่ มจพ. ปี 69 — เว็บแอปบนมือถือ **สำหรับสตาฟเท่านั้น**
สแกนบาร์โค้ดหลังบัตรนักศึกษา → เช็กว่าเป็นน้องในระบบ / คณะตรงโต๊ะ / ยังไม่เคยรับ → กดยืนยันแจก

- ใช้งาน: 2–4 และ 8–9 ธ.ค. 2569 เวลา 16:00–20:00 ใต้สนามกีฬาลอยฟ้า
- Stack: Next.js 15 (App Router) บน **Vercel** + Postgres บน **Supabase**

| เอกสาร | อ่านเมื่อ |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | อยากรู้ว่าระบบต้องทำอะไร และทำไม |
| [docs/PROGRESS.md](docs/PROGRESS.md) | อยากรู้ว่าทำอะไรไปแล้ว / เหลืออะไร / ขั้นต่อไป |
| [docs/QA.md](docs/QA.md) | จะทดสอบก่อนวันงาน (เช็กลิสต์ทีละข้อ) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | จะแก้โค้ด — โครงสร้างไฟล์ ข้อมูล ความปลอดภัย |
| [CLAUDE.md](CLAUDE.md) | กติกาสำหรับ AI (Claude Code) และคนที่มาทำต่อ |

## ⚠️ ข้อมูลส่วนบุคคล

repo นี้เป็น **public** — ห้าม commit ไฟล์รายชื่อนักศึกษา (`.xlsx`, `.csv`) หรือ key ใดๆ
`.gitignore` กันไว้แล้ว แต่ก่อน commit ให้ดู `git status` ทุกครั้ง

## ติดตั้งครั้งแรก (Setup)

1. **Supabase** → New project → เปิด **SQL Editor** → วางทั้งไฟล์ [`supabase/schema.sql`](supabase/schema.sql) → Run
2. **ตั้งค่า env** — คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API)
   - `SESSION_SECRET` สุ่ม 32+ ตัว: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ADMIN_PIN`, `STAFF_PIN` รหัสเริ่มต้น 6 หลัก (เปลี่ยนในหน้าแอดมินได้ทีหลัง)
3. **ติดตั้งและนำเข้ารายชื่อ**
   ```bash
   npm install
   npm run import -- "C:/path/to/Freshly69-shirt-checker.xlsx" --dry-run   # ตรวจก่อน ไม่อัปโหลด
   npm run import -- "C:/path/to/Freshly69-shirt-checker.xlsx"             # อัปโหลดจริง (แทนที่ตาราง students)
   ```
4. **รันในเครื่อง**: `npm run dev` → เปิด http://localhost:3000 (กล้องบนมือถือต้องใช้ https → ทดสอบกล้องบน Vercel Preview)
5. **Vercel** → Import repo นี้ → ใส่ env 5 ตัวเดียวกับข้อ 2 → Deploy
   ทุกครั้งที่ push เข้า `main` เว็บจะอัปเดตเอง

## โหมดทดสอบ
หน้า **/test** (แท็บ "ทดสอบ" ด้านล่าง) ใช้ตารางแยก `test_cases` / `test_distributions` — ไม่แตะข้อมูลจริง
เปิดใช้ครั้งแรก: รัน [`supabase/test-mode.sql`](supabase/test-mode.sql) ใน Supabase SQL Editor · วิธีทดสอบดู docs/QA.md หมวด T

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันเว็บในเครื่อง |
| `npm test` | unit test กติกาการแจก (ไม่ต้องมี DB) |
| `npm run check` | typecheck + lint + test + build — **รันก่อน push ทุกครั้ง** |
| `npm run import -- <xlsx> [--dry-run] [--force]` | นำเข้ารายชื่อ |

## ย้ายไป Supabase ของชมรม (วิธีที่ 2)

1. สร้างโปรเจกต์ใหม่ใน org ชมรม → รัน `supabase/schema.sql`
2. `npm run import -- <xlsx>` โดยใส่ URL/key ของโปรเจกต์ใหม่ใน `.env.local`
3. (ถ้าเริ่มแจกไปแล้ว) export ตาราง `distributions`, `logs`, `devices`, `settings` จากของเดิม → import เข้าของใหม่
4. Vercel → เปลี่ยน `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → Redeploy
