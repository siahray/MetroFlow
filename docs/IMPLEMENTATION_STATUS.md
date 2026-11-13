# MetroFlow — What's Left to Implement

**As of:** 13 November 2026 · **Source:** cross-checked against `BACKLOG.md`,
`docs/BRD.md`, `docs/TSD.md`, `docs/design/*_BASELINE.md`, and the actual code
(`backend/main.py`, `models.py`, test suites) — not just what the docs claim.

**Methodology:** each item below is ✅ Done, 🔶 Partial, ⬜ Open (ours to build),
or ⛔ Blocked (needs something we don't control — a client baseline, real
users, a physical device, or budget). Bars score ✅ = 1, 🔶 = 0.5, ⬜/⛔ = 0,
over the items in that section. Blocked items count against the bar — they
genuinely aren't done — but no amount of engineering time fixes them, so don't
read a low bar there as "needs more coding." Out-of-scope features (Evacuation
Centers, Comms Streams, Crew Profiles, Broadcasts, Air-Asset Escalation,
offline map regions and satellite observations as final-product proposals)
and business paperwork (budgets, approvals,
charter dates) are excluded entirely — they were never engineering work.

## Overall

```
████████████████░░░░ 83%  (41.5 / 50 weighted items)
```

---

## Open backlog at a glance

Every ⬜/🔶/⛔ item from the sections below, sorted by whether it's ours to
pick up right now or needs something outside engineering first. Each row
links to its full writeup via the ID.

### Ready to implement (no external dependency)

| ID | What's left | Where |
|----|-------------|-------|
| NFR-001/002/019 | Re-measured 13 Nov 2026 against the real Quezon City network over the hosted deployment: all three budgets missed by 11–14.7×. Profiled and fixed two real causes same day (NFR-001/002 only — see §1); still not met, remaining work is a clean re-measurement without a concurrent SSE client and a decision on the hosted-database round trip itself (NFR-019 untouched, unaffected by either fix) | §1, `TSD.md` LIM-028 |

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
██████████████░░░░░░ 74%  (18.5 / 25)
```

- [ ] 🔶 NFR-001, 002 — network state / routing latency within budget. Was Done against the 34-node synthetic lattice over a local database; re-measured 13 Nov 2026 against the real Quezon City network over the hosted deployment and found not met (p95 ≈5,585 ms / ≈2,934 ms vs. 500 ms / 200 ms budgets). Two real code-level causes found and fixed same day (routing's unscoped geometry fetch; network-state's slow generic JSON serializer) — re-measured median improved for both, but network-state's p95 got worse due to a concurrent SSE client holding a DB connection during the benchmark, and the underlying hosted-DB round trip is untouched by either fix. **Still not met**; a clean re-measurement and the round-trip latency itself are still open (`bench_latency.py`, `BRD.md`, `TSD.md` LIM-028)
- [x] NFR-004 — ZAP scan, 0 High/Medium (false-positive root-caused and fixed; awaiting a live CI run to confirm)
- [x] NFR-005, 006, 007 — secrets, RLS, PII protection
- [x] NFR-008, 010, 011 — triage interaction count, browser support, accessibility (axe-core in CI)
- [x] NFR-012, 013, 014, 015 — migrations-only schema, external config, audit attribution, horizontal scaling
- [x] NFR-017 — units and timezone
- [ ] 🔶 NFR-019 — SSE publish latency ≤100ms p95. Was Done locally (poll interval fix); re-measured 13 Nov 2026 against the hosted deployment and **not currently met** (p95 ≈1,374 ms — same cause as NFR-001/002, `TSD.md` LIM-028)
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
████████████████████ 100%  (1 / 1)
```

- [x] `docs/design/ADMIN_UI_BASELINE.md`'s gap-analysis table (~130 rows, across §9's four data-delta tables and four API-call tables) swept against `backend/main.py`'s actual routes (10 Nov 2026): hold/escalate/notes/duplicate, the hazard `name`/`avg_depth_cm`/`edge_id` columns, publish/withdraw, and `vehicles.clearance_cm` are now marked `Done`; Civic Broadcasts, Evacuation Centers, Crew Profiles, Comms Streams and Air-Asset Escalation are marked `Out of scope` (settled per `AGENTS.md`) instead of left as open `[TBD]`. Genuinely open and left as such: ranked dispatch candidates, mission reroute, decision/audit as one block.

## Explicitly excluded (not implementation work)

- **Out of scope by design:** Evacuation Centers, Comms Streams, Crew Profiles,
  Civic Broadcasts, Air-Asset Escalation, functional offline tile caching,
  real CCTV — all in `AGENTS.md`'s scope constraints.
- **Unapproved future-product proposals:** offline region packages, Sentinel-1
  satellite ingestion — recorded as final-product scope, not committed for the pilot.
- **Business/academic paperwork:** budgets, approvals, charter dates, ROI
  figures in `PROJECT_CHARTER.md`, `BUSINESS_CASE.md`, `PROJ_MANAGEMENT_PLAN.md`,
  `APPROVALS.md` — explicitly `[TBC]` placeholders for the
  client/sponsor/adviser to fill in, per `docs/README.md`'s own convention.

## Suggested next step

There is no more purely-engineering, no-dependency work left on the board.
Everything open now needs either the lead dev's go-ahead on a destructive
step (S-4/NFR-016's live restore drill), an account this project doesn't
have (S-5's Apple Developer membership), or real users/hardware (Q-2,
NFR-003/009/018/024/025). The project is at a natural pause point for
engineering; what's next is a decision, not a task.
