# MetroFlow - Consolidated Backlog

**Revised:** 9 November 2026 · **Baseline:** `main` at `4e9107f` (PR #76; #72–#74 merged)
**Method:** cross-checked FSD status table, TSD §7, PM plan, PROGRESS_REPORT, FEATURES_AND_DELIVERABLES,
UI_POLISH_BACKLOG, CI workflows, branches, the hosted database and the code. Items marked *(unverified)* were not run.

## Done since the first revision

| Item | Result |
|------|--------|
| Offline report queue, SQLite cache, `client_id` idempotency | Merged (#44, #45). Migration applied to Supabase |
| Portal loading/error/offline states; broken `incident-queue.tsx` on `main` | Merged (#46). Web CI is green again |
| Sensor bug fixes (`fix/sensor-geography`) | Merged (#43) |
| Hosted DB migrated to head; sensor tables created (they were missing in production) | Done. Head is `e9b4c2d7a106` |
| RLS enabled on `sensors`, `sensor_readings` | Merged (#48), applied live |
| Two failing API contract tests (test bugs: shared node, missing body, self-delete order) | Merged (#49). Backend CI was green on `main` at the time — **since broken again by PR #64, see H-5** |
| Backlog document and refresh | Merged (#47, #50) |
| Hosted DB migration pipeline (`Supabase - Apply migrations`) | Ran successfully after green CI; confirms the DB is at head |
| **H-1** RLS on `incident_reports` and `event_log` | Merged (`14dbec4`, migration `a4c8e2d6b917`). Applied to the hosted database. Adds `test_every_public_table_has_row_level_security`, which fails CI if any public table lacks RLS — this is **S-7** |
| **F-1** Offline route planning | `metroflow-mobile/src/navigation/offline-route.ts`: a JS port of the backend's time-dependent A* (`routing.py::td_a_star_search`) over the cached graph, with the same hazard-blocking rule (BRULE-008) and turn-by-turn instructions. `route.tsx`'s `requestRoute` falls back to it on a network failure (not on a real 404) for planning, auto-reroute and manual refresh. Verified against a synthetic 3-node graph (submerged-edge detour, hazard refusal, `ignore_hazards`) |
| **F-8** Hazard drawing on the portal map | `network-map.tsx` gained a click-to-place draw tool (polygon or line) with a draft preview layer and Finish/Undo/Cancel controls; `flood-closure-editor.tsx` added a Shape selector (segment / flood area / closure line) and a per-hazard Withdraw button (`PATCH .../active=false`). Backend: `hazard_zones.geometry` widened from POLYGON-only to generic `Geometry` (migration `a9c1f4e7d823`, applied live — hosted DB is at head), `create_hazard`/`update_hazard` now convert the posted GeoJSON via `geojson_to_geometry` (422 on anything but Polygon/LineString) |
| **H-2** Silent migration drift | `.github/workflows/supabase-migrate.yml`: the job used to be *skipped* (not failed) when Backend CI was red on `main`, which is how the sensor tables went missing in production unnoticed. It now always runs and fails loudly, with an `::error` annotation naming the failed CI run, when triggered by a non-green `Backend CI` — a real failure gets the normal GitHub notification a skip never did. `AGENTS.md`'s stale "Migration Status: Complete" line is corrected to point at `alembic current`/`alembic heads` instead of asserting a status. Branch protection on `main` now requires `Unit tests` and `API contract tests` (Backend CI) to pass and be current before merge; force-push and delete are blocked |
| **Sensor advisories: portal view, map layer, routing** | `metroflow-admin`: new `/sensors` registry page (CRUD, mirrors Fleet) and a colour-coded sensor layer on the live network map (grey disabled, sky blue normal, amber on a fresh breach). Backend: `GET /sensors` now returns `latitude`/`longitude` (from `Sensor.geom`) and the latest reading; `td_a_star_search` takes a 5th `advisory_flagged` element per edge and applies a soft time penalty (`ADVISORY_PENALTY = 1.5`) so a flagged, fresh sensor advisory is routed around when a safe alternative exists but never blocks (BRULE-012) — verified with a dedicated routing test and the full integration suite |
| **H-5** Backend CI red on `main` (discovered while verifying the above) | `hazard_zones.hazard_id`, `vehicles.vehicle_id` and `sos_requests.sos_id` were created in `1311ec28b5ad` with `autoincrement=False` and no sequence, so creating a hazard, vehicle or SOS request fails on any environment built fresh from migration history — which is exactly what CI's ephemeral Postgres and `alembic upgrade head` do. Confirmed via `gh run list`: **CI has been red on `main` since the PR #64 merge.** The hosted DB itself was unaffected (fixed by hand previously, like the sensor_readings sequence before `e2a9c4b7d815`). Migration `b3f6a2c9e415` codifies that fix idempotently (only acts where the column default is still missing) and is applied to the hosted DB; local Docker Postgres and the full 80-test integration suite verified clean on a from-scratch DB. Pushed as part of PR #65, where Backend CI is green; `main` goes green when that PR merges |
| **F-6** Driver telemetry never sends | Closed: the token already carries `vehicle_id` (`/auth/login` and `/auth/me` return it), and `route.tsx` posts a telemetry batch every 5 s while navigation is active and the account is linked to a unit; the server enforces the same 5 s throttle (`telemetry_min_seconds`) |
| **F-7** Offline screen showed "None / 0 MB" | Closed: `offline.ts::cacheStats()` reads the on-device SQLite cache and `offline.tsx` reports the road graph, hazard count, last route and bytes used — the placeholder counter and the disabled "Download Region" button are gone |
| **FSD-FR-087** dispatcher entry | Closed: the triage screen has a "Log a call-in distress signal" modal (lat/long/note) posting to `POST /api/v1/sos`; the incident arrives through the same SSE stream and is selected in the queue |

| **H-3** Branch and worktree cleanup | Done. Every branch was verified against `origin/main` (not the stale local `main`, which was 43 commits behind) before deletion: the 29 branches merged into `origin/main` were removed, plus `feat/driver-navigation` and `feat/nearest-sensor-cross-reference` (their PRs had merged but `git cherry` no longer recognised the patches) and the two agreed snapshots — 33 local branches in total. 6 merged remote branches deleted, and `git worktree remove` retried after the branch deletions freed both trees, so only the main worktree remains. The stale lint-staged stash was dropped after confirming its added lines are in `main` (the handful that diff are lines later refactored away). `backup/local-main-oct27` and `feat/scope-resolution-frontend-slice` were 27–31 Oct snapshots (a `plan/` folder, old driver screens, `supabase/config.toml`) superseded by `main`. Kept: `chore/eas-android-build` and its `stash@{0}` — one real unmerged commit (`3009ed4`, EAS preview profile + Android package id) that still needs a decision |
| **H-4** Stale local dev database | Done. `backend/README.md` (new) documents the local stack (`docker compose up -d postgres`), unit vs integration runs, the `tests/conftest.py` local-DB guard and its `METROFLOW_ALLOW_REMOTE_TEST_DB` override, and the throwaway recipe: create `metroflow_ci`, `alembic upgrade head`, `pytest -m integration`, drop. Verified end to end from an empty database: migrations apply, `alembic check` reports no drift, 80 tests pass in 20 s, drop succeeds. The dev database itself was two migrations behind (`b3f6a2c9e415` → `e9b4c2d7a106`) and is now at head; the suite still leaves rows behind after a clean run, so the throwaway recipe is the documented way to keep them out of a database worth keeping (see Q-5) |
| **NFR-004** ZAP gate red on `main` | The last two scheduled runs (26 Oct, 2 Nov) failed on a High SQLi alert against `/auth/login`, `/auth/send-verification`, `/auth/verify`. Root-caused: both endpoints already use parameterised SQLAlchemy (and `/send-verification`/`/verify` touch no SQL at all — `verification_store.py` is an in-memory dict), so the alert was ZAP's boolean-based detector mistaking a 401→429 flip for a true/false differential once its own request volume tripped the login/register rate limiter mid-scan. `security-zap.yml` now raises those two limits for its own ephemeral compose run only (`docker-compose.yml` passthrough, production defaults untouched); a local re-run of the exact CI scan confirms 0 High/Medium/Low |
| **NFR-019** SSE publish latency over budget | Measured (not previously tested): ~110 ms median, ~220-330 ms p95 against the 100 ms budget, at the then-default 100 ms event-stream poll. A 100 ms poll cannot bound p95 to 100 ms once any processing time is added — the code comment claiming otherwise was wrong. Fixed by lowering `event_stream_poll_ms` to 40 (`backend/config.py`); re-measured p95 ~50 ms. New `backend/benchmarks/bench_latency.py` (also covers NFR-001/002) makes this repeatable |
| **NFR-001/002** Network state and routing latency | Measured against the 34-node pilot graph: `/network/state` p95 ~163 ms (budget 500 ms), `/routing/navigate` p95 ~115 ms (budget 200 ms). Both already met; `backend/benchmarks/bench_latency.py` records how to re-run it |
| **S-4 / NFR-016** Backup/restore runbook and RPO/RTO | Runbook and RPO ≤24h/RTO ≤1h written (`docs/TSD.md` §5.2) against what the free Supabase tier actually offers (daily backups, no PITR). Drilled locally: seed → `pg_dump -F c` → drop → `pg_restore` → `alembic check` clean, every row exact. The live Supabase dashboard restore against the hosted project is still open — destructive, needs `S-1` first and the lead dev's go-ahead |
| **NFR-023** Night/storm theme, driver app | No such theme existed anywhere in the code (admin's dark mode stays deferred per U-5/U-7, by direction — scope decision 9 Nov 2026: build it for the driver app only). Added a persisted light/storm toggle (`metroflow-mobile/src/theme.tsx`) with a quick-access icon on the navigation screen and a switch on Profile; applied to `route.tsx` and `RouteMap.tsx` — the screen a driver actually watches while driving in a storm. Palette is mapped per contrast role (not a blanket colour inversion: `slate900` is both text and a button background in this file, so a flat swap would have made one of them unreadable); a dedicated `inkBg` token covers the button-background case. Home/SOS/Report/history stay single-theme — a smaller follow-up now that the toggle and palette exist |
| **Backend API gaps** `GET /hazards/{id}`, `GET /vehicles/{id}` | `docs/design/ADMIN_UI_BASELINE.md`'s gap table flagged both as missing (hazard draft editing, unit detail view); both were genuinely absent — added with 404 handling, tested (2 new integration tests, 82/82 passing) and documented in `docs/api.md` |

## 1. Documentation drift (code is ahead of the docs)

Done in the 8 November docs sync. `FEATURES_AND_DELIVERABLES.md` counts offline
(FR-068 to 071) and the nearest-gauge cross-reference (FR-079) as implemented;
`docs/api.md` documents every route, `client_id` and the report action set;
`PROGRESS_REPORT.md` carries an 8 November update; the PM plan closes I-005 and
ticks the release checks that are provable; `TSD.md` gains ADR-024 (on-device
SQLite and `client_id`) and the two report columns it was missing; both design
baselines carry an 8 November status note with corrected traceability; and
`AGENTS.md` no longer calls offline a placeholder. No open items remain in this
section.

## 2. Functional gaps

| # | Item | Ref | Size |
|---|------|-----|------|
| F-2 | Queued report photos are stored as file paths; the OS may purge them. Copy into app document storage on enqueue. | FR-068 | S |
| F-3 | ~~Connectivity is inferred from failed requests; add NetInfo for a real online/offline indicator.~~ **Done — `offline.ts` drives `useOnline()`/`isOffline()` from NetInfo and home, route and report already used it; the SOS screen now does too (pre-flight check, no misleading timeout, offline banner above the CTA)** | FR-068 | S |
| F-4 | **No mission timeline exists in the portal at all** — the baseline gap is against the UI 4 prototype, so `COMPLETE`/`CANCELLED` is not a missing state but a missing feature. Decide the data source first (`dispatch_tasks` has no event table: derive milestones from timestamps + audit, or add a dispatch event table and `GET /api/v1/dispatch/{id}/events`), then build the timeline. | FR-087-089 | M/L |
| F-5 | ~~`/dashboard` is a thin page and `components/dashboard.tsx` duplicates triage logic. Build or delete.~~ **Done — deleted: `/dashboard` is a five-line redirect to `/triage`, `components/dashboard.tsx` is gone and the sidebar has no dashboard link** | UI backlog P1-1, FR-024 | — |

## 3. Quality, tests, CI

| # | Item | Notes |
|---|------|-------|
| Q-1 | **Automated coverage is in place; only React component tests are still missing.** `metroflow-admin/e2e/` has Playwright specs for the sign-in gate, a rejected password, the triage queue rendering a live incident, a stored session reopening triage, axe scans and the dialog focus trap, plus an offline run (the shell's offline banner appears on a dropped connection and clears on reconnect; a load that fails while offline names the cause, and its retry recovers). The API is stubbed in the browser, so none of it needs a database, hosted API or dispatcher password. The driver app has Bun tests over its two pure modules — the offline queue policy (`src/offline-queue.test.ts`: oldest-first, a transient failure keeps order, a permanent 4xx drops and continues, 401/429 stay queued) and the offline route planner (`src/navigation/offline-route.test.ts`: clearance vs depth, hazard detour, `ignore_hazards`, no safe route) — and Mobile CI runs them. Still open: no React component tests (no jsdom/testing-library configured), and the queue's SQL/photo handling is only covered by the Q-2 device run. | LIM-009 |
| Q-2 | **Offline device test (TC-029/030) not yet run.** Needs a native rebuild (`expo-sqlite` config plugin), airplane mode, submit, reconnect, check it syncs once. Deferred on 9 Nov 2026: the pilot run, including UAT, is scheduled for later and does not block the hardening pass. | Run before claiming FR-068 to 071 |
| Q-3 | ~~Mobile CI runs `tsc` only, no lint. 2 lint warnings remain in the driver app; admin has ~6 unused-var warnings.~~ **Done — `bun run lint` (`expo lint`) is a Mobile CI step; both apps' lint suites are clean, so the warnings this entry described are gone** | — |
| Q-4 | Offline-latency and hazard-publish latency tests (release checklist). | PM plan |
| Q-5 | Integration tests still leave rows behind after a clean run (about 14 SOS requests, 2 hazards, 3 users on a fresh database). They no longer break the next run, and H-4 documents the throwaway-database recipe, so this is now about tidy-up rather than misleading failures. | Not urgent after H-4 |

## 4. Security / operations (TSD §7)

| # | Item | Status |
|---|------|--------|
| S-1 | LIM-023 API connects as `postgres`; create `metroflow_app`, move ownership, rotate `DATABASE_URL`. Note RLS only protects the anon/authenticated roles because the owner bypasses it. | Open |
| S-2 | LIM-025 no edge WAF (plan limitation). | Accepted until public exposure |
| S-3 | LIM-010 CodeQL inactive on the private repo. | Open |
| S-4 | LIM-011/012 single-region DB. Backup/restore runbook written and RPO/RTO defined (`docs/TSD.md` §5.2, NFR-016): RPO ≤24h/RTO ≤1h on the free-tier daily-backup cadence. Dump/restore mechanics drilled locally 9 Nov 2026 (exact data match after restore). Still open: the live Supabase dashboard restore against the hosted project itself — destructive, needs S-1 done first and the lead dev's go-ahead. | Runbook + local drill done; live drill open |
| S-5 | LIM-015 driver app distribution: internal EAS/TestFlight build needed for the pilot. | Open |
| S-6 | Reporter hash salt and JWT secret rotation procedure undocumented. *(unverified)* | |
| S-7 | ~~Add a CI check that every public table has RLS enabled~~ | Done — see H-1 above |

## 5. UI polish (from `UI_POLISH_BACKLOG.md`, updated)

Done: loading/empty/error states for the queue, users, rescue, sensors, radar and hazards screens (fleet, moderation and
export already had them); modal open transitions; offline banner (portal and driver app);
aria-labels on icon-only buttons; colour tokens (`theme.ts`); `slate-900` primary; Call-911 removed. (This is what U-1
described; the table below already started at U-2.)

**U-2 done:** `metroflow-admin/e2e/a11y.spec.ts` runs axe-core (`@axe-core/playwright`, WCAG 2.1 A/AA) scans of `/login` and
`/triage` on every Web CI run, plus a keyboard test of the call-in dialog (focus lands on the first field, Tab and Shift+Tab
wrap inside `role="dialog"`, Escape closes it and focus returns to the trigger). The scans, not guesswork, found the contrast
failures that were fixed: `text-slate-400` on white -> `slate-500`, the "Forgot password?" link `sky-600` -> `sky-700`, the
active sidebar item `bg-sky-600` -> `bg-sky-700` (white text was 4.1:1 on it), the sidebar station line lightened on dark, and
the triage KPI trend labels `emerald-600`/`sky-600` -> `700`. Both portal dialogs now share
`components/use-dialog-focus.ts` instead of duplicating the effect, and its close callbacks are ref-backed so the queue's SSE
refresh cannot pull focus out of a field mid-typing. Still open, and honest about it: axe checks markup and colour only - it
does not prove a screen reader can complete a dispatch, and it cannot judge focus order across the multi-panel screens.

**U-4 done, mostly already implemented:** the splash screen (P1-4) is configured - `app.json` loads the `expo-splash-screen`
plugin, and `src/app/_layout.tsx` holds the native splash until the session is known, then fades it over 300 ms. The error
copy (P1-5) already branches on the cause: `sos.tsx` separates permission-denied from a stale GPS fix, `report.tsx` has
offline/validation copy with a Retry, `route.tsx` separates permission-denied from an unreadable fix, `profile.tsx` covers a
failed save. The only gap was that the route screen said "Check GPS and retry" while offering no Retry; it now re-runs the
location read.

| # | Item | Size |
|---|------|------|
| U-2 | ~~Accessibility pass beyond buttons: form labels, focus order, contrast, screen-reader test~~ **Done — axe scan in CI, contrast fixes, shared dialog focus trap** | M |
| U-3 | ~~Adopt `theme.ts` for font sizes and spacing; finish moving hex into tokens in the admin Tailwind config~~ **Done — every portal hex now lives in `MAP_COLORS` (`lib/network.ts`), guarded by `lib/no-raw-colors.test.ts`; `theme.ts` gained the type and spacing scales** | S |
| U-4 | ~~P1-4 custom splash screen; P1-5 context-specific error messages (GPS denied, network) in the driver app~~ **Done — already implemented; added the missing GPS Retry** | S |
| U-5 | ~~P2-1/2/3 brand palette, typography scale, motion~~ **Done — mobile: every `fontSize`/`padding`/`margin`/`gap` literal and hex colour now resolves through `theme.tsx` (`fontSize.*`, `space[n]`, `colors.*`/`c.*`); palette extended to the full ramp the screens use, `stormColors` is now a partial override merged over `lightColors`. Portal: `brand-*` tokens adopted (`bg-slate-900` → `bg-brand-primary`), `text-display`/`text-kpi` type steps, shimmer skeletons, page fade-in** | M |
| U-6 | ~~P2-6 turn-by-turn icons and ETA; P2-7 profile settings; P3-4 telemetry display; P3-5 report history~~ **Done — most of P2-6/P3-4/P3-5 already existed; added ETA to the turn card, heading to the telemetry strip, notification/sharing prefs (`prefs.ts`, wired into hazard alerts and telemetry consent), a Profile entry point to report history, and expandable report details. Signal-strength indicator skipped: RN exposes no radio metric; connectivity status covers it** | M each |
| U-7 | ~~P3-1 keyboard shortcuts; P3-2 advanced filters; P3-3 bulk actions; P2-4 charts~~ **Done — Ctrl+T/R/H/F/M/U/E/K shortcuts + `?` help in the app shell; advanced queue filters (barangay, type, age, min-urgency) with localStorage presets; bulk dismiss/restore on triage and bulk approve/reject on moderation; recharts panel on triage (24 h signal volume, fleet donut, hazard-level bars). Not built: bulk assign-to-unit (dispatch is a per-incident flow) and a dispatch-response-time chart (no data source)** | L |

## 6. Suggested order

1. **Q-2** device test of offline; fix what breaks. **Deferred 9 Nov 2026** with UAT — the pilot run happens later, so hardening proceeds on the items that need no device: S-1, the ZAP gate and F-4.
2. **D-1..D-9** documentation sync in one PR (done; **H-3** and **H-4** were done first).
3. **Q-1** minimal automated tests: admin unit tests for `lib/` helpers (done), one Playwright smoke (login, triage — done), the offline Playwright run and the driver-app queue/route tests (done; React component tests still open).
4. **F-4** to close the functional gap left in the portal: there is no mission timeline yet, so settle the data source first. **F-5** is done (the dashboard page is a redirect).
5. **U-1..U-7** - done (9 Nov 2026, ahead of pilot feedback). Section 5 is closed; the deferred-scope note above no longer applies.
6. **S-1, S-4** before any real users.

## Out of scope (unchanged)

App-store release, Civic Broadcasts, Evacuation Centers, Crew Profiles, Comms Streams, native telephony/SMS,
SQLite *tile* caching, real CCTV, real rain-gauge integration.
