# MetroFlow - Consolidated Backlog

**Date:** 3 November 2026 · **Branch audited:** `feat/driver-navigation` (local; 19 commits not pushed)
**Method:** cross-checked FSD status table, TSD §7, PM plan, PROGRESS_REPORT, FEATURES_AND_DELIVERABLES,
UI_POLISH_BACKLOG, CI workflows, branches, and the code. Items marked *(unverified)* were not run.

## 0. Do first: repository hygiene

| # | Item | Why |
|---|------|-----|
| H-1 | **Push / commit the working tree.** 19 local commits are unpushed; offline, UI-polish and backend `client_id` work is uncommitted. | One lost disk loses a day of work |
| H-2 | **Merge or drop `fix/sensor-geography`** (2 commits: "make sensor breach, distance and delete work", touches `models.py`, `schemas.py`, `api.md`). | Real sensor bug fixes are not on this branch. Will conflict with the `models.py` change here; merge soon |
| H-3 | **Run `alembic upgrade head` on Supabase** for migration `e1a9c3b7d204` (also merges the two heads). | `POST /reports` fails in production until then |
| H-4 | Remove stale branches: `feat/moderation-desk`, `feat/network-map`, `feat/report-intake*`, `feat/ui-polish-backlog` (0 ahead); `backup/local-main-oct27`, `feat/scope-resolution-frontend-slice`, `worktree-docs-sync` need a decision. | Noise |
| H-5 | Backend test `test_events::test_payloads_match_the_rest_contract` fails (`Vehicle` rejects `call_sign`). Fails before and after our changes. | Red test in the suite |

## 1. Documentation drift (code is ahead of the docs)

| # | Doc | Problem |
|---|-----|---------|
| D-1 | `FEATURES_AND_DELIVERABLES.md` | Lists offline (FR-068 to 071) as "Planned (Scope Conflict)" and FR-079 as missing. Offline is built; FR-079 is built (`/reports/{id}/nearest-sensor`, shown in `report-desk.tsx`). |
| D-2 | `docs/api.md` | No entry for `nearest-sensor`, `/users`, exports (`/audit/export`, `/incidents/export`) or the new `client_id` form field. Check each route against `main.py` (50 routes). |
| D-3 | `PROGRESS_REPORT.md` | Dated 2 Nov; says branch `main`; omits offline queue, SQLite cache, `client_id`. |
| D-4 | `docs/FSD.md` | "Incident queue" is Partial and "Portal and driver app UI" is Partial; reword or close. Offline row notes the limits (no offline route planning). |
| D-5 | `docs/PROJ_MANAGEMENT_PLAN.md` | I-005 ("CR-001 increment is planned, not implemented") is outdated; release checklist (lines ~458-467) is all unchecked; web/driver "Bun test" and Playwright still listed as planned. |
| D-6 | `docs/TSD.md` | Add ADR/limitation note: device-side SQLite for graph/hazards/queue (distinct from the out-of-scope tile cache); `client_id` idempotency; LIM-017 stays. |
| D-7 | `AGENTS.md` | Claims "Call 911" removed (it was not until this session) and "Next Steps" still says "test backend endpoints". Refresh. |
| D-8 | `docs/design/*BASELINE.md` | "Missing from UI 2" notes are stale (hold, duplicate, plausibility, decision summary all exist). Mark as a spec, tick what is built. |
| D-9 | `UI_UX_AUDIT_SCOPE_RESOLUTION.md` | Referenced by FEATURES doc but not in the repo. Restore or remove the reference. |

## 2. Functional gaps

| # | Item | Ref | Size |
|---|------|-----|------|
| F-1 | **Offline route planning**: client-side shortest path on the cached graph so a driver can pick a new destination offline. Today only the last route works offline. | FSD-FR-071, TC-030 | M |
| F-2 | Queued report photos are stored as file paths; the OS may purge them. Copy into app document storage on enqueue. | FR-068 | S |
| F-3 | Connectivity is inferred from failed requests; add NetInfo for a real online/offline indicator. | FR-068 | S |
| F-4 | Dispatch timeline lacks `COMPLETE` / `CANCELLED` milestones (baseline doc). *(unverified)* | FR-087-089 | S |
| F-5 | Dashboard page: `/dashboard` is a thin page; `components/dashboard.tsx` duplicates triage logic. Build or delete. | UI backlog P1-1, FR-024 | M |
| F-6 | Driver telemetry never sends: needs `vehicle_id` in the token or `EXPO_PUBLIC_TELEMETRY_VEHICLE_ID` (pilot gap noted in `route.tsx`). | FR-072 | S |
| F-7 | Offline Maps screen is still a placeholder (tiles out of scope). Show real cache status (graph age, queued reports) instead of "None / 0 MB". | FR-070, LIM-017 | S |

## 3. Quality, tests, CI

| # | Item | Notes |
|---|------|-------|
| Q-1 | **No portal or driver unit tests, no E2E.** Only backend has tests (about 167 tests). PM plan promises Bun test + Playwright (online and offline). | LIM-009. Biggest verification gap for the final defence |
| Q-2 | Offline manual test (TC-029/030) not yet run on a device. Pending your device test. | Run before claiming FR-068 to 071 |
| Q-3 | New backend replay test (`client_id`) and integration suite need a DB; not run locally. | CI runs them |
| Q-4 | Mobile CI runs `tsc` only, no lint. 2 lint warnings remain in the driver app; admin has ~6 unused-var warnings. | Add `expo lint` to mobile.yml |
| Q-5 | Offline-latency / hazard-publish latency tests (release checklist). | PM plan |
| Q-6 | Merged loading-states branch shipped a syntax error that CI would have caught; confirm `web.yml` is green on the pushed branch. | |

## 4. Security / operations (TSD §7)

| # | Item | Status |
|---|------|--------|
| S-1 | LIM-023 API connects as `postgres`; create `metroflow_app` role, move ownership, rotate `DATABASE_URL`. | Open |
| S-2 | LIM-025 no edge WAF (plan limitation). | Accepted until public exposure |
| S-3 | LIM-010 CodeQL inactive on the private repo. | Open |
| S-4 | LIM-011/012 single-region DB; no backup/restore runbook or DR test; RPO/RTO undefined. | Open |
| S-5 | LIM-015 driver app distribution: internal EAS/TestFlight build needed for the pilot. | Open |
| S-6 | Reporter hash salt and JWT secret rotation procedure undocumented. *(unverified)* | |

## 5. UI polish (from `UI_POLISH_BACKLOG.md`, updated)

Done this session: loading/empty/error states for queue, users, rescue; offline banner (portal and driver app);
aria-labels on icon-only buttons; colour tokens (`theme.ts`); `slate-900` primary; Call-911 removed.

| # | Item | Size |
|---|------|------|
| U-1 | Loading/error/empty states for remaining screens: hazards, fleet, moderation queue, export, radar, dispatch panel | M |
| U-2 | Accessibility pass beyond buttons: form labels, focus order, contrast (emerald-500 on white fails), screen-reader test | M |
| U-3 | Adopt `theme.ts` for font sizes and spacing; finish moving hex into tokens in admin Tailwind config | S |
| U-4 | P1-4 Custom splash screen; P1-5 context-specific error messages (GPS denied, network) in the driver app | S |
| U-5 | P2-1/2/3 brand palette, typography scale, motion | M |
| U-6 | P2-6 turn-by-turn icons and ETA; P2-7 profile settings; P3-4 telemetry display; P3-5 report history | M each |
| U-7 | P3-1 keyboard shortcuts; P3-2 advanced filters; P3-3 bulk actions; P3-6 dark mode; P2-4 charts | L, defer |

## 6. Suggested order

1. **H-1..H-3** (commit, merge sensor fix, migrate), then confirm CI green.
2. **Q-2** device test of offline; fix what breaks.
3. **D-1..D-9** documentation sync in one commit.
4. **Q-1** minimal automated tests: admin unit tests for `lib/` helpers, one Playwright smoke (login, triage), one offline-queue test.
5. **F-1, F-2, F-6** to close FR-071 and telemetry honestly.
6. **U-1, U-2, U-4**, then defer the rest of section 5 until after pilot feedback.
7. **S-1, S-4** before any real users.

## Out of scope (unchanged)

App-store release, Civic Broadcasts, Evacuation Centers, Crew Profiles, Comms Streams, native telephony/SMS,
SQLite *tile* caching, real CCTV, real rain-gauge integration.
