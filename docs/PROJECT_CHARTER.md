# PROJECT CHARTER

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

## Document Information

| Item                    | Details         |
| ----------------------- | --------------- |
| Project Name            | MetroFlow       |
| Project Classification  | Simple          |
| Document Classification | Internal Use    |
| Prepared By             | «Project Team»  |
| Version No.             | 1.0             |
| Date Prepared           | 21 October 2026 |

## Revision History

| Version | Date Updated | Updated By          | Description     | Section Updated |
| ------- | ------------ | ------------------- | --------------- | --------------- |
| 1.0     | 21 Oct 2026  | «Project Team Lead» | Initial Release | All Sections    |

## A. PROJECT OVERVIEW

| Item               | Description                                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose            | Give the LGU operations centre a verified picture of road passability during flooding, and a traceable path from incident report to dispatch decision.                                                                                                                                          |
| Business Goals     | Faster triage; no dispatch into impassable roads; decisions that can be reviewed after the event; one shared operational picture.                                                                                                                                                               |
| Project Objectives | OBJ-001 model flood depth on the road graph; OBJ-002 compute clearance-aware routes; OBJ-003 provide a triage workspace; OBJ-004 record every decision; OBJ-005 deliver through an automated pipeline; OBJ-006 document the system to a reviewable standard.                                    |
| Project Scope      | Flood simulation, clearance-aware routing, the LGU dispatch portal (login, queue, incident detail, operations log, dispatch actions), versioned PostGIS schema with row-level security, and automated build/test/security checks.                                                               |
| Assumptions        | A PostGIS-capable database is available (A-001); the pilot corridor is representative (A-002); free or institutional service tiers suffice (A-003); dispatchers have a modern browser (A-004); rainfall intensity is supplied manually (A-005); the client provides naming conventions (A-006). |
| Constraints        | Delivery must fit the academic term (C-001); effort is part-time (C-002); no paid Code Security, so CodeQL cannot run on the private repository (C-003); only synthetic or public data may be used (C-004); credentials are never committed (C-005).                                            |

**Out of scope:** native driver application, live sensor/CCTV/weather ingestion,
production identity provider, real citizen report intake, multi-LGU tenancy and a
public information portal. Moving an item across this boundary requires a change
request under [PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md).

## B. PROJECT SCHEDULE

| Item                     | Value               |
| ------------------------ | ------------------- |
| Start Date               | [TBC]               |
| Cutover Date             | [TBC]               |
| Period (Weeks)           | 16 weeks [TBC]      |
| Assigned Project Manager | «Project Team Lead» |
| Duration Estimate        | 4 months [TBC]      |

### OPEX

| No. | Cost Description               | Amount (PHP) |
| --- | ------------------------------ | ------------ |
| 1   | Hosted database (Supabase)     | [TBC]        |
| 2   | Application hosting            | [TBC]        |
| 3   | Domain and TLS                 | [TBC]        |
| 4   | Training and change management | [TBC]        |
|     | **Total OPEX**                 | **[TBC]**    |

### CAPEX

| No. | Cost Description             | Amount (PHP) |
| --- | ---------------------------- | ------------ |
| 1   | Development effort (in-kind) | [TBC]        |
| 2   | Test devices and data        | [TBC]        |
| 3   | Contingency (10%)            | [TBC]        |
|     | **Total CAPEX**              | **[TBC]**    |

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

Roles may be combined depending on team size. The RACI detail is in
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md).

## D. ISSUE / RISK

| No.   | Type       | Key Issue/Risk                                | Category  | Mitigation Plan                                                                                |
| ----- | ---------- | --------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| R-001 | Risk       | Scope creep into native apps and live sensors | Schedule  | Hold the charter boundary; every addition requires a change request                            |
| R-002 | Risk       | Hydrological model judged unrealistic         | Technical | Declare calibration constants; validate against documented events; present as decision support |
| R-003 | Risk       | Loss of a team member                         | Resource  | Pair on every critical path; record decisions in the TSD                                       |
| R-004 | Risk       | Hosted database never configured              | Delivery  | Local stack is the primary demonstration; the CD workflow is gated and visible                 |
| R-005 | Risk       | Security findings surface late                | Security  | Weekly ZAP gate from the first increment                                                       |
| I-001 | Issue      | Authentication is not implemented             | Business  | State the limitation; schedule BR-009 as the first post-pilot increment                        |
| I-002 | Issue      | Incident data in the portal is mock data      | Business  | Document the seam; build intake in the next release                                            |
| D-001 | Dependency | Client supplies the hosted database secret    | Delivery  | Track at every milestone review                                                                |

The full RAID log, scoring and owners are in
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md).

## E. KEY DELIVERABLES AND MILESTONES

| ID   | Deliverable                    | Acceptance condition                                                      |
| ---- | ------------------------------ | ------------------------------------------------------------------------- |
| D-01 | Simulation and routing API     | Contract tests pass; endpoints behave as specified in [api.md](api.md)    |
| D-02 | LGU dispatch portal            | Both screens usable end-to-end for triage                                 |
| D-03 | Database schema and migrations | Clean `alembic upgrade head`; `alembic check` reports no drift            |
| D-04 | CI/CD pipeline                 | Tests, lint, build, security scan and hosted migrations run from the repo |
| D-05 | Document set                   | Charter, BRD, business case, FSD, TSD, PMP and API reference accepted     |
| D-06 | Demonstration                  | Live walkthrough of simulation → routing → triage → dispatch              |

| ID  | Milestone                           | Exit criterion                                                  | Target          |
| --- | ----------------------------------- | --------------------------------------------------------------- | --------------- |
| M1  | Charter and requirements approved   | Charter and BRD signed off                                      | Week 2 · [TBC]  |
| M2  | Architecture and data design frozen | TSD accepted; schema drafted                                    | Week 5 · [TBC]  |
| M3  | API engine operational              | Simulate, network state and route endpoints pass contract tests | Week 9 · [TBC]  |
| M4  | Dispatch portal operational         | Triage flow demonstrated with queue, detail and actions         | Week 12 · [TBC] |
| M5  | Hardening complete                  | ZAP clean at High/Medium; no open critical defects              | Week 14 · [TBC] |
| M6  | Documentation and defence           | Document set accepted; system demonstrated to panel             | Week 16 · [TBC] |

## F. SUCCESS CRITERIA

| ID     | Criterion                                                               | Verification                       |
| ------ | ----------------------------------------------------------------------- | ---------------------------------- |
| SC-001 | All `Must` functional requirements accepted                             | FSD traceability matrix signed off |
| SC-002 | Backend tests, web lint and build green on `main`                       | CI run history                     |
| SC-003 | No High or Medium findings from the ZAP API scan                        | ZAP workflow report                |
| SC-004 | Migrations apply cleanly to a fresh database with no model drift        | CI migration job                   |
| SC-005 | A dispatcher completes a triage decision in three interactions or fewer | Usability observation              |
| SC-006 | Document set accepted by the panel                                      | Signed approval block              |

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
