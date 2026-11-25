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
| `GET /api/stats` | staff | counts only |
| `GET /api/admin/pending?faculty=` | admin | names + phones (view is logged) |
| `GET /api/admin/issues` · `recent` · `logs` · `devices` | admin | |
| `GET/POST /api/admin/settings` | admin | PINs are stored hashed; never logged |

## Data model
- `students` — one row per form response (duplicates allowed). `issue_type` none/dup_same/dup_size/dup_person.
- `distributions` — one row per handout; undo = `voided_at`. Partial unique index → max one active per student
  (two phones confirming at once: second gets 409 "เพิ่งถูกยืนยันจากอีกเครื่อง").
- `logs` — append-only audit. `devices` — last seen info per device id. `login_attempts` — rate limit.
- `people` view — one row per student id (latest response, inferred faculty) used for counts.

## Performance notes
- Vercel functions are pinned to `hnd1` (Tokyo) in vercel.json because the Supabase project is in ap-northeast-1. Keep them in the same region.
- Audit writes use `after()` so they never delay the response. Settings are cached 15 s per instance.
- Pages use `useCached` (stale-while-revalidate). Only count data is persisted to sessionStorage; names/phones stay in memory.

## Known limits
- Browsers cannot read a hardware id; the device id is random and stored in localStorage (lost if the
  browser data is cleared / incognito).
- Barcode WASM is fetched from jsDelivr on first camera open (needs internet once per phone).
- Torch / focus / zoom depend on the phone + browser; buttons disable themselves if unsupported.
- Supabase free projects pause after ~1 week idle — open the dashboard before event days.
