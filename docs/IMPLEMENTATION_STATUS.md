# MetroFlow — What's Left to Implement

**As of:** 10 November 2026 · **Source:** cross-checked against `BACKLOG.md`,
`docs/BRD.md`, `docs/TSD.md`, `docs/design/*_BASELINE.md`, and the actual code
(`backend/main.py`, `models.py`, test suites) — not just what the docs claim.

**Methodology:** each item below is ✅ Done, 🔶 Partial, ⬜ Open (ours to build),
or ⛔ Blocked (needs something we don't control — a client baseline, real
users, a physical device, or budget). Bars score ✅ = 1, 🔶 = 0.5, ⬜/⛔ = 0,
over the items in that section. Blocked items count against the bar — they
genuinely aren't done — but no amount of engineering time fixes them, so don't
read a low bar there as "needs more coding." Out-of-scope features (Evacuation
Centers, Comms Streams, Crew Profiles, Broadcasts, Air-Asset Escalation,
CR-002/003 future proposals) and business paperwork (budgets, approvals,
charter dates) are excluded entirely — they were never engineering work.

## Overall

```
███████████████░░░░░ 83%  (41.5 / 50 weighted items)
```

---

## Open backlog at a glance

Every ⬜/🔶/⛔ item from the sections below, sorted by whether it's ours to
pick up right now or needs something outside engineering first. Each row
links to its full writeup via the ID.

### Ready to implement (no external dependency)

| ID | What's left | Where |
|----|-------------|-------|
| §7 doc | `docs/design/ADMIN_UI_BASELINE.md`'s ~130-row gap table predates CR-001 and lists things as missing that now exist — needs a pass to mark them resolved | §7 |

### Written but needs a production go-ahead (lead dev sign-off, not coding)

| ID | What's left | Where |
|----|-------------|-------|
| S-4 | Runbook + local/hosted-cluster drill done; a restore *over* prod is a destructive go-ahead-gated runbook step (the free tier exposes no managed backups to restore from — `backups: []`, `pitr_enabled: false`) | §4 |
| NFR-016 | Same dependency as S-4 — the live restore drill | §1 |

### Blocked on something we don't control

| ID | What's left | Needs |
|----|-------------|-------|
| S-5 | iOS build only — Android internal APK already built via EAS (10 Nov 2026); iOS needs a paid Apple Developer account + registered device UDIDs, deferred by choice (pilot is Android-only) | An Apple Developer Program membership |
| Q-2 / NFR-018 | Offline device test (TC-029/030) | A native build on physical hardware, airplane mode |
| NFR-024, NFR-025 | App-interactive time, map frame rate | A real mid-range device, not a simulator |
| NFR-003 | 99% uptime during a declared event | Real incident history from an actual event |
| NFR-009 | SUS ≥75 | Real UAT sessions |

---

## 1. Non-Functional Requirements — `docs/BRD.md`

```
███████████████░░░░░ 78%  (19.5 / 25)
```

- [x] NFR-001, 002 — network state / routing latency within budget (measured, `bench_latency.py`)
- [x] NFR-004 — ZAP scan, 0 High/Medium (false-positive root-caused and fixed; awaiting a live CI run to confirm)
- [x] NFR-005, 006, 007 — secrets, RLS, PII protection
- [x] NFR-008, 010, 011 — triage interaction count, browser support, accessibility (axe-core in CI)
- [x] NFR-012, 013, 014, 015 — migrations-only schema, external config, audit attribution, horizontal scaling
- [x] NFR-017 — units and timezone
- [x] NFR-019 — SSE publish latency ≤100ms p95 (was failing, fixed by lowering the poll interval)
- [x] NFR-020, 021, 022 — role checks, location privacy, telemetry throttle
- [ ] 🔶 NFR-016 — RPO/RTO defined; `scripts/backup-db.sh` now runs nightly via a launchd job (03:00, 14-dump retention) and the drill on the hosted cluster matched prod row counts exactly; a restore *over* prod stays a go-ahead-gated runbook step — the free tier has no managed backups to restore from
- [x] NFR-023 — storm/night theme now covers the driver app's navigation screen plus Home, SOS, Report and Report History (10 Nov 2026); the admin portal stays single-theme by standing scope decision, not a gap
- [ ] ⛔ NFR-003 — 99% uptime during a declared event — needs real incident history from an actual event
- [ ] ⛔ NFR-009 — SUS ≥75 — needs real UAT sessions
- [ ] ⛔ NFR-018 — offline device test (`Q-2`) — needs a native build on physical hardware in airplane mode
- [ ] ⛔ NFR-024 — app interactive <5s on a mid-range phone/4G — needs a real device, not a simulator
- [ ] ⛔ NFR-025 — map frame rate while panning/zooming — same, needs a real device

## 2. Backend API gaps — `docs/design/ADMIN_UI_BASELINE.md` (verified against `main.py`)

```
████████████████████ 100%  (2 / 2)
```

- [x] `GET /api/v1/hazards/{id}` — single-hazard read for editing (9 Nov 2026, tested)
- [x] `GET /api/v1/vehicles/{id}` — single-vehicle read (9 Nov 2026, tested)

Everything else that baseline doc's gap table flagged turned out to already
exist (hold/escalate/notes actions, `vehicles.clearance_cm`, a general hazards
list) — that table is stale, see §6.

## 3. Functional gaps — `BACKLOG.md` §2

```
████████████████████ 100%  (4 / 4)
```

- [x] F-3 — real online/offline indicator (NetInfo-driven)
- [x] F-5 — dashboard/triage duplication removed
- [x] F-2 — queued report photos are copied into app document storage on
  enqueue (`persistPhoto`/`discardPhoto`/`photoExists` in `offline.ts`);
  verified 9 Nov 2026 — the tracker entry was stale
- [x] F-4 — mission timeline built on a real `dispatch_events` table
  (created/assigned/dispatched/en_route/arrived/completed/cancelled),
  `POST /api/v1/sos/{id}/arrive` on-scene milestone, driver two-step
  arrive→close, and `MissionTimeline` on the portal incident docket

## 4. Security / operations — `BACKLOG.md` §4

```
██████████████░░░░░░ 83%  (5 / 6, excluding S-2's accepted risk)
```

- [x] S-7 — CI gate: every public table has RLS
- [x] S-6 — reporter hash salt / JWT secret rotation procedure documented (`docs/TSD.md` §4.3)
- [x] S-3 — repo went public (10 Nov 2026); also fixed a real bug this surfaced in `codeql.yml`'s own preflight probe (it read a 404 from a repo's first-ever scan as "scanning unavailable", the same code as the private-without-GHAS case — would have stayed permanently skipped even once public). Verified live: both `Analyze` jobs completed, 0 alerts
- [x] S-1 — scoped `metroflow_app` role live on the hosted project (role, password, table/sequence ownership via Supabase MCP) **and** `DATABASE_URL` rotated to it in `backend/.env` + Vercel production; redeployed and verified (login + DB reads) 10 Nov 2026. Migration `d7e2a9c4f815` ships in-repo so CI applies it idempotently
- [ ] 🔶 S-4 — backup/restore runbook + RPO/RTO written; nightly launchd schedule installed (`scripts/com.metroflow.db-backup.plist`, 14-dump retention); drill done against the hosted cluster (dump → scratch DB → `pg_restore` → row counts matched prod exactly → dropped); a restore *over* prod stays a go-ahead-gated runbook step — the free tier has no managed backups to restore from
- [ ] 🔶 S-5 — Android internal EAS build done (preview APK, `com.metroflow.app`, project `@siah0ray/metroflow-mobile`); iOS deferred — needs Apple Developer Program credentials

## 5. UI polish — `BACKLOG.md` §5

```
████████████████████ 100%  (7 / 7)
```

- [x] U-1, U-2, U-3, U-4 — loading states, accessibility pass, colour tokens, splash/error copy
- [x] U-5 — brand palette/typography/motion. Mobile: all `fontSize`/spacing/hex
  literals swept onto `theme.tsx` scales and the extended palette (storm
  overrides are now partial merges). Portal: `brand-*` tokens adopted,
  `text-display`/`text-kpi` steps, shimmer skeletons, page fade-in
- [x] U-6 — turn-by-turn (ETA added to the turn card; icons/manoeuvres already
  existed), profile settings (new `prefs.ts`: hazard-alert and telemetry
  consent toggles wired into `route.tsx`), telemetry display (heading added;
  speed/accuracy/connection/last-sync already shown — no signal-strength API
  exists), report history (Profile entry point + expandable details added)
- [x] U-7 — portal power features: Ctrl/Cmd shortcuts + `?` help, advanced
  queue filters with saved presets, bulk dismiss/restore (triage) and bulk
  approve/reject (moderation), recharts trends panel. Not built: bulk
  assign-to-unit and a dispatch-response-time chart (no data source)

## 6. Quality, tests, CI — `BACKLOG.md` §3

```
████████████████░░░░ 80%  (4 / 5)
```

- [x] Q-3 — mobile lint in CI, clean again (was red on `main` since the F-4 commit over a `useEffect`-based `setState` in `home.tsx` that a newer `eslint-plugin-react-hooks` rule flags; fixed 10 Nov 2026 in passing while touching that file for NFR-023)
- [x] Q-5 — `_cleanup_leftover_rows` autouse fixture in `test_api_integration.py` diffs `sos_requests`/`hazard_zones`/`users` ids and deletes what each test added; a user with audit history is left in place (append-only `audit_logs`, by design), everything else no longer accumulates
- [x] Q-1 — portal component tests now cover `error-notice`, `use-dialog-focus`, `toast-provider`, `sensor-management`, `incident-queue` (9), `dispatch-radar` (8) and `unit-form-modal` (4); the driver app has a jest-expo + `@testing-library/react-native` harness (`jest.config.js`, `__tests__/`, `bun run test:components`) with first coverage on `Avatar`/`initialsOf`/`PasswordField`. Heavier screens still need per-screen native-module mocks
- [x] Q-4 — hazard-publish + network/routing latency measured earlier (NFR-019, 001/002); offline-route planning latency measured 10 Nov 2026 via `metroflow-mobile/benchmarks/offline-route.ts` (p50 ~1 ms at 1600-node scale in the JS runtime; on-device confirmation rides with Q-2)
- [ ] ⛔ Q-2 — offline device test (TC-029/030) — deferred with the pilot/UAT, not an engineering gap right now

## 7. Documentation hygiene (not code)

```
░░░░░░░░░░░░░░░░░░░░ 0%  (0 / 1)
```

- [ ] `docs/design/ADMIN_UI_BASELINE.md`'s gap-analysis table (~130 rows) predates the CR-001 build and still lists things as missing that now exist (hold/escalate/notes actions, `vehicles.clearance_cm`, the general hazards list). Needs a pass to mark those resolved — low priority, it's a reference doc, not the authoritative backlog.

## Explicitly excluded (not implementation work)

- **Out of scope by design:** Evacuation Centers, Comms Streams, Crew Profiles,
  Civic Broadcasts, Air-Asset Escalation, functional offline tile caching,
  real CCTV — all in `AGENTS.md`'s scope constraints.
- **Unapproved future proposals:** CR-002 (offline region packages), CR-003
  (Sentinel-1 satellite ingestion) — change requests, not committed scope.
- **Business/academic paperwork:** budgets, approvals, charter dates, ROI
  figures in `PROJECT_CHARTER.md`, `BUSINESS_CASE.md`, `PROJ_MANAGEMENT_PLAN.md`,
  `APPROVALS.md`, `CR-001..004.md` — explicitly `[TBC]` placeholders for the
  client/sponsor/adviser to fill in, per `docs/README.md`'s own convention.

## Suggested next step

**Q-1/Q-4** are done as far as engineering can take them without hardware:
portal and mobile component-test harnesses both exist, and offline-route
latency is benchmarked. What remains is genuinely external — the Q-2 device
run (offline queue + on-device timing) and UAT.
