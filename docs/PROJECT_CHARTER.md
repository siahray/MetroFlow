# PROJECT CHARTER

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

## Document Information

| Item                    | Details         |
| ----------------------- | --------------- |
| Project Name            | MetroFlow       |
| Project Classification  | Simple          |
| Document Classification | Internal Use    |
| Prepared By             | «Project Team»  |
| Version No.             | 1.3             |
| Date Prepared           | 21 October 2026 |

## Revision History

| Version | Date Updated | Updated By          | Description                                               | Section Updated  |
| ------- | ------------ | ------------------- | --------------------------------------------------------- | ---------------- |
| 1.0     | 21 Oct 2026  | «Project Team Lead» | Initial Release                                           | All Sections     |
| 1.1     | 21 Oct 2026  | «Project Team Lead» | Driver app, live hazards, fleet dispatch, sensors added to scope | A, B, C, D, E, F |
| 1.2     | 22 Oct 2026  | «Project Team Lead» | Provider keys, Supabase Auth, Mapbox tiles, template UI   | A, B, C, D       |
| 1.3     | 13 Nov 2026  | «Project Team Lead» | Offline map areas and satellite observations recorded as final-product scope, not implemented for the pilot; live flood-state sources partially implemented; EV/HOV/toll "Smart Routing" declined; Mapbox dry-state routing implemented; pilot road network re-scoped to Quezon City, surfacing that NFR-001/002/019 are not currently met at this scale. The approved pilot boundary (R-001, below) is unchanged — routing, flood-state and network scope are extended or re-scoped within it, the rest stay out | A, E             |
| 1.4     | 13 Nov 2026  | «Project Team Lead» | §B Project Schedule's open `[TBC]` fields (Cutover Date aside — a real LGU go-live decision, left open) filled with a planning projection from the 18 Aug 2026 start date: ≈15.5 weeks total, panel defence projected 4 December 2026. This is a planning estimate, not a confirmed institutional or panel date | B                |
| 1.5     | 13 Nov 2026  | «Project Team Lead» | §B OPEX table expanded from 6 to 9 line items to match `BUSINESS_CASE.md` §7.2's own breakdown; §D D-002/D-003 corrected — the API issues its own HS256 tokens and never calls Supabase Auth (`ADR-021`), and evidence photos are a `bytea` database column (`ADR-023`), not a mounted volume | B, D             |

## A. PROJECT OVERVIEW

| Item               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose            | Give the LGU operations centre a verified picture of road passability during flooding, a traceable path from field report to dispatch decision, and a way to warn and reroute drivers before they enter the water.                                                                                                                                                                                                                                                                                                      |
| Business Goals     | Faster triage; no dispatch into impassable roads; no driver routed into a verified hazard; decisions that can be reviewed after the event; one shared operational picture between the LGU and the road.                                                                                                                                                                                                                                                                                                                 |
| Project Objectives | OBJ-001 model flood depth on the road graph; OBJ-002 compute clearance-aware routes; OBJ-003 provide a triage workspace; OBJ-004 record every decision; OBJ-005 deliver through an automated pipeline; OBJ-006 document the system to a reviewable standard; OBJ-007 publish verified hazards to drivers in real time; OBJ-008 provide offline navigation and reporting; OBJ-009 support live fleet dispatch; OBJ-010 ingest sensor data and flag impacted roads.                                                       |
| Project Scope      | Flood simulation, clearance-aware routing with coordinates and turn instructions, the LGU dispatch portal (live map, moderation queue, evidence desk, drawing tools, fleet and dispatch), the driver app (navigation, rerouting, reports, offline, SOS), API-issued tokens and RBAC, SSE publishing, river and rain gauge ingestion, versioned PostGIS schema with row-level security, and automated build/test/security checks.                                                                                                |
| Assumptions        | A PostGIS-capable database is available (A-001); the corridor is representative (A-002); free or institutional tiers suffice (A-003); dispatchers have a modern browser (A-004); rainfall is supplied manually with optional OpenWeather data (A-005); the client provides naming (A-006); drivers have a smartphone with camera and geolocation (A-007); connectivity can drop (A-008); sensor data may be simulated but labelled (A-009); Mapbox tiles are available on the pilot tier, with OSM as fallback (A-010). |
| Constraints        | Delivery must fit the academic term (C-001); effort is part-time (C-002); no paid Code Security (C-003); only synthetic or public data (C-004); no committed credentials and origin-restricted public keys (C-005); the driver client is a native Expo app and a public store release is a later gate (C-006); evidence is the reporter's own photo and no CCTV feed exists (C-007); basemap tiles are online-only (C-008); the pilot is single-LGU (C-009); UI follows the client-supplied HTML/CSS template (C-010).                                                                  |

**Out of scope:** public App Store or Play Store releases, CCTV,
production SMS or telephony for SOS, offline basemap tiles, multi-LGU tenancy,
production single sign-on and a public information portal. Moving an item across
this boundary requires a change request under
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md). The driver app, live hazards,
fleet dispatch and sensor ingestion are part of the approved pilot scope.

## B. PROJECT SCHEDULE

| Item                     | Value                                                       |
| ------------------------ | ----------------------------------------------------------- |
| Start Date               | August 18, 2026 (Requirements start, `git log`/PMP Project Schedule) |
| Cutover Date             | `[TBC]` — a real institutional/LGU go-live decision, not an engineering date; this pilot ends at panel defence (below), not at LGU deployment |
| Period (Weeks)           | ≈13 weeks engineering (18 Aug – 13 Nov 2026); **projected ≈15.5 weeks total** (18 Aug – 4 Dec 2026) through the panel defence below — a planning projection, not a confirmed institutional date |
| Assigned Project Manager | «Project Team Lead»                                         |
| Duration Estimate        | ≈13 weeks elapsed; **≈15.5 weeks projected total**, pending the panel's own scheduling confirmation of the 4 Dec 2026 defence date below |

### OPEX

| No. | Cost Description               | Amount (PHP) |
| --- | ------------------------------ | ------------ |
| 1   | Hosted database (Supabase)     | PHP18,450    |
| 2   | Application hosting            | PHP14,760    |
| 3   | Domain and TLS                 | PHP3,000     |
| 4   | Training and change management | PHP10,000    |
| 5   | Maintenance and support        | PHP0 (Year 1; 17.5% of CAPEX lines 1-2 from Year 2 — see `BUSINESS_CASE.md` §7.2 line 5) |
| 6   | EAS build and app distribution | PHP0 (free tier at pilot cadence) |
| 7   | Evidence photo storage         | PHP0 (included in line 1 — stored in the report row, not a separate service) |
| 8   | Redis / event infrastructure   | PHP0 (not provisioned in the hosted deployment; the event stream polls Postgres instead, local dev only) |
| 9   | Map, weather and imagery services | PHP0 (Mapbox Directions free tier at pilot volume; OpenWeather/OpenTopography/Copernicus free or offline) |
|     | **Total OPEX (Year 1)**        | **PHP46,210** |

Nine line items, matching `BUSINESS_CASE.md` §7.2's own breakdown and sources;
lines 5, 8 and 9 are PHP0 in Year 1 specifically, not absent from the model.

### CAPEX

| No. | Cost Description                                 | Amount (PHP) |
| --- | -------------------------------------------------- | ------------ |
| 1   | Baseline development effort (in-kind)            | PHP360,000   |
| 2   | Native app, realtime, fleet increment (in-kind) | PHP160,000   |
| 3   | Test devices and data                            | PHP15,000    |
| 4   | Contingency (10%)                                | PHP53,500    |
|     | **Total CAPEX**                                  | **PHP588,500** |

No funds are requested at charter stage: these are an **illustrative
projection**, not a quotation, built from each vendor's current rate card
(OPEX) and a market junior-developer rate applied to student time (CAPEX, in
kind, `CA-001`); approval of this charter does not approve expenditure. See
[BUSINESS_CASE.md](BUSINESS_CASE.md) §7 for the full cost model, sources and
assumptions.

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
| R-001 | Risk       | Scope grows beyond the approved pilot boundary      | Schedule   | Hold the approved boundary; every further addition requires a change request                   |
| R-002 | Risk       | Hydrological model judged unrealistic               | Technical  | Declare calibration constants; validate against documented events; present as decision support |
| R-003 | Risk       | Loss of a team member                               | Resource   | Pair on every critical path; record decisions in the TSD                                       |
| R-004 | Risk       | Hosted database never configured                    | Delivery   | Local stack is the primary demonstration; the CD workflow is gated and visible                 |
| R-005 | Risk       | Security findings surface late                      | Security   | Weekly ZAP gate from the first increment                                                       |
| R-006 | Risk       | Drivers do not adopt the app                        | Adoption   | Usability tests; QR onboarding; synthetic reports as fallback                                  |
| R-007 | Risk       | Background-location limits on iOS                   | Technical  | Foreground fallback; permission and device tests; document the limit                           |
| R-008 | Risk       | Driver location privacy incident                    | Compliance | Rounding, hashing, 24-hour retention, role-only access, synthetic testing                      |
| R-009 | Risk       | Provider quota or outage degrades maps or rainfall  | Technical  | OSM fallback, manual rainfall, cached derived data, usage alerts                               |
| R-010 | Risk       | UI template arrives late or diverges from the FSD   | Schedule   | Treat the FSD behaviour as fixed and the template as visual; review on arrival                 |
| I-001 | Issue      | Authentication is not implemented in baseline       | Business   | Closed 27 Oct 2026: API-issued tokens with per-route role checks; application rate limits closed LIM-006 on 28 Oct, an edge WAF remains open (LIM-025)  |
| I-002 | Issue      | Baseline incident data is mock data                 | Business   | Replaced with the persisted report API                                                         |
| I-003 | Issue      | CCTV is out of scope and gauges may be simulated    | Business   | Evidence is the reporter's own photo; label simulated gauges in the API and UI                   |
| D-001 | Dependency | Client supplies the hosted database secret          | Delivery   | Track at every milestone review                                                                |
| D-002 | Dependency | Database secret and JWT signing key configured (`DATABASE_URL`, `JWT_SECRET`) — the API issues its own HS256 session tokens and never calls Supabase Auth (`ADR-021`) | Delivery   | Startup fails closed when either is absent                                         |
| D-003 | Dependency | Evidence photo storage                              | Delivery   | Stored as a `bytea` column on the `incident_reports` row, capped at 4 MB (`ADR-023`), not a mounted volume or object-storage service; the column type allows a later swap if volume grows |
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

| ID  | Milestone                           | Exit criterion                                                  | Target / Actual |
| --- | ----------------------------------- | ----------------------------------------------------------------- | ---------------- |
| M1  | Charter and requirements approved   | Charter and BRD signed off                                      | August 20, 2026 — Completed  |
| M2  | Architecture and data design frozen | TSD accepted; schema drafted                                    | August 26, 2026 — Completed  |
| M3  | API engine operational              | Simulate, network state and route endpoints pass contract tests | October 1, 2026 — Completed  |
| M4  | Dispatch portal operational         | Triage flow demonstrated with queue, detail and actions         | October 22, 2026 — Completed |
| M5  | Hardening complete                  | ZAP clean at High/Medium; no open critical defects              | October 25, 2026 — Completed |
| M6  | Baseline documentation accepted     | Baseline document set accepted                                  | October 27, 2026 — Completed |
| M7  | Realtime, reports and fleet API     | Auth, reports, hazards, SSE and fleet pass contract tests       | November 4, 2026 — Completed |
| M8  | LGU map, moderation and dispatch    | Map, evidence desk, draw/publish and dispatch demonstrated      | November 4, 2026 — Completed |
| M9  | Driver app, sensors and defence     | Offline E2E, sensor impact and panel demonstration complete     | November 3, 2026 for the engineering (driver app, sensors); panel defence **projected December 4, 2026** (18 Aug start + ≈15.5 weeks) — a planning projection, pending the panel's own scheduling confirmation, not an engineering date |

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
