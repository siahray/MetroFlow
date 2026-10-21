# Project Charter — MetroFlow

**Intelligent Urban Mobility and Flood Simulation System**

| Field          | Value               |
| -------------- | ------------------- |
| Document ID    | MF-PC-001           |
| Version        | 1.0 (Draft)         |
| Status         | For academic review |
| Date           | 21 October 2026     |
| Prepared by    | «Project Team»      |
| Reviewed by    | «Project Adviser»   |
| Approved by    | «Project Sponsor»   |
| Classification | Internal — academic |

## Revision history

| Version | Date        | Author         | Change          |
| ------- | ----------- | -------------- | --------------- |
| 1.0     | 21 Oct 2026 | «Project Team» | Initial charter |

## 1. Executive summary

Metro Manila's road network floods faster than responders can assess it. During
a rain event, the people who decide where to send rescue units work from radio
reports, phone calls and social media, with no shared view of which roads are
still passable. The result is delayed dispatch and responders routed into water
they cannot cross.

MetroFlow addresses this with two linked capabilities: a simulation engine that
computes street-level flood depth across a road graph, and a routing engine that
returns the fastest path a vehicle of a given clearance can actually drive. An
LGU dispatch portal presents the resulting network state and a triage queue so
dispatchers can verify reports and commit resources from one screen.

This charter authorises a **pilot-scope build** covering the Taguig–Pasig
corridor, the API engine, and the LGU dispatch portal. It does **not** authorise
native mobile clients, live sensor integration, or multi-LGU deployment. Those
are recorded as future releases so that acceptance is judged against a fixed,
achievable boundary.

## 2. Project purpose and business need

| Item                    | Statement                                                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business problem        | Dispatchers lack a shared, current picture of road passability during flooding, so triage and dispatch decisions rely on unverified reports.                                                                   |
| Business need           | A single system that (a) models flood depth on the road network, (b) computes routes that respect vehicle clearance, and (c) gives dispatchers a structured queue with evidence and an auditable action trail. |
| Driver                  | Seasonal flooding in Metro Manila repeatedly makes primary corridors impassable; response time is the difference between a rescue and a recovery.                                                              |
| Consequence of inaction | Continued dependence on verbal reports, duplicated dispatch, and responders committing to routes that are already submerged.                                                                                   |

The full business analysis is in [BRD.md](BRD.md); the options comparison and
recommendation are in [BUSINESS_CASE.md](BUSINESS_CASE.md).

## 3. Project objectives

### 3.1 General objective

To design, build and evaluate a flood-aware mobility and dispatch system that
gives an LGU operations unit a verifiable picture of road passability and a
traceable path from incident report to dispatch decision.

### 3.2 Specific objectives

| ID     | Objective                                          | Measure of achievement                                                                                                               |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| OBJ-01 | Model road-network flood state from rainfall input | A rainfall simulation produces per-edge water depth and a passability label for every edge in the pilot graph                        |
| OBJ-02 | Compute clearance-aware routes                     | A route request returns a path whose every segment is below the requested vehicle clearance, or an explicit "no safe route" response |
| OBJ-03 | Provide a triage workspace for dispatchers         | A dispatcher can filter, search, inspect evidence and record a decision for a queue item without leaving the screen                  |
| OBJ-04 | Make every decision traceable                      | Each dispatch, escalation, hold or rejection is appended to an operations log with actor and timestamp                               |
| OBJ-05 | Operate the system through a reproducible pipeline | Every change is linted, tested and migrated by CI before reaching the hosted database                                                |
| OBJ-06 | Document the system to a reviewable standard       | The six project documents plus the API reference are accepted by the panel                                                           |

Objectives map to business requirements in [BRD.md](BRD.md) §6 and to functional
requirements in [FSD.md](FSD.md) §5.

## 4. High-level scope

### 4.1 In scope

| Area              | Included                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation engine | SCS-CN runoff model, elevation-weighted ponding depth, per-edge live state updates                                                             |
| Routing engine    | Time-dependent A\* with flood penalty, clearance-based blocking, GeoJSON route geometry                                                        |
| Network API       | Node/edge GeoJSON state, rainfall simulation, route computation, health endpoint                                                               |
| Dispatch portal   | Login screen, KPI summary, incident queue with filters and search, incident docket with evidence panels, operations log, four dispatch actions |
| Data              | PostGIS schema versioned with Alembic; row-level security on the hosted database                                                               |
| Delivery          | Docker Compose stack, GitHub Actions CI/CD, hosted Postgres migrations, container image publishing                                             |
| Assurance         | Unit and API contract tests, lint and build gates, OWASP ZAP API scan                                                                          |

### 4.2 Out of scope

| Excluded                                        | Rationale / disposition                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Native driver application                       | Named as a future release; the API already serves it, the client does not exist        |
| Live sensor, CCTV and weather ingestion         | Requires data-sharing agreements with the LGU and third-party feeds                    |
| Production authentication and identity provider | Requires an organisational identity decision; the user model exists, the flow does not |
| Real incident intake from citizens              | The portal currently runs on documented mock data                                      |
| Multi-LGU tenancy and billing                   | Single-pilot deployment only                                                           |
| Public-facing citizen application               | Not required for dispatch operations                                                   |
| Offline operation                               | Assumes connectivity at the operations centre                                          |

Any movement across this boundary requires a change request under
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) §4.

## 5. Key deliverables

| ID   | Deliverable                    | Acceptance condition                                                                           |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| D-01 | Simulation and routing API     | Contract tests pass; documented endpoints behave as specified in [api.md](api.md)              |
| D-02 | LGU dispatch portal            | Both screens usable end-to-end for triage with queue, detail and actions                       |
| D-03 | Database schema and migrations | `alembic upgrade head` succeeds on a clean database; `alembic check` reports no drift          |
| D-04 | CI/CD pipeline                 | Backend tests, web lint and build, security scan and hosted migrations run from the repository |
| D-05 | Document set                   | Charter, BRD, business case, FSD, TSD, PMP and API reference accepted                          |
| D-06 | Demonstration                  | Live walkthrough of simulation → routing → triage → dispatch                                   |

## 6. Milestones

Dates are `[TBC]` pending the academic calendar. Durations are indicative.

| ID  | Milestone                           | Exit criterion                                                  | Target          |
| --- | ----------------------------------- | --------------------------------------------------------------- | --------------- |
| M1  | Charter and requirements approved   | Charter and BRD signed off                                      | Week 2 · [TBC]  |
| M2  | Architecture and data design frozen | TSD accepted; schema drafted                                    | Week 5 · [TBC]  |
| M3  | API engine operational              | Simulate, network state and route endpoints pass contract tests | Week 9 · [TBC]  |
| M4  | Dispatch portal operational         | Triage flow demonstrated with queue, detail and actions         | Week 12 · [TBC] |
| M5  | Hardening complete                  | ZAP scan clean at High/Medium; no open critical defects         | Week 14 · [TBC] |
| M6  | Documentation and defence           | Document set accepted; system demonstrated to panel             | Week 16 · [TBC] |

## 7. Budget and funding

No funds are requested at charter stage. The table records the cost categories
that the business case prices; every figure is `[TBC]` until quotations and the
institution's rules are confirmed.

| Category                   | Type                   | Amount    | Source             |
| -------------------------- | ---------------------- | --------- | ------------------ |
| Development effort         | In-kind (student team) | [TBC]     | «Project Team»     |
| Hosted database (Supabase) | Operating              | [TBC]     | Supabase pricing   |
| Web hosting                | Operating              | [TBC]     | «Hosting provider» |
| Domain and TLS             | Operating              | [TBC]     | «Registrar»        |
| Test devices and data      | Capital                | [TBC]     | «Institution»      |
| Contingency (10%)          | Reserve                | [TBC]     | Derived            |
| **Total**                  |                        | **[TBC]** |                    |

Approval of this charter does not approve expenditure. Spend requires the
sponsor's written approval per the institution's procurement rules.

## 8. Stakeholders and roles

| Stakeholder                 | Role in project                                         | Interest                                  |
| --------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| «Project Sponsor»           | Funds and authorises; accepts deliverables              | Operational improvement, defensible spend |
| «Client Representative»     | LGU operations and IT liaison; provides data and access | Fit with existing dispatch practice       |
| «Project Adviser»           | Academic oversight and quality gate                     | Methodological rigour, scope control      |
| «Panel»                     | Evaluates the final deliverable                         | Completeness against the rubric           |
| «Project Team Lead»         | Delivery accountability, architecture                   | Coherent, demonstrable system             |
| «Backend Lead»              | Simulation, routing, API, database                      | Correct, tested algorithms                |
| «Frontend Lead»             | Dispatch portal                                         | Usable triage workspace                   |
| «QA and Documentation Lead» | Test strategy, CI gates, document set                   | Traceability and evidence                 |
| Dispatchers (end users)     | Use the portal in operations                            | Speed, clarity, low error rate            |
| Drivers (future users)      | Consume routing output                                  | Routes that are actually passable         |

Roles may be combined depending on team size; the RACI detail is in
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) §8.

## 9. Assumptions, constraints and dependencies

### 9.1 Assumptions

| ID   | Assumption                                                                                            | Impact if false                                               |
| ---- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| A-01 | A PostGIS-capable PostgreSQL instance is available for development and hosting                        | Geometry features and migrations cannot be demonstrated       |
| A-02 | The pilot corridor's road graph is representative enough to demonstrate routing behaviour             | Results may not generalise; evaluation limited to methodology |
| A-03 | Free or institutional tiers of GitHub, Supabase and the hosting provider are sufficient for the pilot | Additional cost and a budget revision                         |
| A-04 | Dispatchers have a modern desktop browser and reliable connectivity                                   | Portal unusable during an event                               |
| A-05 | Rainfall intensity can be supplied manually or from public weather data for the pilot                 | Simulation driven by scenarios only                           |

### 9.2 Constraints

| ID   | Constraint                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| C-01 | Delivery must fit the academic term; schedule is fixed at both ends                                          |
| C-02 | Team effort is part-time and shared with coursework                                                          |
| C-03 | No paid GitHub Code Security, so CodeQL cannot analyse the private repository until it is public or licensed |
| C-04 | No production sensor feed or citizen data may be used; only synthetic or public data                         |
| C-05 | Hosted database credentials are secrets and never committed                                                  |

### 9.3 Dependencies

| ID     | Dependency                                                          | Owner                   |
| ------ | ------------------------------------------------------------------- | ----------------------- |
| DEP-01 | Hosted PostgreSQL connection string supplied as a repository secret | «Client Representative» |
| DEP-02 | Review and sign-off availability of adviser and panel               | «Project Adviser»       |
| DEP-03 | LGU confirmation of pilot corridor and barangay naming              | «Client Representative» |

## 10. High-level risks

Full register, scoring and responses are in
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) §10.

| ID   | Risk                                                          | Impact                      | Initial response                                                                             |
| ---- | ------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| R-01 | Scope creep into native apps and live sensors                 | Schedule overrun            | Charter boundary plus change control                                                         |
| R-02 | Hydrological model judged unrealistic                         | Credibility of results      | Declare calibration constants; validate against documented events; present as a decision aid |
| R-03 | Loss of a team member                                         | Delivery slip               | Pair on every component; documented decisions                                                |
| R-04 | Hosted database never configured                              | Deployment not demonstrated | Local stack is the primary demo; hosted path proven by CI skip/gate logic                    |
| R-05 | Security findings late in the term                            | Rework close to defence     | Weekly ZAP gate from the start                                                               |
| R-06 | Institutional format requirements differ from these documents | Rework                      | Confirm rubric with adviser at M1                                                            |

## 11. Success criteria

| ID    | Criterion                                                               | Verification                                     |
| ----- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| SC-01 | All `Must` functional requirements accepted                             | FSD traceability matrix signed off               |
| SC-02 | Backend contract tests, web lint and build green on `main`              | CI run history                                   |
| SC-03 | No High or Medium findings from the ZAP API scan                        | ZAP workflow report                              |
| SC-04 | Migrations apply cleanly to a fresh database with no model drift        | `alembic upgrade head` and `alembic check` in CI |
| SC-05 | A dispatcher completes a triage decision in three interactions or fewer | Usability observation                            |
| SC-06 | Document set accepted by the panel                                      | Signed approval block                            |

## 12. Project authority

The «Project Team Lead» may commit code, open change requests and manage the
repository. The «Project Sponsor» approves scope changes, budget and acceptance.
The «Project Adviser» may reject a deliverable that does not meet the stated
acceptance condition.

## 13. Approval

| Role                  | Name                    | Signature | Date  |
| --------------------- | ----------------------- | --------- | ----- |
| Project Sponsor       | «Project Sponsor»       |           | [TBC] |
| Project Adviser       | «Project Adviser»       |           | [TBC] |
| Client Representative | «Client Representative» |           | [TBC] |
| Project Team Lead     | «Project Team Lead»     |           | [TBC] |
