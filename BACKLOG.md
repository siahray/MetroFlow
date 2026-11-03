# MetroFlow - Consolidated Backlog

**Revised:** 3 November 2026 (night) · **Baseline:** `main` at PR #50 (Backend CI and Web CI green)
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
| Two failing API contract tests (test bugs: shared node, missing body, self-delete order) | Merged (#49). **Backend CI is green on `main`** |
| Backlog document and refresh | Merged (#47, #50) |
| Hosted DB migration pipeline (`Supabase - Apply migrations`) | Ran successfully after green CI; confirms the DB is at head |

## 0. Do first

| # | Item | Why |
|---|------|-----|
| H-1 | **Enable RLS on `incident_reports` and `event_log`.** Needs a migration and a live apply (same recipe as #48). Add **S-7** (CI check for RLS on every public table) in the same PR. | These tables hold reporter hashes, evidence photos and EXIF, and are reachable with the anon key. `spatial_ref_sys` is a PostGIS system table; leave it |
| H-2 | **Migrations only reach production through green CI.** The `Supabase - Apply migrations` workflow runs after Backend CI on `main` and is *skipped* when CI is red. CI was red for several merges, so production silently lagged (sensor tables were missing until applied by hand). Fix: make a skipped run visible (notification or a status check), require green CI via branch protection, and document the pipeline in `AGENTS.md`/TSD (it currently says "Migration Status: Complete"). | Silent production drift |
| H-3 | Branch and worktree cleanup. Delete merged branches (`pr/*`, `fix/*`, `docs/backlog-*`, `feat/driver-navigation`, `feat/loading-states-and-error-boundaries`, `feat/moderation-desk`, `feat/network-map`, `feat/report-intake*`, `feat/ui-polish-backlog`). Remove the worktrees `../MetroFlow-docs` and `.claude/worktrees/docs-sync`. Drop the stale lint-staged `stash@{0}` (its content was merged in #46). Decide on `backup/local-main-oct27`, `feat/scope-resolution-frontend-slice`, `worktree-docs-sync`. `feat/driver-navigation` shows 24 "unpushed" commits that `git cherry` reports as already in `main`. | Noise; caused confusion twice |
| H-4 | Local dev database is stale (old 4-node graph, leftover rows), so `pytest -m integration` against it fails misleadingly. Recreate it, or run integration tests on a throwaway DB (`CREATE DATABASE metroflow_ci`, `alembic upgrade head`, test, drop). Document the recipe in `backend/README`. | Wasted debugging time |

## 1. Documentation drift (code is ahead of the docs)

| # | Doc | Problem |
|---|-----|---------|
| D-1 | `FEATURES_AND_DELIVERABLES.md` | Lists offline (FR-068 to 071) as "Planned (Scope Conflict)" and FR-079 as missing. Both are built. |
| D-2 | `docs/api.md` | No entry for `nearest-sensor`, `/users`, exports (`/audit/export`, `/incidents/export`) or the `client_id` form field. Check each of the 50 routes against `main.py`. |
| D-3 | `PROGRESS_REPORT.md` | Dated 2 Nov; omits offline queue, SQLite cache, `client_id`, RLS fix. |
| D-4 | `docs/FSD.md` | Offline row updated (#45). Still: "Incident queue" and "Portal and driver app UI" are Partial; reword or close. |
| D-5 | `docs/PROJ_MANAGEMENT_PLAN.md` | I-005 ("CR-001 increment is planned") is outdated; release checklist (lines ~458-467) is all unchecked; Bun test and Playwright still "planned". |
| D-6 | `docs/TSD.md` | Add an ADR/limitation note: on-device SQLite for graph, hazards and queue (distinct from the out-of-scope tile cache); `client_id` idempotency; LIM-017 stays. |
| D-7 | `AGENTS.md` | Wrong in four places: "Migration Status: Complete" (see H-2); says offline is "Conflicts with scope resolution" and "Marked Offline Maps … no SQLite" (offline is built); says "RLS: Enabled on all tables" (not true until H-2 lands); "Next Steps" are stale. |
| D-8 | `docs/design/*BASELINE.md` | "Missing from UI 2" notes are stale (hold, duplicate, plausibility, decision summary all exist). Mark as a spec; tick what is built. |
| D-9 | `UI_UX_AUDIT_SCOPE_RESOLUTION.md` | Referenced by the FEATURES doc but not in the repo. Restore or remove the reference. |

## 2. Functional gaps

| # | Item | Ref | Size |
|---|------|-----|------|
| F-1 | **Offline route planning**: client-side shortest path on the cached graph so a driver can pick a new destination offline. Today only the last route works offline. | FSD-FR-071, TC-030 | M |
| F-2 | Queued report photos are stored as file paths; the OS may purge them. Copy into app document storage on enqueue. | FR-068 | S |
| F-3 | Connectivity is inferred from failed requests; add NetInfo for a real online/offline indicator. | FR-068 | S |
| F-4 | Dispatch timeline lacks `COMPLETE` / `CANCELLED` milestones (baseline doc). *(unverified)* | FR-087-089 | S |
| F-5 | `/dashboard` is a thin page and `components/dashboard.tsx` duplicates triage logic. Build or delete. | UI backlog P1-1, FR-024 | M |
| F-6 | Driver telemetry never sends: needs `vehicle_id` in the token or `EXPO_PUBLIC_TELEMETRY_VEHICLE_ID`. | FR-072 | S |
| F-7 | Offline Maps screen shows "None / 0 MB". Show real cache status (graph age, queued reports) instead. | FR-070, LIM-017 | S |
| F-8 | **Hazard drawing on the portal map**: draw a flood polygon and a closure line, and send `geometry`. Today the Hazards page can only attach a hazard to a road segment. Also a hazard withdraw endpoint and button. | FSD-FR-082, 083, 085 | M |

## 3. Quality, tests, CI

| # | Item | Notes |
|---|------|-------|
| Q-1 | **No portal or driver unit tests, no E2E.** Only the backend has tests (about 170). PM plan promises Bun test + Playwright (online and offline). | LIM-009. Biggest verification gap for the defence |
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
| S-7 | Add a CI check that every public table has RLS enabled (query `pg_class.relrowsecurity`), so the sensors gap cannot recur. | New |

## 5. UI polish (from `UI_POLISH_BACKLOG.md`, updated)

Done: loading/empty/error states for the queue, users and rescue screens; offline banner (portal and driver app);
aria-labels on icon-only buttons; colour tokens (`theme.ts`); `slate-900` primary; Call-911 removed.

| # | Item | Size |
|---|------|------|
| U-1 | Loading/error/empty states for remaining screens: hazards, fleet, moderation queue, export, radar, dispatch panel | M |
| U-2 | Accessibility pass beyond buttons: form labels, focus order, contrast (emerald-500 on white fails), screen-reader test | M |
| U-3 | Adopt `theme.ts` for font sizes and spacing; finish moving hex into tokens in the admin Tailwind config | S |
| U-4 | P1-4 custom splash screen; P1-5 context-specific error messages (GPS denied, network) in the driver app | S |
| U-5 | P2-1/2/3 brand palette, typography scale, motion | M |
| U-6 | P2-6 turn-by-turn icons and ETA; P2-7 profile settings; P3-4 telemetry display; P3-5 report history | M each |
| U-7 | P3-1 keyboard shortcuts; P3-2 advanced filters; P3-3 bulk actions; P3-6 dark mode; P2-4 charts | L, defer |

## 6. Suggested order

1. **H-1** RLS on `incident_reports` and `event_log` (migration, live apply, PR) with the **S-7** CI check.
2. **H-2** make a skipped migration run visible and require green CI.
3. **Q-2** device test of offline; fix what breaks.
4. **D-1..D-9** documentation sync in one PR (includes **H-3** branch cleanup and **H-4** recipe).
5. **Q-1** minimal automated tests: admin unit tests for `lib/` helpers, one Playwright smoke (login, triage), one offline-queue test.
6. **F-1, F-2, F-6** to close FR-071 and telemetry honestly.
7. **U-1, U-2, U-4**, then defer the rest of section 5 until after pilot feedback.
8. **S-1, S-4** before any real users.

## Out of scope (unchanged)

App-store release, Civic Broadcasts, Evacuation Centers, Crew Profiles, Comms Streams, native telephony/SMS,
SQLite *tile* caching, real CCTV, real rain-gauge integration.
