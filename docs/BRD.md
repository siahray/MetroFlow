# BUSINESS REQUIREMENTS DOCUMENT (BRD)

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

## Document Control - Revision History

| Version | Date        | Author         | Description     |
| ------- | ----------- | -------------- | --------------- |
| 1.0     | 21 Oct 2026 | «Project Team» | Initial Version |

## Approvals

| Name                    | Designation      |
| ----------------------- | ---------------- |
| «Project Sponsor»       | Project Sponsor  |
| «Client Representative» | Business Owner   |
| «Project Adviser»       | Academic Adviser |

## Executive Summary

Metro Manila's road network floods faster than responders can assess it.
Dispatchers work from radio reports, phone calls and social media with no shared
view of which roads are still passable, so rescue units are delayed and sometimes
routed into water they cannot cross.

MetroFlow addresses this with a flood simulation engine, a clearance-aware
routing engine and an LGU dispatch portal. The engine computes street-level
flood depth across a road graph; the router returns the fastest path a vehicle
of a given clearance can actually drive; the portal presents the network state
and a triage queue with evidence and an auditable action trail.

This document states the business problem, requirements and success measures for
the pilot. Technical behaviour is specified in [FSD.md](FSD.md) and construction
in [TSD.md](TSD.md).

## Business Problem Statement

During a rain event, the LGU operations centre cannot verify three things that
determine its decisions:

1. **Which roads are passable now.** Flood depth is estimated by eye or from a
   caller's description, not measured against the vehicle that must cross.
2. **Which reports are real and urgent.** Reports arrive unstructured and
   duplicated, so dispatcher time goes to deduplication instead of triage.
3. **What was decided and why.** Decisions are recorded informally, if at all,
   so an event cannot be reviewed or defended afterwards.

The consequence is operational: aborted dispatches, duplicated effort, slower
response, and no institutional learning between events. The cost of the status
quo is measured in response time, not in licence fees — which is why the
business case compares options on operational fit, not purchase price alone.

## Project Objectives

| ID     | Objective                                               | Success Measure                                                                                        |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| BO-001 | Reduce time from report received to triage decision     | Median minutes fall below the M1 baseline `[TBC]`                                                      |
| BO-002 | Prevent dispatch into impassable roads                  | Zero dispatch attempts aborted for road conditions per event                                           |
| BO-003 | Reduce duplicated reports entering the queue            | Duplicate screening rate improves against the M1 baseline `[TBC]`                                      |
| BO-004 | Make every decision auditable                           | 100% of decisions carry actor, timestamp and action                                                    |
| BO-005 | Keep the system available during a declared event       | Availability at or above `[TBC]` during rain events                                                    |
| BO-006 | Give responders a route that respects vehicle clearance | 100% of route responses contain no segment at or above the requested clearance, or an explicit refusal |

Targets are agreed with the client at M1. BO-002 is expressed as zero tolerance
because a single dispatch into deep water can be fatal.

## Stakeholders

| Stakeholder             | Department                          | Role                                              |
| ----------------------- | ----------------------------------- | ------------------------------------------------- |
| «Project Sponsor»       | MDRRMC / «Client LGU»               | Funds, authorises and accepts the pilot           |
| «Client Representative» | LGU operations and IT (CDMO)        | Business owner; provides corridor data and access |
| Dispatchers             | Operations centre                   | Primary users of the triage queue                 |
| Barangay responders     | Field units                         | Consume routes and dispatch instructions          |
| «Project Adviser»       | «Institution»                       | Academic oversight and quality gate               |
| «Project Team»          | Applications development            | Design, build, test and document                  |
| Citizens                | Barangays within the pilot corridor | Report incidents; affected by response time       |

Personas and engagement detail are in [PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md).

## Functional Requirements

These are the business-level capabilities. The FSD decomposes them into
`FSD-FR-001` to `FSD-FR-053`; each row here names the business requirement it
serves so the traceability chain is never broken.

| Req ID | Requirement                                                                            | Priority |
| ------ | -------------------------------------------------------------------------------------- | -------- |
| FR-001 | Provide a single, current view of road passability across the pilot corridor (BR-001). | High     |
| FR-002 | Simulate a rainfall event and show the resulting depth and passability (BR-002).       | High     |
| FR-003 | Recommend a route that a vehicle of known clearance can actually drive (BR-003).       | High     |
| FR-004 | Present incoming reports as a queue ordered by severity (BR-004).                      | High     |
| FR-005 | Allow the queue to be narrowed by source and free-text search (BR-005).                | Medium   |
| FR-006 | Show the evidence behind a report before a decision is made (BR-006).                  | High     |
| FR-007 | Record a triage decision: reject, escalate, hold or dispatch (BR-007).                 | High     |
| FR-008 | Keep an auditable trail of decisions and overrides (BR-008).                           | High     |
| FR-009 | Restrict access to authorised personnel by role (BR-009).                              | High     |
| FR-010 | Operate on the equipment the LGU already has (BR-010).                                 | Medium   |
| FR-011 | Protect the personal data of reporters (BR-011).                                       | High     |
| FR-012 | Produce management information after an event (BR-012).                                | Low      |

The complete business requirements, with current implementation status, are in
Appendix A.

## Non-Functional Requirements

| Req ID  | Description                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------- |
| NFR-001 | Network state responds within 500 ms at p95 for the pilot graph (target; not yet load-tested). |
| NFR-002 | Route requests respond within 200 ms at p95 (target; not yet load-tested).                     |
| NFR-003 | API availability of 99% during a declared event `[TBC]`.                                       |
| NFR-004 | No High or Medium findings from the OWASP ZAP API scan.                                        |
| NFR-005 | No secrets in the repository; runtime configuration supplied by environment variables.         |
| NFR-006 | Public database roles cannot read or write application tables (row-level security).            |
| NFR-007 | Reporter personal data is not exposed to unauthenticated callers.                              |
| NFR-008 | A dispatcher completes a triage decision in three interactions or fewer.                       |
| NFR-009 | System Usability Scale score of at least 75 `[TBC]`.                                           |
| NFR-010 | Usable in current Chrome, Edge and Firefox at 1366×768 and above.                              |
| NFR-011 | Keyboard-reachable controls, visible focus, and AA contrast on text.                           |
| NFR-012 | Schema changes only through migrations; no drift between models and history.                   |
| NFR-013 | The API runs from a container with all configuration supplied externally.                      |
| NFR-014 | Every override and decision is attributable to an actor and a timestamp.                       |
| NFR-015 | API instances can be added horizontally behind a load balancer.                                |
| NFR-016 | Recovery point and recovery time objectives are defined and tested `[TBC]`.                    |
| NFR-017 | Times shown in PHT, distances in metres/kilometres, depths in centimetres.                     |

## Risks

Business-level risks. The full register, scoring and responses are in
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) §RAID Log.

| Risk                                              | Impact                                     | Mitigation                                                                                     |
| ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Model outputs judged unrealistic by practitioners | Trust collapses; the tool is not adopted   | Declare calibration constants; validate against documented events; present as decision support |
| Authentication not delivered in the pilot         | Cannot be used with real data              | State the limitation; schedule it as the first post-pilot increment                            |
| No baseline data from the client                  | Benefits cannot be quantified              | Use audit-trail and risk benefits; collect the baseline during the pilot                       |
| Dispatchers find the portal slower than radio     | They bypass the system                     | Usability sessions from M4; keep the existing process running in parallel                      |
| Pilot corridor changes late                       | Seed data and demonstration rework         | Freeze the corridor at M2; changes require a change request                                    |
| Personal data incident during testing             | Legal and ethical exposure                 | Synthetic data only; row-level security verified; no personal data in logs                     |
| Hosted database secret never supplied             | Hosted deployment not demonstrated         | Local stack is the primary demonstration; the CD workflow is gated and visible                 |
| Scope creep into native apps and live sensors     | Schedule overrun; nothing accepted on time | Hold the charter boundary; every addition requires a change request                            |

## Success Metrics

| KPI                                        | Target                        |
| ------------------------------------------ | ----------------------------- |
| Report-to-triage time                      | Below the M1 baseline `[TBC]` |
| Dispatches aborted for road conditions     | 0 per event                   |
| Decisions with actor, timestamp and action | 100%                          |
| Route responses respecting clearance       | 100%                          |
| High/Medium security findings              | 0                             |
| `Must` requirements accepted               | 100% by M5                    |
| System Usability Scale                     | ≥ 75 `[TBC]`                  |

## Appendix A — Business Requirements and Scope

### A.1 Business requirements

Priority uses MoSCoW. "Current state" records what the delivered pilot actually
does, so this document is also an honest statement of scope.

| ID     | Business requirement                                                         | Priority | Current state                                                                          |
| ------ | ---------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| BR-001 | Provide a single, current view of road passability across the pilot corridor | Must     | Met — network state endpoint returns every edge with depth and status                  |
| BR-002 | Allow the operations unit to ask "what happens if it rains this hard?"       | Must     | Met — rainfall simulation endpoint                                                     |
| BR-003 | Recommend a route that a vehicle of known clearance can actually drive       | Must     | Met — routing endpoint                                                                 |
| BR-004 | Present incoming reports as a prioritised queue                              | Must     | Met — queue ordered by urgency score                                                   |
| BR-005 | Allow narrowing the queue by source and by free-text search                  | Should   | Met — source filters and search                                                        |
| BR-006 | Show the evidence behind a report before a decision is made                  | Must     | Partly met — evidence panels are populated from the report record                      |
| BR-007 | Record a triage decision: reject, escalate, hold or dispatch                 | Must     | Met in the portal — decisions append to the operations log                             |
| BR-008 | Keep an auditable trail of overrides and decisions                           | Must     | Partly met — audit entity and schema exist; writes are not exposed                     |
| BR-009 | Restrict access to authorised personnel by role                              | Must     | Not met — the login screen is presentational                                           |
| BR-010 | Operate on the equipment the LGU already has                                 | Should   | Met — browser-based portal                                                             |
| BR-011 | Protect the personal data of reporters                                       | Must     | Partly met — database access denied to public API roles; API itself is unauthenticated |
| BR-012 | Provide management information after an event                                | Could    | Not met — future release                                                               |

`Must` requirements define the acceptance boundary. BR-009 is the largest open
item and is tracked as R-007 in the RAID log.

### A.2 In scope

- Flood simulation across a defined pilot road graph.
- Clearance-aware route computation.
- LGU web portal: login, queue, incident detail, operations log, dispatch actions.
- Hosted database with versioned schema and access controls.
- Automated build, test and security checks.

### A.3 Out of scope

- Native mobile clients.
- Live sensor, CCTV or weather-feed ingestion.
- Production identity provider and single sign-on.
- Real citizen report intake.
- Multi-LGU deployment, billing and tenancy.
- Public information portal.

### A.4 Boundary statement for acceptance

The pilot is accepted on a **demonstration corridor with synthetic rainfall and
a documented mock incident queue**. It is not accepted as a production dispatch
system until BR-009 and the incident intake path are delivered.

## Appendix B — Business Rules, Assumptions and Constraints

### B.1 Business rules

| ID        | Rule                                                                                       | Rationale                                                  |
| --------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| BRULE-001 | An edge is impassable when water depth is greater than or equal to the vehicle's clearance | Water at or above clearance means the vehicle cannot cross |
| BRULE-002 | Water at or above the caution threshold is a warning but remains passable                  | Avoids rejecting routes that are still usable              |
| BRULE-003 | Every dispatch, escalation, hold or rejection records actor, timestamp and action          | Accountability after the event                             |
| BRULE-004 | A manual override of simulated depth takes precedence until cleared                        | Local knowledge outranks a model                           |
| BRULE-005 | A report is dismissed only with a recorded action; never silently deleted                  | Audit integrity                                            |
| BRULE-006 | Personal data is visible only to authorised roles                                          | Data Privacy Act compliance                                |
| BRULE-007 | Queue priority is urgency, not arrival time                                                | Severity-first response                                    |

### B.2 Assumptions and constraints

| Type       | ID    | Statement                                                               |
| ---------- | ----- | ----------------------------------------------------------------------- |
| Assumption | A-001 | A PostGIS-capable PostgreSQL instance is available                      |
| Assumption | A-002 | The pilot corridor is representative enough to demonstrate routing      |
| Assumption | A-003 | Free or institutional service tiers suffice for the pilot               |
| Assumption | A-004 | Dispatchers have a modern desktop browser and reliable connectivity     |
| Assumption | A-005 | Rainfall intensity is supplied manually or from public data             |
| Assumption | A-006 | The client provides corridor and barangay naming conventions            |
| Constraint | C-001 | Delivery must fit the academic term                                     |
| Constraint | C-002 | Team effort is part-time and shared with coursework                     |
| Constraint | C-003 | No paid GitHub Code Security, so CodeQL cannot analyse the private repo |
| Constraint | C-004 | Only synthetic or public data may be used                               |
| Constraint | C-005 | Credentials are secrets and never committed                             |
| Dependency | D-001 | Hosted database connection string supplied as a repository secret       |
| Dependency | D-002 | Adviser and panel availability for reviews                              |
| Dependency | D-003 | Client confirms the pilot corridor                                      |

## Appendix C — Glossary

| Term              | Meaning                                                       |
| ----------------- | ------------------------------------------------------------- |
| A\*               | Graph search that finds a shortest path using a heuristic     |
| Clearance         | Vehicle height in centimetres that water must stay below      |
| Corridor          | The set of roads covered by the pilot                         |
| Curve Number (CN) | SCS parameter describing how much rainfall becomes runoff     |
| Dispatch          | Committing a rescue unit to an incident                       |
| Edge              | A road segment between two intersections                      |
| GeoJSON           | JSON encoding of geographic features                          |
| LGU               | Local Government Unit                                         |
| MDRRMC            | Disaster Risk Reduction and Management Council                |
| Node              | An intersection or endpoint on the road graph                 |
| Passability       | Whether a vehicle can drive an edge given current water depth |
| PostGIS           | Spatial extension for PostgreSQL                              |
| Runoff            | Rainfall that does not infiltrate and flows over the surface  |
| SCS-CN            | Soil Conservation Service Curve Number runoff method          |
| Triage            | Verifying and prioritising incoming reports                   |
