# PROJECT CHARTER

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

## Document Information

| Item                    | Details         |
| ----------------------- | --------------- |
| Project Name            | MetroFlow       |
| Project Classification  | Simple          |
| Document Classification | Internal Use    |
| Prepared By             | «Project Team»  |
| Version No.             | 1.2             |
| Date Prepared           | 21 October 2026 |

## Revision History

| Version | Date Updated | Updated By          | Description                                               | Section Updated  |
| ------- | ------------ | ------------------- | --------------------------------------------------------- | ---------------- |
| 1.0     | 21 Oct 2026  | «Project Team Lead» | Initial Release                                           | All Sections     |
| 1.1     | 21 Oct 2026  | «Project Team Lead» | CR-001: driver app, live hazards, fleet dispatch, sensors | A, B, C, D, E, F |
| 1.2     | 22 Oct 2026  | «Project Team Lead» | Provider keys, Supabase Auth, Mapbox tiles, template UI   | A, B, C, D       |

## A. PROJECT OVERVIEW

| Item               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose            | Give the LGU operations centre a verified picture of road passability during flooding, a traceable path from field report to dispatch decision, and a way to warn and reroute drivers before they enter the water.                                                                                                                                                                                                                                                                                                      |
| Business Goals     | Faster triage; no dispatch into impassable roads; no driver routed into a verified hazard; decisions that can be reviewed after the event; one shared operational picture between the LGU and the road.                                                                                                                                                                                                                                                                                                                 |
| Project Objectives | OBJ-001 model flood depth on the road graph; OBJ-002 compute clearance-aware routes; OBJ-003 provide a triage workspace; OBJ-004 record every decision; OBJ-005 deliver through an automated pipeline; OBJ-006 document the system to a reviewable standard; OBJ-007 publish verified hazards to drivers in real time; OBJ-008 provide offline navigation and reporting; OBJ-009 support live fleet dispatch; OBJ-010 ingest sensor data and flag impacted roads.                                                       |
| Project Scope      | Flood simulation, clearance-aware routing with coordinates and turn instructions, the LGU dispatch portal (live map, moderation queue, evidence desk, drawing tools, fleet and dispatch), the driver app (navigation, rerouting, reports, offline, SOS), API-issued tokens and RBAC, SSE publishing, river and rain gauge ingestion, versioned PostGIS schema with row-level security, and automated build/test/security checks.                                                                                                |
| Assumptions        | A PostGIS-capable database is available (A-001); the corridor is representative (A-002); free or institutional tiers suffice (A-003); dispatchers have a modern browser (A-004); rainfall is supplied manually with optional OpenWeather data (A-005); the client provides naming (A-006); drivers have a smartphone with camera and geolocation (A-007); connectivity can drop (A-008); sensor data may be simulated but labelled (A-009); Mapbox tiles are available on the pilot tier, with OSM as fallback (A-010). |
| Constraints        | Delivery must fit the academic term (C-001); effort is part-time (C-002); no paid Code Security (C-003); only synthetic or public data (C-004); no committed credentials and origin-restricted public keys (C-005); the driver client is a native Expo app and a public store release is a later gate (C-006); CCTV is a labelled demo registry (C-007); basemap tiles are online-only (C-008); the pilot is single-LGU (C-009); UI follows the client-supplied HTML/CSS template (C-010).                                                                  |

**Out of scope:** public App Store or Play Store releases, real CCTV integration,
production SMS or telephony for SOS, offline basemap tiles, multi-LGU tenancy,
production single sign-on and a public information portal. Moving an item across
this boundary requires a change request under
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md); CR-001 is the change request
that brings the driver app, live hazards, fleet dispatch and sensor ingestion
into scope once approved.

## B. PROJECT SCHEDULE

| Item                     | Value                                                       |
| ------------------------ | ----------------------------------------------------------- |
| Start Date               | [TBC]                                                       |
| Cutover Date             | [TBC]                                                       |
| Period (Weeks)           | 22 weeks [TBC] — 16-week baseline plus the CR-001 increment |
| Assigned Project Manager | «Project Team Lead»                                         |
| Duration Estimate        | 6 months [TBC]                                              |

### OPEX

| No. | Cost Description               | Amount (PHP) |
| --- | ------------------------------ | ------------ |
| 1   | Hosted database (Supabase)     | [TBC]        |
| 2   | Application hosting            | [TBC]        |
| 3   | Domain and TLS                 | [TBC]        |
| 4   | Training and change management | [TBC]        |
| 5   | EAS build and app distribution | [TBC]        |
| 6   | Evidence photo storage         | [TBC]        |
|     | **Total OPEX**                 | **[TBC]**    |

### CAPEX

| No. | Cost Description                                 | Amount (PHP) |
| --- | ------------------------------------------------ | ------------ |
| 1   | Baseline development effort (in-kind)            | [TBC]        |
| 2   | CR-001 increment: native app, realtime, fleet (in-kind) | [TBC]        |
| 3   | Test devices and data                            | [TBC]        |
| 4   | Contingency (10%)                                | [TBC]        |
|     | **Total CAPEX**                                  | **[TBC]**    |

No funds are requested at charter stage. Every amount is `[TBC]` until
quotations and the institution's rules are confirmed; approval of this charter
does not approve expenditure. The cost model is in
[BUSINESS_CASE.md](BUSINESS_CASE.md).

## C. STAKEHOLDERS

| Division / Department    | Name                        | Role & Responsibilities                                                     | Contact Details |
| ------------------------ | --------------------------- | --------------------------------------------------------------------------- | --------------- |
| MDRRMC / «Client LGU»    | «Project Sponsor»           | Funds, authorises and accepts the pilot; resolves escalated scope decisions | [TBC]           |
| LGU Operations (CDMO)    | «Client Representative»     | Business owner; provides corridor data, access and operational validation   | [TBC]           |
| Operations Centre        | «Lead Dispatcher»           | Primary user; participates in usability sessions and acceptance             | [TBC]           |
| LGU IT                   | «IT Representative»         | Infrastructure, accounts and handover                                       | [TBC]           |
| «Institution»            | «Project Adviser»           | Academic oversight; quality gate for deliverables                           | [TBC]           |
| Applications Development | «Project Team Lead»         | Delivery accountability, architecture and change control                    | [TBC]           |
| Applications Development | «Backend Lead»              | Simulation, routing, API, database                                          | [TBC]           |
| Applications Development | «Frontend Lead»             | Dispatch portal usability and behaviour                                     | [TBC]           |
| Applications Development | «QA and Documentation Lead» | Tests, CI gates, security scan and document set                             | [TBC]           |
| Barangay responders      | «Field Unit Lead»           | Consume routes and dispatch instructions; validate field usability          | [TBC]           |
| Rescue command           | «Rescue Commander»          | Approves dispatch and validates rescue routing                              | [TBC]           |
| Drivers and commuters    | «Driver Representative»     | Pilot the app; validate warnings, reporting and offline behaviour           | [TBC]           |
| Sensor / data owner      | «Data Representative»       | Supplies gauge locations, thresholds and simulated readings                 | [TBC]           |

Roles may be combined depending on team size. The RACI detail is in
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md).

## D. ISSUE / RISK

| No.   | Type       | Key Issue/Risk                                      | Category   | Mitigation Plan                                                                                |
| ----- | ---------- | --------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| R-001 | Risk       | Scope grows beyond the approved CR-001 boundary     | Schedule   | Hold the CR-001 boundary; every further addition requires a change request                     |
| R-002 | Risk       | Hydrological model judged unrealistic               | Technical  | Declare calibration constants; validate against documented events; present as decision support |
| R-003 | Risk       | Loss of a team member                               | Resource   | Pair on every critical path; record decisions in the TSD                                       |
| R-004 | Risk       | Hosted database never configured                    | Delivery   | Local stack is the primary demonstration; the CD workflow is gated and visible                 |
| R-005 | Risk       | Security findings surface late                      | Security   | Weekly ZAP gate from the first increment                                                       |
| R-006 | Risk       | Drivers do not adopt the app                        | Adoption   | Usability tests; QR onboarding; synthetic reports as fallback                                  |
| R-007 | Risk       | Background-location limits on iOS                   | Technical  | Foreground fallback; permission and device tests; document the limit                           |
| R-008 | Risk       | Driver location privacy incident                    | Compliance | Rounding, hashing, 24-hour retention, role-only access, synthetic testing                      |
| R-009 | Risk       | Provider quota or outage degrades maps or rainfall  | Technical  | OSM fallback, manual rainfall, cached derived data, usage alerts                               |
| R-010 | Risk       | UI template arrives late or diverges from the FSD   | Schedule   | Treat the FSD behaviour as fixed and the template as visual; review on arrival                 |
| I-001 | Issue      | Authentication is not implemented in baseline       | Business   | Closed 27 Oct 2026: API-issued tokens with per-route role checks; rate limiting remains open (LIM-006)  |
| I-002 | Issue      | Baseline incident data is mock data                 | Business   | CR-001 replaces it with the persisted report API                                               |
| I-003 | Issue      | CCTV is a demo registry and gauges may be simulated | Business   | Label both in the API and UI; record the limitation in TSD §7                                  |
| D-001 | Dependency | Client supplies the hosted database secret          | Delivery   | Track at every milestone review                                                                |
| D-002 | Dependency | Supabase project credentials and pilot accounts     | Delivery   | Startup fails closed when Auth configuration is absent                                         |
| D-003 | Dependency | Evidence upload volume or object storage            | Delivery   | Mount a persistent volume for the pilot; storage interface allows a later swap                 |
| D-004 | Dependency | Weather, terrain and imagery providers within quota | Delivery   | Manual rainfall, OSM fallback and cached derived data keep the pilot running                   |

The full RAID log, scoring and owners are in
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md).

## E. KEY DELIVERABLES AND MILESTONES

| ID   | Deliverable                    | Acceptance condition                                                                                |
| ---- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| D-01 | Simulation and routing API     | Contract tests pass; endpoints behave as specified in [api.md](api.md)                              |
| D-02 | LGU dispatch portal            | Both screens usable end-to-end for triage                                                           |
| D-03 | Database schema and migrations | Clean `alembic upgrade head`; `alembic check` reports no drift                                      |
| D-04 | CI/CD pipeline                 | Tests, lint, build, security scan and hosted migrations run from the repo                           |
| D-05 | Document set                   | Charter, BRD, business case, FSD, TSD, PMP and API reference accepted                               |
| D-06 | Demonstration                  | Live walkthrough of simulation → routing → triage → dispatch                                        |
| D-07 | Driver app                     | EAS internal build from the supplied template; navigation, reports, offline queue, SOS and telemetry |
| D-08 | LGU live map and moderation    | Template-derived UI; MapLibre layers, evidence desk, approve/reject, draw and publish               |
| D-09 | Fleet and dispatch             | Unit status, nearest-unit ranking, flood-safe rescue route                                          |
| D-10 | Auth, RBAC and sensors         | Supabase roles, audit writes, gauge ingestion and advisory road impact                              |

| ID  | Milestone                           | Exit criterion                                                  | Target          |
| --- | ----------------------------------- | --------------------------------------------------------------- | --------------- |
| M1  | Charter and requirements approved   | Charter and BRD signed off                                      | Week 2 · [TBC]  |
| M2  | Architecture and data design frozen | TSD accepted; schema drafted                                    | Week 5 · [TBC]  |
| M3  | API engine operational              | Simulate, network state and route endpoints pass contract tests | Week 9 · [TBC]  |
| M4  | Dispatch portal operational         | Triage flow demonstrated with queue, detail and actions         | Week 12 · [TBC] |
| M5  | Hardening complete                  | ZAP clean at High/Medium; no open critical defects              | Week 14 · [TBC] |
| M6  | Baseline documentation accepted     | Baseline document set accepted                                  | Week 16 · [TBC] |
| M7  | Realtime, reports and fleet API     | Auth, reports, hazards, SSE and fleet pass contract tests       | Week 18 · [TBC] |
| M8  | LGU map, moderation and dispatch    | Map, evidence desk, draw/publish and dispatch demonstrated      | Week 20 · [TBC] |
| M9  | Driver app, sensors and defence     | Offline E2E, sensor impact and panel demonstration complete     | Week 22 · [TBC] |

## F. SUCCESS CRITERIA

| ID     | Criterion                                                                 | Verification                       |
| ------ | ------------------------------------------------------------------------- | ---------------------------------- |
| SC-001 | All `Must` functional requirements accepted                               | FSD traceability matrix signed off |
| SC-002 | Backend tests, web lint and build green on `main`                         | CI run history                     |
| SC-003 | No High or Medium findings from the ZAP API scan                          | ZAP workflow report                |
| SC-004 | Migrations apply cleanly to a fresh database with no model drift          | CI migration job                   |
| SC-005 | A dispatcher completes a triage decision in three interactions or fewer   | Usability observation              |
| SC-006 | Document set accepted by the panel                                        | Signed approval block              |
| SC-007 | A verified hazard reaches connected clients in 100 ms at p95, server-side | Integration latency test           |
| SC-008 | A driver completes a scripted offline route and queued report sync        | Playwright offline E2E             |
| SC-009 | Every privileged action is role-checked and audited                       | RBAC and audit test suite          |

## G. PROJECT AUTHORITY AND APPROVAL

The «Project Team Lead» may commit code, open change requests and manage the
repository. The «Project Sponsor» approves scope changes, budget and acceptance.
The «Project Adviser» may reject a deliverable that does not meet its stated
acceptance condition.

| Role                  | Name                    | Signature | Date  |
| --------------------- | ----------------------- | --------- | ----- |
| Project Sponsor       | «Project Sponsor»       |           | [TBC] |
| Project Adviser       | «Project Adviser»       |           | [TBC] |
| Client Representative | «Client Representative» |           | [TBC] |
| Project Team Lead     | «Project Team Lead»     |           | [TBC] |
