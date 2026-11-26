# MetroFlow Security Presentation — Code & UI Map

Reference for the Part 3 security video presentation. Shows the exact code locations to display per segment, plus any UI that visually demonstrates each control.

> **Note:** Line numbers reflect the current workspace state. If they shift, search by function/class name.

---

## 1. System Architecture / Backend Structure — Lapating

**Talking points:** Client-server architecture; Driver Mobile App and LGU Dashboard communicate with FastAPI over HTTPS; backend handles auth, permissions, requests, and Supabase PostgreSQL/PostGIS; apps never connect directly to DB.

| What to show | File / lines | Why |
|---|---|---|
| FastAPI app, prod docs disabled, CORS, GZip, security headers | `backend/main.py:220-290` | Shows API boundary, CORS policy, middleware stack |
| DB engine/session from env | `backend/database.py:1-60` | DB connection is backend-owned, env-configured |
| Backend module split | `backend/auth_utils.py`, `backend/rate_limit.py`, `backend/reports.py`, `backend/audit.py` | Security concerns separated into modules |
| Models / migrations | `backend/models.py`, `backend/migrations/versions/` | Schema and security migrations live in backend |

**UI / visual:** No live app screen required. Show an architecture diagram/slide and/or repo tree: `metroflow-mobile/`, `metroflow-admin/`, `backend/`.

---

## 2. Authentication / Login Endpoint — Lapating

**Talking points:** bcrypt password hashing; stored hash, not plain text; login checks submitted password against hash; successful auth issues HS256 JWT; token sent on protected endpoints and verified.

| What to show | File / lines | Why |
|---|---|---|
| Login endpoint, rate-limited, bcrypt check, role gate, JWT issued | `backend/main.py:1077-1125` | Full login flow |
| Password hashing on user creation/seed | `backend/main.py:1238`, `backend/main.py:1302` (search nearby) | Shows bcrypt `hashpw/gensalt` at write time |
| JWT config, create/decode, current user | `backend/auth_utils.py:1-80` | `SECRET_KEY`, `HS256`, `create_access_token()`, `get_current_user()`, 401 handling |

**UI / visual:**
- Admin login: `metroflow-admin/app/login/page.tsx`
- Mobile login/entry: `metroflow-mobile/src/app/index.tsx` (confirm exact screen in current build)

---

## 3. Role-Based Access Control — Lapating

**Talking points:** Protected routes declare allowed roles; approve reports, publish hazards, assign rescue units, manage users require appropriate permissions; public driver gets HTTP 403; backend checks permissions, not just hidden UI buttons.

| What to show | File / lines | Why |
|---|---|---|
| Role dependency factory, 401 vs 403 | `backend/auth_utils.py:47-80` | `require_roles()`; authn/authz separation |
| Role dependency wiring | `backend/main.py:29,130-132` | `require_admin`, `require_super_admin` |
| Protected route examples | `backend/main.py:1261+` (users), `1542+` (publish hazard), `2089+` (assign SOS) | `Depends(require_admin)` on privileged actions |
| Explicit 403 responses | `backend/main.py:1098,1219,1344,1414` (representative) | Shows backend-enforced denial |

**UI / visual:**
- Admin User Management: `metroflow-admin/app/users/page.tsx`
- Any admin-gated action (triage/moderation/fleet) shows UI gating, but demonstrate a 403 in Network tab/Postman to prove backend enforcement.

---

## 4. PostgreSQL RLS / Database Security — Siah

**Talking points:** RLS policies prevent unauthorized DB roles from reading/modifying application tables; tests check unauthenticated roles cannot access protected data.

| What to show | File / lines | Why |
|---|---|---|
| Base RLS migration | `backend/migrations/versions/a1b2c3d4e5f6_enable_row_level_security.py` | Enables RLS, no-policy deny, privilege revoke |
| Later RLS coverage | `backend/migrations/versions/f3b7d9a1c562_enable_rls_on_sensor_tables.py`, `backend/migrations/versions/a4c8e2d6b917_enable_rls_on_reports_and_event_log.py` | New tables also protected |
| CI guard test | `backend/tests/test_api_integration.py:2209-2235` | `test_every_public_table_has_row_level_security` fails if any public table lacks RLS |

**UI / visual:** No end-user UI. Show passing test, migration, or Supabase dashboard RLS/table view.

---

## 5. Rate Limiting / 429 — Siah

**Talking points:** Fixed-window per account/device counters backed by DB, so limits hold across server instances; login 15/min, report submissions 12/min; over-limit gets HTTP 429 with `Retry-After`.

| What to show | File / lines | Why |
|---|---|---|
| Rate limit implementation | `backend/rate_limit.py:70-150` | `consume()`, DB counter, `429`, `Retry-After`, fail-open warning |
| Limit configuration | `backend/config.py:81-90` | `rate_limit_login_per_min=15`, `rate_limit_reports_per_min=12`, etc. |
| Endpoint wiring | `backend/main.py:1077` (login), `1503` (SOS), `3858` (reports), `1192` (register) | `Depends(rate_limit(...))` |

**UI / visual:** No dedicated screen. Show 429 response in browser DevTools/Postman after repeated requests; show form error if surfaced.

---

## 6. Security Middleware / API Configuration — Siah

**Talking points:** Protective HTTP headers; prevent content-type sniffing, restrict framing, control referrer; HTTPS between apps and backend; sensitive credentials via env vars, not committed.

| What to show | File / lines | Why |
|---|---|---|
| CORS, GZip, security headers middleware | `backend/main.py:236-280` | `nosniff`, `Cross-Origin-Resource-Policy`, `Referrer-Policy`, `X-Frame-Options: DENY` |
| Env-based config | `backend/config.py` (settings), `.env` pattern / `.env.example` | Secrets from env vars; do **not** show real secrets |
| Docs disabled in prod | `backend/main.py:220-235` | `docs_url/redoc_url=None` in production |

**UI / visual:** No app UI. Show response headers in browser Network tab; show redacted env/config.

---

## 7. Report Upload / Image Processing — Siah

**Talking points:** File validation checks type and size; uploaded images re-encoded; EXIF stripped from served image; EXIF can contain capture/location info.

| What to show | File / lines | Why |
|---|---|---|
| Report upload flow | `backend/main.py:3854-4005` | Multipart upload, read EXIF, strip/re-encode, store sanitized bytes |
| MIME sniff, digest, EXIF strip | `backend/reports.py:100-170` | Byte-signature type check, SHA-256 digest, Pillow re-encode strips embedded EXIF; warning fallback |
| EXIF extraction | `backend/reports.py:215-360` | Selected EXIF parsed for moderation/evidence |

**UI / visual:**
- Mobile report submission: `metroflow-mobile/src/app/(tabs)/report.tsx`
- Admin evidence review: `metroflow-admin/app/moderation/page.tsx`, `metroflow-admin/components/report-desk.tsx`

**Caveat to say out loud:** Selected EXIF fields may be extracted and stored for moderation; embedded EXIF is removed from the stored/served image file. If Pillow cannot re-encode a sniffed-valid image, code logs a warning and stores original bytes.

---

## 8. Driver Location / Telemetry Privacy — Aa

**Talking points:** Live vehicle pings rounded to ~50 m grid before storage; flood report submitter stored as salted hash, never user ID; device-ID hashing and fixed retention window designed but not yet implemented.

| What to show | File / lines | Why |
|---|---|---|
| Telemetry rounding | `backend/main.py:2635-2705` | `TELEMETRY_GRID_DEG=0.0005`, `_round_to_grid()`, rounded before save; comment states design gaps |
| Reporter hash | `backend/reports.py:68-95` | Salted SHA-256 of `salt:user_id`, no raw identity |
| Report stores hash | `backend/models.py` (`IncidentReport.reporter_hash`), `backend/schemas.py` / response | Hash stored/returned, not user ID |
| Tests (optional) | `backend/tests/test_api_integration.py:1395-1435`, `backend/tests/test_reports.py:68-80` | Rounding and hash behavior pinned |

**UI / visual:**
- Mobile: `metroflow-mobile/src/app/(tabs)/report.tsx` captures GPS; map/route flows send location.
- Admin: fleet/triage/radar views show vehicle positions (rounded data). Moderation/report desk shows `reporter_hash`, not driver identity.

**Caveat to say out loud:** Device-ID hashing and enforced 24h location-retention purge are design requirements (NFR-021/BRULE-013) but not fully implemented.

---

## 9. Audit Log / Verification — Gab

**Talking points:** Privileged actions recorded in audit logs; includes actor, timestamp, action details, hash signature; hash helps verify whether chain changed; useful for post-incident review.

| What to show | File / lines | Why |
|---|---|---|
| Audit chain implementation | `backend/audit.py:1-120` | Canonical digest, previous-hash chaining, `record()` |
| Audit model | `backend/models.py` (`AuditLog`, around line 106+) | Actor/action/payload/hash/timestamp fields |
| Audit API | `backend/main.py:2900-2975` | `GET /api/v1/audit`, `GET /api/v1/audit/verify` recomputes chain, `GET /api/v1/audit/export` |
| Example write site | Search `audit.record(...)` in `backend/main.py` (e.g., hazard/report/user actions) | Shows privileged action creates audit row |

**UI / visual:**
- Admin export: `metroflow-admin/app/export/page.tsx`, `metroflow-admin/lib/export.ts` (audit CSV export).
- No dedicated audit-verify screen found; show `/api/v1/audit/verify` JSON response in browser/Postman.

---

## Presentation Risks / Honesty Checks

- **Do not claim** EXIF is fully removed from the system; selected EXIF may be stored in `report.exif` for moderation.
- **Do not claim** device-ID hashing or 24-hour location retention purge is implemented; they are design/planned (NFR-021/BRULE-013).
- **Do not show secrets** from `.env` or deployment dashboards.
- **RLS caveat:** API connects as an app role/owner behavior per migrations; explain carefully if asked — RLS protects exposed DB roles/PostgREST path, tests guard table coverage. 
