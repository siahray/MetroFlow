# MetroFlow - Consolidated Backlog

**Revised:** 4 November 2026 · **Baseline:** `feat/real-time-sse` at PR #65 (all four checks green)
**Method:** cross-checked FSD status table, TSD §7, PM plan, PROGRESS_REPORT, FEATURES_AND_DELIVERABLES,
UI_POLISH_BACKLOG, CI workflows, branches, the hosted database and the code. Items marked *(unverified)* were not run.

## Done since the first revision

| Item | Result |
|------|--------|
| Offline report queue, SQLite cache, `client_id` idempotency | Merged (#44, #45). Migration applied to Supabase |
| Portal loading/error/offline states; broken `incident-queue.tsx` on `main` | Merged (#46). Web CI is green again |
| Sensor bug fixes (`fix/sensor-geography`) | Merged (#43) |
| Hosted DB migrated to head; sensor tables created (they were missing in production) | Done. Head is `f3b7d9a1c562` |
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

## 0. Do first

| # | Item | Why |
|---|------|-----|
| H-3 | Branch and worktree cleanup. Delete merged branches (`pr/*`, `fix/*`, `docs/backlog-*`, `feat/driver-navigation`, `feat/loading-states-and-error-boundaries`, `feat/moderation-desk`, `feat/network-map`, `feat/report-intake*`, `feat/ui-polish-backlog`). Remove the worktrees `../MetroFlow-docs` and `.claude/worktrees/docs-sync`. Drop the stale lint-staged `stash@{0}` (its content was merged in #46). Decide on `backup/local-main-oct27`, `feat/scope-resolution-frontend-slice`, `worktree-docs-sync`. `feat/driver-navigation` shows 24 "unpushed" commits that `git cherry` reports as already in `main`. | Noise; caused confusion twice |
| H-4 | Local dev database is stale (old 4-node graph, leftover rows), so `pytest -m integration` against it fails misleadingly. Recreate it, or run integration tests on a throwaway DB (`CREATE DATABASE metroflow_ci`, `alembic upgrade head`, test, drop). Document the recipe in `backend/README`. | Wasted debugging time |

## 1. Documentation drift (code is ahead of the docs)

| # | Doc | Problem |
|---|-----|---------|
| D-1 | `FEATURES_AND_DELIVERABLES.md` | Lists offline (FR-068 to 071) as "Planned (Scope Conflict)" and FR-079 as missing. Both are built. |
| D-2 | `docs/api.md` | No entry for `nearest-sensor`, `/users`, exports (`/audit/export`, `/incidents/export`) or the `client_id` form field. Check each of the 50 routes against `main.py`. |
| D-3 | `PROGRESS_REPORT.md` | Dated 2 Nov; omits offline queue, SQLite cache, `client_id`, RLS fix. |
| D-5 | `docs/PROJ_MANAGEMENT_PLAN.md` | I-005 ("CR-001 increment is planned") is outdated; release checklist (lines ~458-467) is all unchecked; Bun test and Playwright still "planned". |
| D-6 | `docs/TSD.md` | Add an ADR/limitation note: on-device SQLite for graph, hazards and queue (distinct from the out-of-scope tile cache); `client_id` idempotency; LIM-017 stays. |
| D-7 | `AGENTS.md` | Wrong in four places: "Migration Status: Complete" (see H-2); says offline is "Conflicts with scope resolution" and "Marked Offline Maps … no SQLite" (offline is built); says "RLS: Enabled on all tables" (not true until H-2 lands); "Next Steps" are stale. |
| D-8 | `docs/design/*BASELINE.md` | "Missing from UI 2" notes are stale (hold, duplicate, plausibility, decision summary all exist). Mark as a spec; tick what is built. |
| D-9 | `UI_UX_AUDIT_SCOPE_RESOLUTION.md` | Referenced by the FEATURES doc but not in the repo. Restore or remove the reference. |

## 2. Functional gaps

| # | Item | Ref | Size |
|---|------|-----|------|
| F-2 | Queued report photos are stored as file paths; the OS may purge them. Copy into app document storage on enqueue. | FR-068 | S |
| F-3 | Connectivity is inferred from failed requests; add NetInfo for a real online/offline indicator. | FR-068 | S |
| F-4 | Dispatch timeline lacks `COMPLETE` / `CANCELLED` milestones (baseline doc). *(unverified)* | FR-087-089 | S |
| F-5 | `/dashboard` is a thin page and `components/dashboard.tsx` duplicates triage logic. Build or delete. | UI backlog P1-1, FR-024 | M |

## 3. Quality, tests, CI

| # | Item | Notes |
|---|------|-------|
| Q-1 | **Portal smoke now runs end to end; component and driver-app tests still missing.** `metroflow-admin/e2e/` has a Playwright smoke (the sign-in gate, a rejected password, the triage queue rendering a live incident, a stored session reopening triage) with the API stubbed in the browser, so it needs no database, hosted API or dispatcher password; Web CI grew a `Portal smoke (Playwright)` job. Still open: no React component tests, no driver-app tests, and no *offline* Playwright run. | LIM-009. Offline-queue test still outstanding |
| Q-2 | **Offline device test (TC-029/030) not yet run.** Needs a native rebuild (`expo-sqlite` config plugin), airplane mode, submit, reconnect, check it syncs once. | Run before claiming FR-068 to 071 |
| Q-3 | Mobile CI runs `tsc` only, no lint. 2 lint warnings remain in the driver app; admin has ~6 unused-var warnings. | Add `expo lint` to `mobile.yml` |
| Q-4 | Offline-latency and hazard-publish latency tests (release checklist). | PM plan |
| Q-5 | Make integration tests clean up after a failed run (a failed test leaves rows that break the next run). | Part of H-4 |

## 4. Security / operations (TSD §7)

| # | Item | Status |
|---|------|--------|
| S-1 | LIM-023 API connects as `postgres`; create `metroflow_app`, move ownership, rotate `DATABASE_URL`. Note RLS only protects the anon/authenticated roles because the owner bypasses it. | Open |
| S-2 | LIM-025 no edge WAF (plan limitation). | Accepted until public exposure |
| S-3 | LIM-010 CodeQL inactive on the private repo. | Open |
| S-4 | LIM-011/012 single-region DB; no backup/restore runbook or DR test; RPO/RTO undefined. | Open |
| S-5 | LIM-015 driver app distribution: internal EAS/TestFlight build needed for the pilot. | Open |
| S-6 | Reporter hash salt and JWT secret rotation procedure undocumented. *(unverified)* | |
| S-7 | ~~Add a CI check that every public table has RLS enabled~~ | Done — see H-1 above |

## 5. UI polish (from `UI_POLISH_BACKLOG.md`, updated)

Done: loading/empty/error states for the queue, users, rescue, sensors, radar and hazards screens (fleet, moderation and
export already had them); modal open transitions; offline banner (portal and driver app);
aria-labels on icon-only buttons; colour tokens (`theme.ts`); `slate-900` primary; Call-911 removed.

| # | Item | Size |
|---|------|------|
| U-2 | Accessibility pass beyond buttons: form labels, focus order, contrast (emerald-500 on white fails), screen-reader test | M |
| U-3 | Adopt `theme.ts` for font sizes and spacing; finish moving hex into tokens in the admin Tailwind config | S |
| U-4 | P1-4 custom splash screen; P1-5 context-specific error messages (GPS denied, network) in the driver app | S |
| U-5 | P2-1/2/3 brand palette, typography scale, motion | M |
| U-6 | P2-6 turn-by-turn icons and ETA; P2-7 profile settings; P3-4 telemetry display; P3-5 report history | M each |
| U-7 | P3-1 keyboard shortcuts; P3-2 advanced filters; P3-3 bulk actions; P3-6 dark mode; P2-4 charts | L, defer |

## 6. Suggested order

1. **Q-2** device test of offline; fix what breaks.
2. **D-1..D-9** documentation sync in one PR (includes **H-3** branch cleanup and **H-4** recipe).
3. **Q-1** minimal automated tests: admin unit tests for `lib/` helpers (done), one Playwright smoke (login, triage — done), one offline-queue test (open).
4. **F-2, F-6** to close out telemetry and the queued-photo gap honestly.
5. **U-1, U-2, U-4**, then defer the rest of section 5 until after pilot feedback.
6. **S-1, S-4** before any real users.

## Out of scope (unchanged)

App-store release, Civic Broadcasts, Evacuation Centers, Crew Profiles, Comms Streams, native telephony/SMS,
SQLite *tile* caching, real CCTV, real rain-gauge integration.
