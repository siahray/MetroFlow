# PROJECT MANAGEMENT PLAN

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

Version 1.2

## Document Information

| Item            | Details                                         |
| --------------- | ----------------------------------------------- |
| Document Title  | Project Management Plan (PMP)                   |
| Project Name    | MetroFlow                                       |
| Project Sponsor | «Project Sponsor»                               |
| Business Owner  | «Client Representative» — LGU Operations (CDMO) |
| Project Manager | «Project Team Lead»                             |
| Budget          | PHP [TBC]                                       |
| Go-Live         | [TBC]                                           |

## Revision History

| Version | Date        | Author                      | Description                                       | Status   |
| ------- | ----------- | --------------------------- | ------------------------------------------------- | -------- |
| 0.1     | 21 Oct 2026 | «Project Team Lead»         | Initial Draft                                     | Draft    |
| 1.0     | 21 Oct 2026 | «QA and Documentation Lead» | Review release                                    | Review   |
| 1.1     | 21 Oct 2026 | «Project Team Lead»         | CR-001: driver PWA, realtime, fleet, sensors      | Proposed |
| 1.2     | 22 Oct 2026 | «Project Team Lead»         | Provider keys, Supabase Auth, Mapbox, template UI | Proposed |

## Approval Sign-Off

| Approver                | Role             | Signature | Date  |
| ----------------------- | ---------------- | --------- | ----- |
| «Project Sponsor»       | Project Sponsor  |           | [TBC] |
| «Client Representative» | Business Owner   |           | [TBC] |
| «Project Adviser»       | Academic Adviser |           | [TBC] |
| «Project Team Lead»     | Project Manager  |           | [TBC] |

## Table of Contents

1. Executive Summary
2. Project Overview
3. Scope Management
4. Project Schedule
5. Resource Management
6. Cost Management
7. RAID Log
8. RACI Matrix
9. Communication Management
10. Testing Management
11. Success Metrics
12. Appendices

## Executive Summary

MetroFlow gives the LGU operations centre a verified picture of road passability
during flooding, a traceable path from field report to dispatch decision, and a
way to warn and reroute drivers before they enter the water. The pilot covers one
corridor, a simulation and routing API, a browser-based dispatch portal and an
installable driver PWA.

This plan defines how the work is executed and controlled: schedule, resources,
cost, risk, quality, communication and change. The project is delivered
incrementally inside a fixed academic term, with a working demonstration at each
milestone rather than a single delivery at the end.

Current position: the baseline API, schema and portal are built and tested. The
CR-001 increment — authentication, report intake, live map, hazard publishing,
fleet dispatch, sensors and the driver PWA — is proposed and planned, pending
sponsor approval. Every unconfirmed date or amount is marked `[TBC]`.

## Project Overview

| Item         | Description                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Purpose      | Replace unverifiable verbal coordination with a shared network picture and a recorded triage decision |
| Users        | LGU dispatchers, rescue commanders, field responders and drivers/commuters using the PWA              |
| Deliverables | API engine, LGU portal, driver PWA, versioned database, CI/CD pipeline, document set, demonstration   |
| Out of scope | Native store builds, real CCTV, carrier-grade SOS, offline tiles, multi-LGU tenancy, public portal    |
| Constraints  | Academic term, part-time effort, no paid Code Security, synthetic data only                           |

### Delivery approach

Weekly iterations, each producing something demonstrable:

| Increment | Demonstrable outcome                                 |
| --------- | ---------------------------------------------------- |
| I1        | Schema, seed graph, network state endpoint           |
| I2        | Rainfall simulation with persisted state             |
| I3        | Clearance-aware routing with GeoJSON output          |
| I4        | Portal shell, login screen, dashboard layout         |
| I5        | Queue, detail panel and operations log               |
| I6        | Dispatch actions, hardening, hosted migrations       |
| I7        | Documentation set and defence preparation            |
| I8        | Auth, report API, hazard publishing and SSE          |
| I9        | LGU live map, moderation and evidence desk           |
| I10       | Fleet, SOS, nearest-unit dispatch and rescue routing |
| I11       | Driver PWA, offline mode and sensor ingestion        |

**Definition of done:** merged to `main`; tests pass for the affected area; lint
and build pass when the web app is touched; the FSD status reflects reality; no
new High or Medium ZAP finding.

## Scope Management

### In scope

- Flood simulation across the pilot road graph.
- Clearance-aware route computation with coordinates, turn instructions and
  hazard avoidance.
- LGU portal: authenticated login, live map, queue, evidence desk, drawing
  tools, fleet, dispatch actions and operations log.
- Driver PWA: navigation, rerouting, proximity alerts, reports, offline mode,
  telemetry and SOS.
- Hazard verification and live publication over SSE.
- River and rain gauge ingestion with advisory road impact.
- Supabase Auth, RBAC and audit writes.
- Versioned PostGIS schema with row-level security.
- Automated build, test, security and migration pipeline for web and mobile.

### Out of scope

- Native iOS or Android store builds.
- Real CCTV integration; a labelled demo registry is used.
- Production SMS, telephony or carrier delivery for SOS.
- Offline basemap tiles; the cached graph is used offline.
- Production single sign-on.
- Multi-LGU tenancy and billing.
- Public information portal.

### Change control

A change request is required when a request adds or removes a deliverable,
crosses the scope boundary, changes a `Must` requirement, moves the schedule by
more than one week, changes the budget, or changes an architecture decision.

```text
Request → Log (CR-nnn) → Impact assessment → Decision → Update documents → Implement
```

No change is implemented before a decision is recorded. Emergency fixes for a
broken `main` may proceed, with the request raised the same day. The template is
in Appendix B.

## Project Schedule

| Phase                                  | Start           | End             | Status      |
| -------------------------------------- | --------------- | --------------- | ----------- |
| Requirements                           | Week 1 · [TBC]  | Week 2 · [TBC]  | Completed   |
| Design                                 | Week 3 · [TBC]  | Week 5 · [TBC]  | Completed   |
| Development — API                      | Week 6 · [TBC]  | Week 9 · [TBC]  | Completed   |
| Development — Portal                   | Week 10 · [TBC] | Week 12 · [TBC] | Completed   |
| Hardening and SIT                      | Week 13 · [TBC] | Week 14 · [TBC] | Completed   |
| Documentation                          | Week 15 · [TBC] | Week 16 · [TBC] | In Progress |
| Demonstration                          | Week 16 · [TBC] | Week 16 · [TBC] | Planned     |
| CR-001 requirements and design         | Week 17 · [TBC] | Week 17 · [TBC] | In Progress |
| Development — realtime, reports, fleet | Week 18 · [TBC] | Week 19 · [TBC] | Planned     |
| Development — LGU map and moderation   | Week 19 · [TBC] | Week 20 · [TBC] | Planned     |
| Development — driver PWA and sensors   | Week 20 · [TBC] | Week 21 · [TBC] | Planned     |
| CR-001 hardening and SIT               | Week 21 · [TBC] | Week 22 · [TBC] | Planned     |
| Final documentation and defence        | Week 22 · [TBC] | Week 22 · [TBC] | Planned     |

Weeks 1–16 are the baseline; CR-001 adds weeks 17–22 `[TBC]`. The increment does
not reopen a completed baseline milestone.

Milestones:

| ID  | Milestone                           | Exit criterion                                        |
| --- | ----------------------------------- | ----------------------------------------------------- |
| M1  | Charter and requirements approved   | Charter and BRD signed off                            |
| M2  | Architecture and data design frozen | TSD accepted; schema drafted                          |
| M3  | API engine operational              | Network, simulation and routing pass contract tests   |
| M4  | Dispatch portal operational         | Triage flow demonstrated end-to-end                   |
| M5  | Hardening complete                  | ZAP clean at High/Medium; no open critical defects    |
| M6  | Baseline documentation and demo     | Baseline document set accepted; baseline demonstrated |
| M7  | Realtime, reports and fleet API     | Auth, reports, hazards, SSE and fleet contract tests  |
| M8  | LGU map, moderation and dispatch    | Map, evidence, draw/publish and dispatch E2E          |
| M9  | Driver PWA, sensors and defence     | Offline E2E, sensor impact and panel demonstration    |

**Critical path:** requirements → data model → simulation → routing → auth →
reports and hazards → SSE → fleet and dispatch → map → driver PWA → hardening →
defence. The sensor path runs in parallel but is not done until a threshold
breach reaches the map as an advisory without publishing a hazard.

## Resource Management

| Role                       | Resource                    | Allocation |
| -------------------------- | --------------------------- | ---------- |
| Project Manager            | «Project Team Lead»         | 50%        |
| Business Analyst           | «Client Representative»     | 20%        |
| Architect                  | «Project Team Lead»         | 30%        |
| Backend Developers         | «Backend Lead»              | 100%       |
| Frontend Developers        | «Frontend Lead»             | 100%       |
| Mobile/PWA Developer       | «Mobile Lead»               | 100%       |
| UX Designer                | «UX Lead»                   | 40%        |
| QA and Documentation       | «QA and Documentation Lead» | 60%        |
| Adviser                    | «Project Adviser»           | 5%         |
| Dispatcher representatives | «Lead Dispatcher»           | 5%         |

Allocations are part-time estimates against a nominal working week. One person
may hold more than one role; every role must have a named person before M2.

## Cost Management

| Category                                    | Amount (PHP) |
| ------------------------------------------- | ------------ |
| Baseline development effort (in-kind)       | [TBC]        |
| CR-001 PWA and realtime increment (in-kind) | [TBC]        |
| Hosted database                             | [TBC]        |
| Application hosting                         | [TBC]        |
| PWA hosting and CDN                         | [TBC]        |
| Evidence storage                            | [TBC]        |
| Map, weather and data services              | [TBC]        |
| Domain and TLS                              | [TBC]        |
| Test devices and data                       | [TBC]        |
| Training and handover                       | [TBC]        |
| Contingency (10%)                           | [TBC]        |
| **Total**                                   | **[TBC]**    |

Rules:

1. No paid service is subscribed without sponsor approval.
2. Free tiers are the default; exceeding one requires a documented reason.
3. Effort is tracked weekly so the in-kind cost in the business case is real.

## RAID (Risks, Assumptions, Issues and Dependencies) Log

| ID    | Type       | Description                                                       | Owner            | Impact | Status        |
| ----- | ---------- | ----------------------------------------------------------------- | ---------------- | ------ | ------------- |
| R-001 | Risk       | Scope creep beyond the approved CR-001 boundary                   | PM               | High   | Open          |
| R-002 | Risk       | Hydrological model judged unrealistic                             | Backend Lead     | High   | Open          |
| R-003 | Risk       | Loss of a team member                                             | PM               | Medium | Open          |
| R-004 | Risk       | Hosted database never configured                                  | Backend Lead     | Medium | Open          |
| R-005 | Risk       | Security findings surface late                                    | QA               | Medium | Open          |
| R-006 | Risk       | Institutional format differs from the document set                | PM               | Low    | Open          |
| R-007 | Risk       | Authentication slips past the CR-001 release gate                 | PM               | High   | Open          |
| R-008 | Risk       | No baseline data from the client                                  | Business Analyst | Medium | Open          |
| R-009 | Risk       | Pilot corridor changes late                                       | Business Analyst | Medium | Open          |
| R-010 | Risk       | Hosted costs exceed the free tier                                 | Backend Lead     | Low    | Open          |
| R-011 | Risk       | GitHub or Supabase outage during a milestone                      | PM               | Low    | Open          |
| R-012 | Risk       | Dispatchers reject the tool                                       | Frontend Lead    | Medium | Open          |
| R-013 | Risk       | A commercial platform is chosen later                             | PM               | Low    | Open          |
| R-014 | Risk       | Personal data incident during testing                             | QA               | Medium | Open          |
| R-015 | Risk       | Drivers do not adopt the PWA                                      | PM               | High   | Open          |
| R-016 | Risk       | PWA background limits on iOS                                      | Mobile Lead      | Medium | Open          |
| R-017 | Risk       | Driver location privacy incident                                  | QA               | Medium | Open          |
| R-018 | Risk       | Sensor false positives trigger unnecessary closures               | Backend Lead     | Medium | Open          |
| R-019 | Risk       | Event stream overload or dropped updates                          | Backend Lead     | Medium | Open          |
| R-020 | Risk       | Evidence upload abuse exhausts storage                            | Backend Lead     | Medium | Open          |
| A-001 | Assumption | PostGIS-capable PostgreSQL is available                           | Backend Lead     | High   | Open          |
| A-002 | Assumption | Pilot corridor is representative enough to demonstrate routing    | PM               | Medium | Open          |
| A-003 | Assumption | Free or institutional tiers suffice for the pilot                 | PM               | Medium | Open          |
| A-004 | Assumption | Dispatchers have a modern browser and connectivity                | Business Analyst | High   | Open          |
| A-005 | Assumption | Rainfall intensity is supplied manually or from public data       | Backend Lead     | Medium | Open          |
| A-006 | Assumption | Client provides corridor and barangay naming                      | Business Analyst | Low    | Open          |
| A-007 | Assumption | Drivers have a smartphone with camera and geolocation             | Business Analyst | High   | Open          |
| A-008 | Assumption | Connectivity can drop during an event                             | PM               | High   | Open          |
| A-009 | Assumption | Sensor data may be simulated but is labelled                      | Backend Lead     | Medium | Open          |
| A-010 | Assumption | Mapbox tiles are available on the pilot tier; OSM is the fallback | Frontend Lead    | Low    | Open          |
| A-011 | Assumption | Client supplies the HTML/CSS template derived from Figma          | Business Analyst | Medium | Open          |
| I-001 | Issue      | No authentication on the baseline API or portal                   | PM               | High   | Open (CR-001) |
| I-002 | Issue      | Incident data in the baseline portal is mock data                 | Frontend Lead    | Medium | Open (CR-001) |
| I-003 | Issue      | CodeQL cannot run on the private repository                       | QA               | Medium | Workaround    |
| I-004 | Issue      | CCTV is a demo registry and gauges may be simulated               | Business Analyst | Medium | Accepted      |
| I-005 | Issue      | CR-001 increment is planned, not implemented                      | PM               | High   | Open          |
| D-001 | Dependency | Hosted database connection string supplied as a repository secret | Business Analyst | High   | Open          |
| D-002 | Dependency | Adviser and panel availability for reviews                        | PM               | Medium | Open          |
| D-003 | Dependency | Client confirms the pilot corridor                                | Business Analyst | High   | Open          |
| D-004 | Dependency | Supabase credentials and pilot accounts supplied at deployment    | Backend Lead     | High   | Open          |
| D-005 | Dependency | Persistent evidence volume or object storage                      | Backend Lead     | High   | Open          |
| D-006 | Dependency | Mapbox and OSM tiles remain reachable within their usage policies | Frontend Lead    | Low    | Open          |
| D-007 | Dependency | Weather, terrain and imagery providers remain within quota        | Backend Lead     | Low    | Open          |
| D-008 | Dependency | Client supplies the HTML/CSS template before UI implementation    | Frontend Lead    | High   | Open          |

Risk scoring and detailed responses are in Appendix A.

## RACI Matrix

R = responsible, A = accountable, C = consulted, I = informed.

| Activity               | Sponsor | PM  | BA  | DEV | QA  |
| ---------------------- | ------- | --- | --- | --- | --- |
| Requirements           | A       | C   | R   | I   | I   |
| Architecture           | I       | A   | C   | R   | C   |
| Backend development    | I       | A   | I   | R   | C   |
| Portal development     | I       | A   | C   | R   | C   |
| Driver PWA development | I       | A   | C   | R   | C   |
| Realtime event stream  | I       | A   | I   | R   | C   |
| Sensor ingestion       | I       | A   | C   | R   | C   |
| Test strategy          | I       | A   | I   | C   | R   |
| Security scan          | I       | A   | I   | C   | R   |
| Hosted migration       | I       | A   | C   | R   | C   |
| Documentation          | A       | R   | C   | C   | R   |
| UAT and demonstration  | A       | R   | C   | C   | C   |
| Change approval        | A       | R   | C   | I   | I   |

## Communication Management

| Audience              | Frequency     | Method                                |
| --------------------- | ------------- | ------------------------------------- |
| Project team          | Twice weekly  | Stand-up                              |
| Project adviser       | Bi-weekly     | Review meeting                        |
| Project sponsor       | At milestones | Written status report                 |
| Dispatcher users      | M4, M5 and M8 | Demo and usability session            |
| Rescue commanders     | M8            | Dispatch walkthrough                  |
| Driver pilot group    | M9            | Guided install and offline field test |
| Steering stakeholders | Monthly       | Progress briefing                     |
| Panel                 | M9            | Document submission and demonstration |

**Escalation:** blocker at stand-up → owner resolves within one day → «Project
Team Lead» → «Project Adviser» / «Project Sponsor» for scope. Academic or ethical
concerns go to the adviser immediately.

## Testing Management

| Phase              | Owner        | Exit Criteria                                                       |
| ------------------ | ------------ | ------------------------------------------------------------------- |
| Unit tests         | DEV          | All pass; hydrology and routing edge cases covered                  |
| Contract tests     | QA + DEV     | Every endpoint returns the documented shape and status codes        |
| Static checks      | QA           | ESLint, TypeScript and production build pass                        |
| Database migration | DEV          | `alembic upgrade head` on a clean database; `alembic check` clean   |
| Security scan      | QA           | No High or Medium ZAP findings                                      |
| System integration | QA           | End-to-end triage flow works against the running stack              |
| Mobile unit        | Mobile Lead  | Navigation, depth, throttle, cache and queue logic pass             |
| Offline E2E        | QA           | Cached route renders offline and a queued report syncs exactly once |
| Realtime           | Backend Lead | Publish event reaches SSE under 100 ms p95 in the test harness      |
| Upload security    | QA           | Oversize, wrong MIME and EXIF-bearing images handled correctly      |
| UAT                | Business     | Dispatcher and driver complete the scripted scenarios; sign-off     |
| Regression         | QA           | No S1 or S2 defects open before demonstration                       |

| Test type              | Tool                                       |
| ---------------------- | ------------------------------------------ |
| Unit                   | pytest (`-m "not integration"`)            |
| Contract / integration | pytest (`-m integration`) against PostGIS  |
| Web lint and types     | ESLint, `next build`                       |
| Web unit               | Bun test                                   |
| Driver unit            | Bun test                                   |
| Browser E2E            | Playwright (online and offline contexts)   |
| Security               | OWASP ZAP API scan, CodeQL (when licensed) |
| Migration              | Alembic                                    |
| Exploratory            | Scripted browser session                   |

## Success Metrics

| KPI                                           | Target                        |
| --------------------------------------------- | ----------------------------- |
| `Must` requirements accepted                  | 100% by M9                    |
| Report-to-triage time                         | Below the M1 baseline `[TBC]` |
| Decisions with actor, timestamp and action    | 100%                          |
| Dispatch attempts aborted for road conditions | 0 per event                   |
| High/Medium security findings                 | 0                             |
| CI pass rate                                  | ≥ 95%                         |
| Requirement coverage                          | 100% of `Must` by M9          |
| System Usability Scale                        | ≥ 75 `[TBC]`                  |
| Hazard publish to SSE event                   | ≤ 100 ms at p95, server-side  |
| Offline route and queued report               | 100% of scripted runs         |
| Privileged actions blocked without a role     | 100%                          |
| SOS acknowledged within the pilot target      | `[TBC]`                       |
| Reports with a recorded moderation outcome    | 100%                          |

## Appendices

### Appendix A — Risk scoring and responses

Probability and impact are scored High (3), Medium (2), Low (1); score is their
product. Risks scoring 6 or above are reviewed weekly.

| ID    | Risk                           | P   | I   | Score | Response                                                         | Trigger                             |
| ----- | ------------------------------ | --- | --- | ----- | ---------------------------------------------------------------- | ----------------------------------- |
| R-001 | Scope creep beyond CR-001      | 3   | 3   | 9     | Hold the CR-001 boundary; every addition needs a CR              | New feature requested mid-iteration |
| R-002 | Model judged unrealistic       | 3   | 3   | 9     | Declare calibration; validate against documented events          | Adviser or client challenges output |
| R-003 | Loss of a team member          | 2   | 3   | 6     | Pair on critical paths; record decisions                         | Missed stand-ups for a week         |
| R-004 | Hosted database not configured | 3   | 2   | 6     | Local stack is the primary demo; CD is gated and visible         | Secret absent at M5                 |
| R-005 | Late security findings         | 2   | 3   | 6     | Weekly ZAP gate from the first increment                         | New Medium finding                  |
| R-006 | Format mismatch                | 2   | 2   | 4     | Confirm the rubric at M1                                         | Adviser requests restructuring      |
| R-007 | Authentication not delivered   | 3   | 3   | 9     | CR-001 makes Supabase Auth/RBAC a release gate before acceptance | Pilot asked to handle real data     |
| R-008 | No baseline data               | 3   | 2   | 6     | Use audit-trail and risk benefits; collect during pilot          | Baseline absent at M1 review        |
| R-009 | Corridor changes late          | 2   | 3   | 6     | Freeze the corridor at M2                                        | New barangay list arrives           |
| R-010 | Hosted costs exceed free tier  | 2   | 2   | 4     | Keep hosting provider-agnostic                                   | Usage warning from provider         |
| R-011 | Provider outage or quota       | 2   | 3   | 6     | OSM fallback, manual rainfall, cached derived data               | Provider status page or quota alert |
| R-012 | Dispatchers reject the tool    | 2   | 3   | 6     | Usability sessions from M4; keep the radio process running       | Negative feedback in session        |
| R-013 | Commercial alternative chosen  | 1   | 2   | 2     | Publish the API contract; routing engine outlives the portal     | Procurement announcement            |
| R-014 | Personal data incident         | 1   | 3   | 3     | Synthetic data only; RLS verified; no personal data in logs      | Any real report used in a demo      |
| R-015 | Drivers do not adopt the PWA   | 3   | 3   | 9     | Usability tests; QR onboarding; synthetic reports fallback       | Low install or report count at M9   |
| R-016 | PWA background limits          | 2   | 2   | 4     | Foreground telemetry; document the limit                         | Telemetry gap on iOS devices        |
| R-017 | Location privacy incident      | 2   | 3   | 6     | Rounding, hashing, retention, role-only access                   | Unrounded coordinate in a response  |
| R-018 | Sensor false positive          | 2   | 2   | 4     | Advisory until confirmed; debounce; per-sensor thresholds        | Advisory without a matching flood   |
| R-019 | Event stream overload          | 2   | 2   | 4     | Redis pub/sub; bounded queues; reconnect snapshot                | SSE lag above target                |
| R-020 | Evidence storage abuse         | 2   | 2   | 4     | Size cap, MIME sniff, rate limit, random keys                    | Volume usage spikes unexpectedly    |

### Appendix B — Change request template

```text
CR id:             CR-nnn
Raised by:         <name>              Date: <date>
Description:       <what is being asked>
Reason:            <why>
Impact — scope:    <requirements affected>
Impact — schedule: <weeks>
Impact — cost:     <amount or none>
Impact — risk:     <new or changed risks>
Decision:          <approved / deferred / rejected>   By: <name>   Date: <date>
Documents updated: <list>
```

### Appendix C — Milestone status report template

```text
Milestone:            M<n> — <name>
Period:               <start> to <end>
Exit criteria met:    <yes/no, with evidence>
Schedule variance:    <days>
Open risks:           <ids and scores>
Open issues:          <ids and severity>
Decisions required:   <list>
Confidence in next:   <high/medium/low + reason>
```

### Appendix D — Configuration and documentation management

| Item              | Rule                                                              |
| ----------------- | ----------------------------------------------------------------- |
| Branching         | Short-lived feature branches; `main` always releasable            |
| Commit messages   | Imperative summary; body explains why                             |
| Pull requests     | Review, green CI and a requirement reference                      |
| Tags              | `backend-v*` for container releases                               |
| Secrets           | Never committed; backend host env or repository secrets           |
| Public keys       | `NEXT_PUBLIC_*` only; origin- and scope-restricted, never secrets |
| UI source         | Client HTML/CSS template; no bespoke design without a change      |
| Pre-commit        | Husky: Ruff for Python, ESLint and Prettier for web and mobile    |
| Driver PWA        | Separate Bun package in `mobile-driver/`; own lockfile and build  |
| Document versions | Increment on approval; revision history updated                   |
| Traceability      | Requirement ids are stable; changes add rows, never renumber      |
| Unknowns          | `[TBC]` and `«placeholder»` are explicit, never silently invented |

### Appendix E — Decision log

| ID      | Decision                               | Date  | Decided by          | Recorded in                   |
| ------- | -------------------------------------- | ----- | ------------------- | ----------------------------- |
| ADR-001 | Alembic owns the schema                | [TBC] | «Project Team Lead» | TSD §6                        |
| ADR-002 | Supabase as hosted Postgres            | [TBC] | «Project Team Lead» | TSD §6                        |
| ADR-007 | RLS deny-by-default                    | [TBC] | «Backend Lead»      | TSD §6                        |
| ADR-011 | Portal ships with mock data            | [TBC] | «Project Team Lead» | TSD §6 (superseded by CR-001) |
| ADR-014 | Driver client is a PWA                 | [TBC] | «Project Team Lead» | TSD §6                        |
| ADR-015 | SSE over Redis pub/sub                 | [TBC] | «Backend Lead»      | TSD §6                        |
| ADR-016 | Supabase Auth + app RBAC               | [TBC] | «Backend Lead»      | TSD §6                        |
| ADR-017 | Local evidence volume                  | [TBC] | «Backend Lead»      | TSD §6                        |
| ADR-018 | Offline uses cached graph              | [TBC] | «Mobile Lead»       | TSD §6                        |
| ADR-019 | Mapbox tiles in MapLibre               | [TBC] | «Frontend Lead»     | TSD §6                        |
| ADR-020 | One live provider; preprocess the rest | [TBC] | «Backend Lead»      | TSD §6                        |

### Appendix F — Closure and handover

- [ ] All `Must` functional requirements accepted (FSD), including BR-013 to BR-018.
- [ ] CI green on `main`; ZAP clean at High/Medium.
- [ ] Hosted database at head, or the limitation documented.
- [ ] Supabase Auth/RBAC verified; role violations return 403 and change nothing.
- [ ] Offline E2E and hazard publish latency tests pass.
- [ ] Simulated sensors and demo CCTV labelled in the product.
- [ ] Document set approved, including CR-001.
- [ ] Repository access granted per institutional rule.
- [ ] Handover session delivered to «Client Representative».
- [ ] Known limitations communicated in writing (TSD §7).

Post-implementation review, one month after handover or after the first rain
event: were the benefits realised, did the system hold up, and what was missing?
The next increment is no longer authentication or intake; candidates are a real
sensor/CCTV agreement, a native client, or multi-LGU tenancy, decided by the
sponsor under change control.
