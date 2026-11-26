# CLAUDE.md — rules for AI agents and new contributors

Read this first, then `docs/PROGRESS.md` (what is done / next) and `docs/REQUIREMENTS.md` (why).
The project owner communicates in Thai; answer in Thai unless asked otherwise.

## What this is
Staff-only mobile web app to confirm KMUTNB freshman (year 69) shirt pickup. Next.js 15 App Router
on Vercel, Supabase Postgres. See README for setup.

## Hard rules (do not break)
1. **No student personal data in git.** Repo is PUBLIC. Never commit `.xlsx/.csv`, real names,
   phone numbers, e-mails or student ids — including in docs, tests, fixtures, commit messages,
   PR text. Tests use fake people only. Run `git status` / `git diff --cached` before every commit.
2. **No secrets in code.** `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, PINs live only in
   `.env.local` and Vercel env vars.
3. **Browser never talks to Supabase.** All tables have RLS on with no policies; only API routes
   (`src/app/api/**`, using `src/lib/db.ts` service client) read/write. Don't add `NEXT_PUBLIC_SUPABASE_*`.
4. **Every API route starts with `requireSession(role)`** (`src/lib/session.ts`) and is wrapped in `route()`.
   Staff endpoints must never return names/phones of anyone except the student being scanned.
   Exception (owner's decision 26/11): the "รายชื่อ" page — not received (names + phones), latest handouts,
   duplicate-id problems (`/api/roster/*`) — is open to staff too. Logs + settings stay admin only (`/api/admin/*`).
5. **Rules live in `src/lib/rules.ts` (pure, unit-tested).** API routes re-run them server side on
   confirm — never trust what the phone sends. Add/adjust tests in `rules.test.ts` with any rule change.
6. **Log every action** with `writeLog()` (scan, search, confirm, void, unlock, view_pending, settings).
   Never log PINs.
7. Before pushing: `npm run check` (typecheck + lint + test + build) must pass. Then update
   `docs/PROGRESS.md` (what changed, what's next) and, if behaviour changed, `docs/QA.md`.
8. Work goes straight to `main` (owner's choice); Vercel deploys `main` to production.

## Decisions already made (don't re-ask)
- Login: 6-digit PINs. Admin and staff each have a LIST of PINs (max 10 each, labelled e.g. "โต๊ะ 1";
  label is shown in the header and logged). Each PIN can be switched on/off or deleted; ADMIN_PIN / STAFF_PIN
  from Vercel show as list items too (off / removed is stored in settings.envPins). The session stores `pinId`;
  `validSession()` re-checks it on every request, so a removed / switched-off PIN logs its users out
  (pages poll /api/auth/me every 30 s). The last usable admin PIN can't be removed / switched off.
  PINs are stored as scrypt hash (for unlock) + AES-GCM `enc` keyed from SESSION_SECRET so admins can reveal
  them (`/api/admin/pins/reveal`, logged as reveal_pin). Changing SESSION_SECRET makes old `enc` unreadable.
  (Older single-PIN settings are migrated automatically.) Two roles (admin / staff). Unlock once per day (cookie expires at Bangkok
  midnight). Admin can switch staff PIN to "changes daily" (derived from SESSION_SECRET).
  5 wrong PINs per IP → 5 min lock.
- No per-person accounts. Logs keep only: time, action, who (PIN label / nickname + role), faculty,
  student id, result. NO device id / IP / browser (owner: not needed). Pending-list views are not logged.
  login_attempts keeps IP for the 5-min lockout and is pruned after 1 day. The "devices" list page was removed (owner: not useful); the `devices` table is unused.
- Staff picks the faculty desk before scanning. Faculty mismatch → blocked, tell student to go to
  the right faculty. Correct faculty = inferred from student-id prefix (import script learns the
  mapping, needs ≥5 samples & ≥80% majority), else the form they filled.
- Only freshmen: student id must start with `69` (`FRESHMAN_PREFIX` in rules.ts). Others → `not_freshman`
  popup, cannot receive, and are excluded from counts / pending list (SQL `like '69%'`).
- Scan/search is logged immediately, but the shirt counts as given **only after ยืนยันแจก**.
- After confirm: success message + [แก้ไข] (voids the distribution, re-opens the card, no time
  limit) + [เสร็จสิ้น] (back to camera, camera stays open).
- Duplicate student ids (32 in the data) are NOT cleaned in the data; the app warns staff:
  - `dup_same` same size → tell student, give if faculty matches.
  - `dup_size` sizes differ → tell student, staff picks the size the student wants.
  - `dup_person` two names on one id → check name on the card, pick that person.
  The admin "ปัญหา" tab marks a case "แก้แล้ว" automatically once a shirt is given.
- Names without surname / malformed phone numbers are shown as typed (no cleanup).
- Overview = counts only (total, received, remaining by gender / size / faculty) + "สรุปผล" button
  (copy text for a chat group / CSV per faculty × size — counts only).
- Bottom nav: staff = สแกน · ภาพรวม · รายชื่อ; admin = สแกน · ภาพรวม · รายชื่อ · ทดสอบ · แอดมิน (Log, ตั้งค่า).
  "รายชื่อ" (`components/Roster.tsx`) = tabs ยังไม่รับ / แจกล่าสุด / ปัญหา + faculty popup (`FacultyPicker`) + search.
- Log = handouts only: scan/search, confirm, void by STAFF. Admin actions are not logged (writeLog skips
  role admin); unlocks are not logged; the Log tab only shows those 3 kinds (filter: สแกน/ค้นหา, ยืนยันแจก, ยกเลิก/แก้ไข).
- Opening hours restriction is an admin toggle (default off; admin always allowed).
- Camera: flash (torch via `applyConstraints`, works on Android Chrome and recent iOS Safari —
  verify on a real iPhone), lens switch, zoom, tap-to-focus where supported, manual id input.
  Card barcode = 13-digit student id, probably Code 128 (unverified → QA item).

## Test mode
`/test` + `/api/test/*` are ADMIN-ONLY and must NEVER read or write the real tables (students, distributions, logs, devices).
Keep the test APIs in sync with the real ones when rules change (they share `rules.ts`, `ScanScreen`, `ResultSheet`).

## Where things are
See `docs/ARCHITECTURE.md`.
