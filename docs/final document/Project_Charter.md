# PROJECT CHARTER

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

## Document Information

| Item                    | Details         |
| ----------------------- | --------------- |
| Project Name            | MetroFlow       |
| Project Classification  | Simple          |
| Document Classification | Internal Use    |
| Prepared By             | Alt F4          |
| Version No.             | 1.3             |
| Date Prepared           | 21 October 2026 |
| Context                 | Academic capstone — the LGU roles below are the intended evaluation scenario, not a funded, endorsed or accepted LGU project; no LGU budget is requested and all sign-offs are `[TBC]` (`docs/APPROVALS.md` §1) |
| Approval Register Note  | A-01 lists v1.1; this file is now v1.3 per the CR-002/CR-001 A1-A2 revision row below (`APPROVALS.md` A-20/A-21) |

## Revision History

| Version | Date Updated | Updated By        | Description              | Section Updated |
| ------- | ------------ | ----------------- | ------------------------ | --------------- |
| 1.0     | 21 Oct 2026  | Khent U. Lapating | Initial Baseline Release | All Sections    |
| 1.1     | 15 Nov 2026  | Khent U. Lapating | CR-001 — production network recalibration, driver navigation and admin incident location visualizer | A, C, D |
| 1.2     | 20–21 Nov 2026 | Khent U. Lapating | Approved by the Project Lead 20 Nov 2026 (CR-002) and 21 Nov 2026 (CR-001 Amendments A1/A2); formal QA/Adviser/Panel sign-offs recorded 23 Nov 2026 — part of the approved baseline: CR-002 admin screen split, CR-002 A1 and CR-001 Amendments A1/A2 are implemented, documented and approved (`APPROVALS.md` A-20/A-21); the original CR-001 approval is unchanged | A, D, E |
| 1.3     | 21 Nov 2026 | Khent U. Lapating | CR-001 Amendments A1/A2 — opt-in least-submerged fallback with submersion warning (`FSD-FR-146`/`147`, `BRULE-020`, `ADR-028`), driver current-conditions weather card, report-contract tightening and proximity tuning; approved by the Project Lead 21 Nov 2026, formal sign-offs recorded 23 Nov 2026 | A, D, E |

## A. PROJECT OVERVIEW

| Item               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose            | Give the LGU operations centre a verified picture of road passability during flooding, a traceable path from field report to dispatch decision, and a way to warn and reroute drivers before they enter the water.                                                                                                                                                                      |
| Business Goals     | Faster triage; no dispatch into impassable roads; no driver routed into a verified hazard; decisions that can be reviewed after the event; one shared operational picture between the LGU and the road.                                                                                                                                                                                                                                                 |
| Project Objectives | OBJ-001 model flood depth on the road graph; OBJ-002 compute clearance-aware routes; OBJ-003 provide a triage workspace; OBJ-004 record every decision; OBJ-005 deliver through an automated pipeline; OBJ-006 document the system to a reviewable standard; OBJ-007 publish verified hazards to drivers in real time; OBJ-008 provide offline navigation and reporting; OBJ-009 support live fleet dispatch; OBJ-010 ingest sensor data and flag impacted roads.                                                       |
| Project Scope      | Flood simulation, clearance-aware routing with coordinates and turn instructions, the LGU dispatch portal (live map, moderation queue, evidence desk, drawing tools, fleet and dispatch, incident location visualizer), the driver app (Mapbox street basemap, place search, drop-a-pin, navigation, rerouting, reports, offline, SOS), API-issued tokens and RBAC, SSE publishing, river and rain gauge ingestion, versioned PostGIS schema with row-level security, and automated build/test/security checks.                                                                                                |
| Assumptions        | A PostGIS-capable database is available (A-001); the corridor is representative (A-002); free or institutional tiers suffice (A-003); dispatchers have a modern browser (A-004); rainfall is supplied manually or from Open-Meteo (live rain gate); Open-Meteo and GloFAS are the live rain/river telemetry sources, with a rain-gated NOAH advisory fallback (A-005; `APPROVALS.md` §2.2); OpenWeather was considered but is not integrated; the client provides naming (A-006); drivers have a smartphone with camera and geolocation (A-007); connectivity can drop (A-008); sensor data may be simulated but labelled (A-009); Mapbox Directions API used for dry-state routing (ADR-025); portal basemap is keyless Carto Positron (ADR-022); there is no OSM raster fallback — an unset driver Mapbox token leaves a blank basemap while the cached graph still renders (A-010, ADR-026). |
| Constraints        | Delivery must fit the academic term (C-001); effort is part-time (C-002); no paid Code Security (C-003) — **resolved 10 Nov 2026**: the repository went public, so GitHub CodeQL (`security-extended`) now runs natively in CI with 0 High/Medium alerts (`TSD.md` SEC-004/LIM-010, `BRD.md` C-003); only synthetic or public data (C-004); no committed credentials and origin-restricted public keys (C-005); the driver client is a native Expo app and a public store release is a later gate (C-006); evidence is the reporter's own photo and no CCTV feed exists (C-007); basemap tiles are online-only (C-008); the pilot is single-LGU (C-009); UI follows the client-supplied HTML/CSS template (C-010).                                                                  |

All LGU references in this charter describe the intended evaluation scenario, not an official deployment, client or acceptance authority (`docs/APPROVALS.md` §1).

**Out of scope:** public App Store or Play Store releases, CCTV,
production SMS or telephony for SOS, offline basemap tiles, multi-LGU tenancy,
production single sign-on and a public information portal.

## B. PROJECT SCHEDULE

| Item                     | Value                                                       |
| ------------------------ | ----------------------------------------------------------- |
| Start Date               | August 18, 2026 (Requirements start)                       |
| Cutover Date             | [TBC] — a real institutional/LGU go-live decision, not an engineering date; this pilot ends at panel defence (below), not at LGU deployment |
| Period (Weeks)           | ≈14.5 weeks total (18 Aug – 27 Nov 2026) through deployment and panel defence — a planning projection, pending the panel's own scheduling confirmation |
| Assigned Project Manager | Khent U. Lapating                                         |
| Duration Estimate        | ≈14.5 weeks total, pending the panel's own scheduling confirmation of the 27 Nov 2026 defence date below |

### Waterfall Phases

| Phase | Start | End | Deliverable / Sign-off |
| --- | --- | --- | --- |
| 1. Requirements | August 18, 2026 | August 20, 2026 | Project Charter and BRD drafted (M1); formal sign-off tracked in `APPROVALS.md` A-01/A-02 |
| 2. Design | August 21, 2026 | August 26, 2026 | TSD accepted; PostGIS schema, routing/flood-state architecture and API contract frozen (M2) |
| 3. Implementation | August 27, 2026 | November 5, 2026 | API engine — simulate, network-state and route endpoints (M3); realtime, reports and fleet API (M7); LGU map, moderation and dispatch radar (M8); dispatch portal operational (M4) |
| 4. Verification | October 25, 2026 | November 4, 2026 | ZAP API scan and CodeQL (security-extended) clean at High/Medium; baseline documentation set accepted (M6); hardening complete (M5) |
| 5. Deployment and Pilot | November 5, 2026 | November 27, 2026 | Driver app, sensor impact demonstration and panel defence (M9) — **projected**, pending the panel's own scheduling confirmation, not an engineering date |

Phases 3 and 4 overlap by date (25 Oct – 5 Nov) rather than running strictly in
sequence: backend, portal and mobile work continued on separate tracks while
hardening and documentation review were already underway, so this table is a
retrospective Waterfall-style framing of real, partly concurrent delivery
(see `E. KEY DELIVERABLES AND MILESTONES` below for the exact milestone dates
this table is built from), not a claim that implementation fully stopped
before verification began.

### OPEX

| No. | Cost Description               | Amount (PHP) |
| --- | ------------------------------ | ------------ |
| 1   | Hosted database (Supabase)     | PHP18,450    |
| 2   | Application hosting            | PHP14,760    |
| 3   | Domain and TLS                 | PHP3,000     |
| 4   | Training and change management | PHP10,000    |
| 5   | Maintenance and support        | PHP0 (Year 1; 17.5% of CAPEX line 1 from Year 2 — see Business_Case.md §7.2 line 5) |
| 6   | EAS build and app distribution | PHP0 (free tier at pilot cadence) |
| 7   | Evidence photo storage         | PHP0 (included in line 1 — stored in the report row, not a separate service) |
| 8   | Redis / event infrastructure   | PHP0 (not provisioned in the hosted deployment; the event stream polls Postgres instead, local dev only) |
| 9   | Map, weather and imagery services | PHP0 (Mapbox Directions free tier at pilot volume; Open-Meteo/Copernicus free or offline; OpenWeather considered but not integrated) |
|     | **Total OPEX (Year 1)**        | **PHP46,210** |

Nine line items, matching Business_Case.md §7.2's own breakdown and sources;
lines 5, 8 and 9 are PHP0 in Year 1 specifically, not absent from the model.

### CAPEX

| No. | Cost Description                                 | Amount (PHP) |
| --- | -------------------------------------------------- | ------------ |
| 1   | Development effort (in-kind)            | PHP520,000   |
| 2   | Test devices and data                            | PHP15,000    |
| 3   | Contingency (10%)                                | PHP53,500    |
|     | **Total CAPEX**                                  | **PHP588,500** |

No funds are requested at charter stage: these are an **illustrative
projection**, not a quotation or an approved budget, built from each vendor's current rate card
(OPEX) and a market junior-developer rate applied to student time (CAPEX, in
kind, CA-001); approval of this charter does not approve expenditure. These cost tables are
academic planning material only; no LGU funding is requested (`docs/APPROVALS.md` §1). See
Business_Case.md §7 for the full cost model, sources and
assumptions.

## C. STAKEHOLDERS

| Division / Department    | Name                    | Role & Responsibilities                                                     | Contact Details            |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------- | -------------------------- |
| MDRRMC / «Client LGU»    | «Scenario Reviewer»     | Non-binding feedback on the intended evaluation scenario; no funding, authorisation or acceptance role | [TBC] |
| LGU Operations (CDMO)    | «Client Representative» | Scenario reviewer; advisory operational feedback, not an official client    | [TBC]                      |
| Operations Centre        | «Lead Dispatcher»       | Scenario user in usability sessions; no acceptance authority                | [TBC]                      |
| LGU IT                   | «IT Representative»     | Scenario contact only; no hosting, accounts or handover commitment          | [TBC]                      |
| «Institution»            | Sigfred Jayme           | Academic oversight; quality gate for deliverables                           | [TBC]                      |
| Applications Development | Khent U. Lapating       | Delivery accountability, architecture and change control                    | klapating.9033@umak.edu.ph |
| Applications Development | Josiah Ray S. De Vera   | Simulation, routing, API, database                                          | jdevera.8895@umak.edu.ph   |
| Applications Development | Marck Aaron V. Felipe   | Dispatch portal usability and behaviour                                     | mfelipe.9248@umak.edu.ph   |
| Applications Development | John Gabriel D. Vergara | Tests, CI gates, security scan and document set                             | jvergara.8861@umak.edu.ph  |
| Barangay responders      | «Field Unit Lead»       | Consume routes and dispatch instructions; validate field usability          | [TBC]                      |
| Rescue command           | «Rescue Commander»      | Approves dispatch and validates rescue routing                              | [TBC]                      |
| Drivers and commuters    | «Driver Representative» | Pilot the app; validate warnings, reporting and offline behaviour           | [TBC]                      |
| Sensor / data owner      | «Data Representative»   | Supplies gauge locations, thresholds and simulated readings                 | [TBC]                      |

Roles may be combined depending on team size. Every LGU-named role above is a
scenario reviewer for the academic evaluation; none is a sponsor, funder or
acceptance authority (`docs/APPROVALS.md` §1). The RACI detail is in
Project-Management-Plan.md.

## D. ISSUE / RISK

| No.   | Type       | Key Issue/Risk                                      | Category   | Mitigation Plan                                                                                |
| ----- | ---------- | --------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| R-001 | Risk       | Scope grows beyond the approved pilot boundary      | Schedule   | Hold the approved boundary; every further addition requires scope re-evaluation                   |
| R-002 | Risk       | Hydrological model judged unrealistic               | Technical  | Declare calibration constants; validate against documented events; present as decision support |
| R-003 | Risk       | Loss of a team member                               | Resource   | Pair on every critical path; record decisions in the TSD                                       |
| R-004 | Risk       | Hosted database never configured                    | Delivery   | Local stack is the primary demonstration; the CD workflow is gated and visible                 |
| R-005 | Risk       | Security findings surface late                      | Security   | Weekly ZAP gate from the first build                                                          |
| R-006 | Risk       | Drivers do not adopt the app                        | Adoption   | Usability tests; QR onboarding; synthetic reports as fallback                                  |
| R-007 | Risk       | Background-location limits on iOS                   | Technical  | Foreground fallback; permission and device tests; document the limit                           |
| R-008 | Risk       | Driver location privacy incident                    | Compliance | Rounding, hashing, 24-hour retention, role-only access, synthetic testing                      |
| R-009 | Risk       | Provider quota or outage degrades maps or rainfall  | Technical  | OSM fallback, manual rainfall, cached derived data, usage alerts                               |
| R-010 | Risk       | UI template arrives late or diverges from the FSD   | Schedule   | Treat the FSD behaviour as fixed and the template as visual; review on arrival                 |
| I-001 | Issue      | Authentication is not implemented                    | Business   | Closed: API-issued tokens with per-route role checks; application rate limits closed LIM-006  |
| I-002 | Issue      | Baseline incident data is mock data                 | Business   | Replaced with the persisted report API                                                         |
| I-003 | Issue      | CCTV is out of scope and gauges may be simulated    | Business   | No demo CCTV feed exists; CCTV remains only in the report-source code comments and is not accepted by the API. Evidence is the reporter's own photo; label simulated gauges in the API and UI |
| D-001 | Dependency | Client supplies the hosted database secret          | Delivery   | Track at every milestone review                                                                |
| D-002 | Dependency | Database secret and JWT signing key configured (`DATABASE_URL`, `JWT_SECRET`) — the API issues its own HS256 session tokens and never calls Supabase Auth (ADR-021) | Delivery   | Startup fails closed when either is absent                                         |
| D-003 | Dependency | Evidence photo storage                              | Delivery   | Stored as a `bytea` column on the `incident_reports` row, capped at 4 MB (ADR-023), not a mounted volume or object-storage service; the column type allows a later swap if volume grows |
| D-004 | Dependency | Weather, terrain and imagery providers within quota | Delivery   | Manual rainfall, OSM fallback and cached derived data keep the pilot running                   |

The full RAID log, scoring and owners are in
Project-Management-Plan.md.

## E. KEY DELIVERABLES AND MILESTONES

| ID   | Deliverable                    | Acceptance condition                                                                                |
| ---- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| D-01 | Simulation and routing API     | Contract tests pass; endpoints behave as specified in api.md                                      |
| D-02 | LGU dispatch portal            | Three-screen split usable end-to-end: `/triage` read-only operations dashboard, `/moderation` report verification, `/radar` SOS dispatch with unit assignment (CR-002, approved by the Project Lead 20 Nov 2026; sign-offs recorded 23 Nov 2026) |
| D-03 | Database schema and migrations | Clean `alembic upgrade head`; `alembic check` reports no drift                                      |
| D-04 | CI/CD pipeline                 | Tests, lint, build, security scan and hosted migrations run from the repo                           |
| D-05 | Document set                   | Charter, BRD, business case, FSD, TSD, PMP and API reference accepted                               |
| D-06 | Demonstration                  | Live walkthrough of simulation → routing → triage → dispatch                                        |
| D-07 | Driver app                     | EAS internal build from the supplied template; navigation, reports, offline queue, SOS and telemetry |
| D-08 | LGU live map and moderation    | Template-derived UI; MapLibre layers, evidence desk, approve/reject, draw and publish; report verification lives on `/moderation` only and `/radar` is SOS-only (CR-002, approved by the Project Lead 20 Nov 2026; sign-offs recorded 23 Nov 2026) |
| D-09 | Fleet and dispatch             | Unit status, nearest-unit ranking, flood-safe rescue route                                          |
| D-10 | Auth, RBAC and sensors         | API-issued roles, audit writes, gauge ingestion and advisory road impact                            |

| ID  | Milestone                           | Exit criterion                                                  | Target / Actual |
| --- | ----------------------------------- | ----------------------------------------------------------------- | ---------------- |
| M1  | Charter and requirements approved   | Charter and BRD signed off                                      | August 20, 2026 — drafts completed; formal sign-off still `[TBC]` (`APPROVALS.md` A-01/A-02) |
| M2  | Architecture and data design frozen | TSD accepted; schema drafted                                    | August 26, 2026 — Completed  |
| M3  | API engine operational              | Simulate, network state and route endpoints pass contract tests | October 1, 2026 — Completed |
| M5  | Hardening complete                  | ZAP clean at High/Medium; no open critical defects              | October 25, 2026 — Completed |
| M6  | Baseline documentation accepted     | Baseline document set accepted                                  | October 27, 2026 — baseline issued; formal acceptance still `[TBC]` |
| M7  | Realtime, reports and fleet API     | Auth, reports, hazards, SSE and fleet pass contract tests       | November 4, 2026 — Completed |
| M8  | LGU map, moderation and dispatch    | Map, evidence desk, draw/publish and dispatch demonstrated      | November 4, 2026 — Completed |
| M4  | Dispatch portal operational         | Triage flow demonstrated with queue, detail and actions         | November 5, 2026 — Completed |
| M9  | Driver app, sensors and defence     | Offline E2E, sensor impact and panel demonstration complete     | Panel defence **projected November 27, 2026** (18 Aug start + ≈14.5 weeks) — a planning projection, pending the panel's own scheduling confirmation, not an engineering date |

## F. SUCCESS CRITERIA

| ID     | Criterion                                                                 | Verification                       |
| ------ | ------------------------------------------------------------------------- | ---------------------------------- |
| SC-001 | All `Must` functional requirements accepted                               | FSD traceability matrix signed off |
| SC-002 | Backend tests, web lint and build green on `main`                         | CI run history                     |
| SC-003 | No High or Medium findings from the ZAP API scan                          | ZAP workflow report                |
| SC-004 | Migrations apply cleanly to a fresh database with no model drift          | CI migration job                   |
| SC-005 | A dispatcher completes a triage decision in three interactions or fewer   | Usability observation              |
| SC-006 | Document set accepted by the panel                                        | Signed approval block              |
| SC-007 | A verified hazard reaches connected clients in 100 ms at p95, server-side (architectural target; not currently met at real Quezon City scale — see `BRD.md` NFR-001/NFR-002/NFR-019 and `TSD.md` LIM-028) | Integration latency test           |
| SC-008 | A driver completes a scripted offline route and queued report sync        | Playwright offline E2E             |
| SC-009 | Every privileged action is role-checked and audited                       | RBAC and audit test suite          |

## G. PROJECT AUTHORITY AND APPROVAL

The Project Team Lead (Khent U. Lapating) may commit code and manage the
repository. The Project Adviser (Sigfred Jayme) and academic panel are the formal
approvers for scope and acceptance; LGU contacts are non-binding scenario reviewers,
and there is no sponsor budget or acceptance authority (`docs/APPROVALS.md` §1). All
sign-offs below are `[TBC]`. The Project Adviser may reject a deliverable that does not
meet its stated acceptance condition.

| Role                                | Name                    | Signature | Date  |
| ----------------------------------- | ----------------------- | --------- | ----- |
| Academic Adviser                    | Sigfred Jayme           |           | [TBC] |
| Academic Panel                      | «Panel»                 |           | [TBC] |
| Scenario LGU Reviewer (non-binding) | «Client Representative» |           | [TBC] |
| Project Team Lead                   | Khent U. Lapating       |           | [TBC] |
