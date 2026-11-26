# Architecture

```
phone (browser) ──HTTPS──> Vercel: Next.js pages + API routes ──service role──> Supabase Postgres
                 cookie f69_session (JWT, httpOnly, expires Bangkok midnight)    RLS on, no policies
```

## Files
| Path | What |
|---|---|
| `supabase/schema.sql` | All tables, view `people`, functions `get_stats()` / `get_pending()`. Idempotent. |
| `scripts/import-students.ts` | Excel → `students` table. Learns id-prefix → faculty, classifies duplicates. |
| `src/lib/rules.ts` | **Business rules** (pure): `evaluate()` = popup status, `validateConfirm()`, `classifyGroup()`. |
| `src/lib/stats.ts` | Pure aggregation for the overview page. |
| `src/lib/session.ts` | JWT cookie, `requireSession(role)`, opening-hours check, `writeLog()`, `route()` error wrapper. |
| `src/lib/pin.ts` | scrypt PIN hashing, daily PIN derivation. |
| `src/lib/pins.ts` | Several PINs per role: `matchPin()` (unlock), `newPin()` (add, rejects duplicates), never returns hashes. |
| `src/lib/settings.ts` | Settings row (`settings.key='app'`) with defaults. |
| `src/lib/lookup.ts` | Loads rows + active distribution for one id, then `evaluate()`. |
| `src/lib/client.ts` | Browser helpers: `api()` fetch wrapper, device id, localStorage. |
| `src/app/page.tsx` | Unlock screen. |
| `src/app/scan/page.tsx` | Faculty picker, camera button, manual input. |
| `src/components/Scanner.tsx` | Camera + barcode detection (`barcode-detector` ponyfill = ZXing WASM), torch/lens/zoom/focus. |
| `src/components/ResultSheet.tsx` | Status popup, size/person pickers, confirm, success + แก้ไข/เสร็จสิ้น. |
| `src/app/overview/page.tsx` | Counts dashboard (staff + admin), auto refresh 30 s. |
| `src/app/admin/page.tsx` | Tabs: ยังไม่รับ (names+phones), ปัญหา, แจกล่าสุด, Log, เครื่อง, ตั้งค่า. |

## API
| Route | Role | Notes |
|---|---|---|
| `POST /api/auth/unlock` | — | `{pin, deviceId, deviceName}` → cookie. Rate limited per IP. |
| `GET /api/auth/me` · `POST /api/auth/lock` | — | session info / log out |
| `POST /api/lookup` | staff | `{studentId, faculty, source}` → `LookupResult`; logs scan/search |
| `POST /api/distribute` | staff | `{studentId, faculty, rowId?, size?}` → re-validates, inserts |
| `POST /api/distribute/void` | staff | `{distributionId}` → sets `voided_at` (แก้ไข) |
| `GET /api/stats` | staff | counts only (overview + สรุปผล text/CSV built client-side in `stats.ts`) |
| `GET /api/roster/pending?faculty=` | staff | not-received list with names + phones ("รายชื่อ" page) |
| `GET /api/roster/recent?faculty=` | staff | latest 100 handouts |
| `GET /api/roster/issues` | staff | duplicate-id problem list |
| `GET /api/admin/logs` | admin | handout log (scan/search, confirm, void) |
| `GET/POST /api/admin/settings` | admin | PINs are stored hashed; never logged |
| `POST /api/admin/reset` | admin | `{confirm:"เริ่มใหม่"}` → deletes distributions, logs, devices, login_attempts (keeps students + settings); logs a `reset` line |

## Test mode (/test)
- Tables `test_cases` + `test_distributions` (supabase/test-mode.sql). APIs `/api/test/*` mirror the real ones
  but only touch those tables, write no logs, and require an admin PIN (the "ทดสอบ" tab is hidden for staff).
- A test case = one student id (e.g. a staff member's own year-3 card) + name, faculty, size, **year**
  (only year 1 may receive — overrides the 69-prefix rule) and **problem** (none / dup_same / dup_size /
  dup_person / received). `caseToRows()` turns it into the same rows the real rules use, so popups match.
- `ScanScreen` / `ResultSheet` take `apiBase` ("/api" or "/api/test"); the /test page reuses them.

## Data model
- `students` — one row per form response (duplicates allowed). `issue_type` none/dup_same/dup_size/dup_person.
- `distributions` — one row per handout; undo = `voided_at`. Partial unique index → max one active per student
  (two phones confirming at once: second gets 409 "เพิ่งถูกยืนยันจากอีกเครื่อง").
- `logs` — append-only audit: time, action, who (PIN label / nickname + role), faculty, student id, detail.
  Columns device_id / ip / user_agent still exist but are no longer written (cleared on 2026-11-26).
  Log tab: date-time range + action + student id filters; `src/lib/logtext.ts` turns detail into Thai. `login_attempts` — rate limit.
  `devices` — no longer written (device list page removed).
- `people` view — one row per student id (latest response, inferred faculty) used for counts.

## Performance notes
- Vercel functions are pinned to `sin1` (Singapore) in vercel.json because the club Supabase project is in ap-southeast-1. Keep them in the same region (moved from hnd1/Tokyo on 2026-11-26 with the move to the club Supabase).
- Audit writes use `after()` so they never delay the response. Settings are cached 15 s per instance.
- Pages use `useCached` (stale-while-revalidate). Only count data is persisted to sessionStorage; names/phones stay in memory.

## Security headers (next.config.ts)
X-Frame-Options DENY + CSP `frame-ancestors 'none'`, nosniff, Referrer-Policy no-referrer, Permissions-Policy (camera=self only), X-Robots-Tag noindex, `Cache-Control: no-store` on /api. No full CSP yet (barcode WASM comes from jsDelivr) — add one only after testing on real phones.

## Known limits
- Browsers cannot read a hardware id; the device id is random and stored in localStorage (lost if the
  browser data is cleared / incognito).
- Barcode WASM is fetched from jsDelivr on first camera open (needs internet once per phone).
- Torch / focus / zoom depend on the phone + browser; buttons disable themselves if unsupported.
- Supabase free projects pause after ~1 week idle — open the dashboard before event days.
