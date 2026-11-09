# MetroFlow — What's Left to Implement

**As of:** 9 November 2026 · **Source:** cross-checked against `BACKLOG.md`,
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
████████████░░░░░░░░ 61%  (30.5 / 50 weighted items)
```

---

## 1. Non-Functional Requirements — `docs/BRD.md`

```
███████████████░░░░░ 76%  (19 / 25)
```

- [x] NFR-001, 002 — network state / routing latency within budget (measured, `bench_latency.py`)
- [x] NFR-004 — ZAP scan, 0 High/Medium (false-positive root-caused and fixed; awaiting a live CI run to confirm)
- [x] NFR-005, 006, 007 — secrets, RLS, PII protection
- [x] NFR-008, 010, 011 — triage interaction count, browser support, accessibility (axe-core in CI)
- [x] NFR-012, 013, 014, 015 — migrations-only schema, external config, audit attribution, horizontal scaling
- [x] NFR-017 — units and timezone
- [x] NFR-019 — SSE publish latency ≤100ms p95 (was failing, fixed by lowering the poll interval)
- [x] NFR-020, 021, 022 — role checks, location privacy, telemetry throttle
- [ ] 🔶 NFR-016 — RPO/RTO defined, dump/restore drilled **locally**; the live Supabase dashboard restore against the hosted project is still open (needs `S-1` first)
- [ ] 🔶 NFR-023 — storm/night theme built for the driver app's navigation screen only; Home/SOS/Report/history and the admin portal stay single-theme
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
██████████░░░░░░░░░░ 50%  (2 / 4)
```

- [x] F-3 — real online/offline indicator (NetInfo-driven)
- [x] F-5 — dashboard/triage duplication removed
- [ ] F-2 — queued report photos are file paths the OS may purge; copy into app document storage (S)
- [ ] F-4 — no mission timeline in the portal; needs a data-source decision (derive from timestamps+audit, or add a `dispatch_tasks` event table) before building (M/L)

## 4. Security / operations — `BACKLOG.md` §4

```
█████░░░░░░░░░░░░░░░ 25%  (1.5 / 6, excluding S-2's accepted risk)
```

- [x] S-7 — CI gate: every public table has RLS
- [ ] 🔶 S-4 — backup/restore runbook + RPO/RTO written, drilled locally; live hosted drill still open (needs S-1 first)
- [ ] S-1 — API connects as `postgres`, bypassing RLS; create a scoped `metroflow_app` role, rotate `DATABASE_URL` — **recommended next** (see below)
- [ ] S-5 — internal EAS/TestFlight build needed for pilot distribution
- [ ] S-6 — reporter hash salt / JWT secret rotation procedure undocumented
- [ ] ⛔ S-3 — CodeQL inactive on the private repo — needs a paid GitHub plan

## 5. UI polish — `BACKLOG.md` §5

```
███████████░░░░░░░░░ 57%  (4 / 7)
```

- [x] U-1, U-2, U-3, U-4 — loading states, accessibility pass, colour tokens, splash/error copy
- [ ] U-5 — brand palette/typography/motion sweep (219 hardcoded mobile `fontSize`, 384 spacing values) — deferred post-pilot by design
- [ ] U-6 — turn-by-turn icons/ETA, profile settings, telemetry display, report history
- [ ] U-7 — keyboard shortcuts, advanced filters, bulk actions, charts — deferred by design

## 6. Quality, tests, CI — `BACKLOG.md` §3

```
████████░░░░░░░░░░░░ 40%  (2 / 5)
```

- [x] Q-3 — mobile lint in CI, clean
- [ ] 🔶 Q-1 — backend/admin/mobile automated coverage is in place; React component tests (jsdom/testing-library) still missing
- [ ] 🔶 Q-4 — hazard-publish and network/routing latency now measured (NFR-019, 001/002); on-device offline-route latency still unmeasured
- [ ] ⛔ Q-2 — offline device test (TC-029/030) — deferred with the pilot/UAT, not an engineering gap right now
- [ ] Q-5 — integration tests leave rows behind on a clean run — tidy-up, not urgent

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

**S-1** (database role separation) — the only open item that's pure
engineering, unblocks the live NFR-016 restore drill, and has no client/UAT/
device dependency. It does touch the hosted production database's role
grants, so it needs a careful rollback plan, not a quick pass.
