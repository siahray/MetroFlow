# BUSINESS REQUIREMENTS DOCUMENT (BRD)

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

## Document Control - Revision History

| Version | Date        | Author         | Description                                                        |
| ------- | ----------- | -------------- | ------------------------------------------------------------------ |
| 1.0     | 21 Oct 2026 | «Project Team» | Initial Version                                                    |
| 1.1     | 21 Oct 2026 | «Project Team» | CR-001: driver app, live hazards, fleet dispatch, sensor ingestion |
| 1.2     | 22 Oct 2026 | «Project Team» | Provider keys, Supabase Auth, Mapbox tiles and template-sourced UI |

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
routing engine, an LGU dispatch portal and a driver app. The engine computes
street-level flood depth across a road graph; the router returns the fastest
path a vehicle of a given clearance can actually drive; the portal presents the
network state, a live map and a triage queue with evidence and an auditable
action trail; the driver app turns verified hazards into navigation warnings and
reroutes, and carries field reports back to the operations centre even when the
network drops.

This document states the business problem, requirements and success measures for
the pilot. Technical behaviour is specified in [FSD.md](FSD.md) and construction
in [TSD.md](TSD.md).

## Business Problem Statement

During a rain event, the LGU operations centre cannot verify four things that
determine its decisions:

1. **Which roads are passable now.** Flood depth is estimated by eye or from a
   caller's description, not measured against the vehicle that must cross.
2. **Which reports are real and urgent.** Reports arrive unstructured and
   duplicated, so dispatcher time goes to deduplication instead of triage.
3. **What was decided and why.** Decisions are recorded informally, if at all,
   so an event cannot be reviewed or defended afterwards.
4. **Whether drivers received the warning in time.** Verified information does
   not reach the road, so drivers enter flooded streets that the operations
   centre already knows about.

The consequence is operational: aborted dispatches, duplicated effort, slower
response, and no institutional learning between events. The cost of the status
quo is measured in response time, not in licence fees — which is why the
business case compares options on operational fit, not purchase price alone.

## Project Objectives

| ID     | Objective                                                  | Success Measure                                                                                        |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| BO-001 | Reduce time from report received to triage decision        | Median minutes fall below the M1 baseline `[TBC]`                                                      |
| BO-002 | Prevent dispatch into impassable roads                     | Zero dispatch attempts aborted for road conditions per event                                           |
| BO-003 | Reduce duplicated reports entering the queue               | Duplicate screening rate improves against the M1 baseline `[TBC]`                                      |
| BO-004 | Make every decision auditable                              | 100% of decisions carry actor, timestamp and action                                                    |
| BO-005 | Keep the system available during a declared event          | Availability at or above `[TBC]` during rain events                                                    |
| BO-006 | Give responders a route that respects vehicle clearance    | 100% of route responses contain no segment at or above the requested clearance, or an explicit refusal |
| BO-007 | Keep drivers out of verified flood hazards                 | 100% of active routes reroute or alert before entering a published hazard polygon                      |
| BO-008 | Shorten the path from field observation to verified hazard | Median time from report submission to publish decision below the M1 baseline `[TBC]`                   |

Targets are agreed with the client at M1. BO-002 is expressed as zero tolerance
because a single dispatch into deep water can be fatal.

## Stakeholders

| Stakeholder             | Department                          | Role                                               |
| ----------------------- | ----------------------------------- | -------------------------------------------------- |
| «Project Sponsor»       | MDRRMC / «Client LGU»               | Funds, authorises and accepts the pilot            |
| «Client Representative» | LGU operations and IT (CDMO)        | Business owner; provides corridor data and access  |
| Dispatchers             | Operations centre                   | Primary users of the triage queue                  |
| Barangay responders     | Field units                         | Consume routes and dispatch instructions           |
| Rescue commanders       | MDRRMC operations                   | Approve dispatch and oversee rescue routes         |
| Drivers and commuters   | Public roads in the pilot corridor  | Receive warnings, reroute and submit field reports |
| «Project Adviser»       | «Institution»                       | Academic oversight and quality gate                |
| «Project Team»          | Applications development            | Design, build, test and document                   |
| Citizens                | Barangays within the pilot corridor | Report incidents; affected by response time        |

Personas and engagement detail are in [PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md).

## Functional Requirements

These are the business-level capabilities. The FSD decomposes them into
`FSD-FR-001` to `FSD-FR-093`; each row here names the business requirement it
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
| FR-013 | Give drivers flood-aware navigation and automatic rerouting (BR-013).                  | High     |
| FR-014 | Accept structured field reports with photo and depth evidence (BR-014).                | High     |
| FR-015 | Let a driver request emergency rescue with an exact location (BR-015).                 | High     |
| FR-016 | Give dispatchers a live map, fleet visibility and flood-safe dispatch (BR-016).        | High     |
| FR-017 | Ingest river and rain gauge readings and flag impacted roads (BR-017).                 | Medium   |
| FR-018 | Keep navigation, hazards and reporting usable offline (BR-018).                        | High     |

The complete business requirements, with current implementation status, are in
Appendix A.

## Non-Functional Requirements

| Req ID  | Description                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| NFR-001 | Network state responds within 500 ms at p95 for the pilot graph (target; not yet load-tested).                     |
| NFR-002 | Route requests respond within 200 ms at p95 (target; not yet load-tested).                                         |
| NFR-003 | API availability of 99% during a declared event `[TBC]`.                                                           |
| NFR-004 | No High or Medium findings from the OWASP ZAP API scan.                                                            |
| NFR-005 | No secrets in the repository; runtime configuration supplied by environment variables.                             |
| NFR-006 | Public database roles cannot read or write application tables (row-level security).                                |
| NFR-007 | Reporter personal data is not exposed to unauthenticated callers.                                                  |
| NFR-008 | A dispatcher completes a triage decision in three interactions or fewer.                                           |
| NFR-009 | System Usability Scale score of at least 75 `[TBC]`.                                                               |
| NFR-010 | Usable in current Chrome, Edge and Firefox at 1366×768 and above.                                                  |
| NFR-011 | Keyboard-reachable controls, visible focus, and AA contrast on text.                                               |
| NFR-012 | Schema changes only through migrations; no drift between models and history.                                       |
| NFR-013 | The API runs from a container with all configuration supplied externally.                                          |
| NFR-014 | Every override and decision is attributable to an actor and a timestamp.                                           |
| NFR-015 | API instances can be added horizontally behind a load balancer.                                                    |
| NFR-016 | Recovery point and recovery time objectives are defined and tested `[TBC]`.                                        |
| NFR-017 | Times shown in PHT, distances in metres/kilometres, depths in centimetres.                                         |
| NFR-018 | The driver app navigates and accepts reports from the cached corridor when offline `[TBC]`.                        |
| NFR-019 | A published hazard reaches every connected SSE client in 100 ms at p95, server-side.                               |
| NFR-020 | Every privileged LGU action is role-checked; unauthorised calls return 403 and change nothing.                     |
| NFR-021 | Driver positions are rounded to 50 m, device ids salted-hashed, and retained at most 24 hours.                     |
| NFR-022 | Telemetry is throttled to at most one batch per five seconds per device.                                           |
| NFR-023 | Storm and night themes keep AA text contrast and pair colour with a text or shape cue.                             |
| NFR-024 | The driver app becomes interactive within 5 s on a mid-range phone over 4G `[TBC]`.                                |
| NFR-025 | The LGU map renders the pilot network and active hazards at a usable frame rate while panning and zooming `[TBC]`. |

## Risks

Business-level risks. The full register, scoring and responses are in
[PROJ_MANAGEMENT_PLAN.md](PROJ_MANAGEMENT_PLAN.md) §RAID Log.

| Risk                                              | Impact                                     | Mitigation                                                                                     |
| ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Model outputs judged unrealistic by practitioners | Trust collapses; the tool is not adopted   | Declare calibration constants; validate against documented events; present as decision support |
| Route-level authorisation not delivered before acceptance | Cannot be used with real data       | CR-001 adds API-issued tokens and roles; route enforcement (TSD LIM-022) is a release gate before any real data |
| No baseline data from the client                  | Benefits cannot be quantified              | Use audit-trail and risk benefits; collect the baseline during the pilot                       |
| Dispatchers find the portal slower than radio     | They bypass the system                     | Usability sessions from M4; keep the existing process running in parallel                      |
| Pilot corridor changes late                       | Seed data and demonstration rework         | Freeze the corridor at M2; changes require a change request                                    |
| Personal data incident during testing             | Legal and ethical exposure                 | Synthetic data only; row-level security verified; no personal data in logs                     |
| Hosted database secret never supplied             | Hosted deployment not demonstrated         | Local stack is the primary demonstration; the CD workflow is gated and visible                 |
| CR-001 scope exceeds the remaining term           | Schedule overrun; nothing accepted on time | Phase gates; `Must` requirements first; every further addition requires a change request       |
| Drivers do not adopt the app                      | Field evidence stays thin                  | Usability tests from M7; QR onboarding; synthetic reports remain a fallback                    |
| Background location limits on iOS                 | Telemetry gaps during navigation           | Foreground-only telemetry; limitation recorded                                                  |
| Driver location privacy incident                  | Legal and ethical exposure                 | Rounding, hashing, 24-hour retention, role-only access, synthetic test data                    |
| Sensor threshold false positives                  | Unnecessary closures and reroutes          | Advisory state until a dispatcher confirms; threshold configured per sensor                    |
| Realtime stream overload                          | Late or dropped hazard warnings            | Redis pub/sub, bounded queues, reconnect with a full snapshot                                  |

## Success Metrics

| KPI                                         | Target                                         |
| ------------------------------------------- | ---------------------------------------------- |
| Report-to-triage time                       | Below the M1 baseline `[TBC]`                  |
| Dispatches aborted for road conditions      | 0 per event                                    |
| Decisions with actor, timestamp and action  | 100%                                           |
| Route responses respecting clearance        | 100%                                           |
| High/Medium security findings               | 0                                              |
| `Must` requirements accepted                | 100% by M9                                     |
| System Usability Scale                      | ≥ 75 `[TBC]`                                   |
| Hazard publish to SSE event                 | ≤ 100 ms at p95, server-side                   |
| Offline route completion in cached corridor | 100% of scripted runs                          |
| Privileged actions blocked without a role   | 100%                                           |
| Driver reports reaching a triage decision   | 100% of queued reports have a recorded outcome |

## Appendix A — Business Requirements and Scope

### A.1 Business requirements

Priority uses MoSCoW. "Current state" records what the delivered pilot actually
does, so this document is also an honest statement of scope.

| ID     | Business requirement                                                         | Priority | Current state                                                                         |
| ------ | ---------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| BR-001 | Provide a single, current view of road passability across the pilot corridor | Must     | Met — network state endpoint returns every edge with depth and status                 |
| BR-002 | Allow the operations unit to ask "what happens if it rains this hard?"       | Must     | Met — rainfall simulation endpoint                                                    |
| BR-003 | Recommend a route that a vehicle of known clearance can actually drive       | Must     | Met — routing endpoint                                                                |
| BR-004 | Present incoming reports as a prioritised queue                              | Must     | Met — queue ordered by urgency score                                                  |
| BR-005 | Allow narrowing the queue by source and by free-text search                  | Should   | Met — source filters and search                                                       |
| BR-006 | Show the evidence behind a report before a decision is made                  | Must     | Partly met — evidence panels are populated from the report record                     |
| BR-007 | Record a triage decision: reject, escalate, hold or dispatch                 | Must     | Met in the portal — decisions append to the operations log                            |
| BR-008 | Keep an auditable trail of overrides and decisions                           | Must     | Partly met — schema exists; write path planned under CR-001                           |
| BR-009 | Restrict access to authorised personnel by role                              | Must     | Partly met — API-issued tokens, bcrypt credentials and role checks exist; most routes do not yet require the token (TSD LIM-022) |
| BR-010 | Operate on the equipment the LGU already has                                 | Should   | Met — browser-based portal                                                            |
| BR-011 | Protect the personal data of reporters                                       | Must     | Partly met — database access denied to public API roles; privacy controls planned     |
| BR-012 | Provide management information after an event                                | Could    | Not met — future release                                                              |
| BR-013 | Give drivers flood-aware navigation that reroutes around verified hazards    | Must     | Not met — planned under CR-001                                                        |
| BR-014 | Let drivers submit structured flood reports with photo and depth evidence    | Must     | Not met — planned under CR-001                                                        |
| BR-015 | Let drivers request emergency rescue with an exact location in one action    | Must     | Partly met — SOS creation and listing persist through the API; no native telephony    |
| BR-016 | Give dispatchers a live map, fleet visibility and flood-safe dispatch        | Must     | Partly met — fleet, hazard and dispatch calls persist through the API; map layers are static |
| BR-017 | Ingest river and rain gauge data and flag impacted roads automatically       | Should   | Not met — planned under CR-001                                                        |
| BR-018 | Keep navigation, hazards and reporting usable when connectivity drops        | Must     | Not met — planned under CR-001                                                        |

`Must` requirements define the acceptance boundary. BR-009, BR-013 to BR-016 and
BR-018 are the largest open items; CR-001 is the vehicle that closes them.

### A.2 In scope

- Flood simulation across a defined pilot road graph.
- Clearance-aware route computation with coordinates, hazard avoidance and turn
  instructions.
- Driver app: destination, turn-by-turn, rerouting, proximity alerts, reports,
  offline operation, telemetry and SOS.
- LGU web portal: authenticated login, live MapLibre map, moderation queue,
  evidence desk, drawing tools, fleet monitoring and dispatch.
- Verification and publishing of hazards to connected clients.
- River and rain gauge ingestion with advisory road impact.
- API-issued session tokens, role-based access control and audit writes.
- Hosted database with versioned schema and access controls.
- Automated build, test and security checks, including the mobile client.

### A.3 Out of scope

- Native iOS or Android store builds.
- Real CCTV integration; a labelled demo feed registry is used.
- Production SMS, telephony or carrier integration for SOS.
- Offline basemap tiles; offline mode renders the cached road graph.
- Multi-LGU deployment, billing and tenancy.
- Production single sign-on.
- Public information portal.

### A.4 Boundary statement for acceptance

The pilot is accepted on a **demonstration corridor with synthetic rainfall, a
seeded sensor set, a labelled CCTV demo registry and a real persisted report
flow**. It is not accepted as a production dispatch system until real sensor and
CCTV agreements, carrier-grade SOS delivery and multi-LGU isolation are in
place. Those items are recorded in TSD §7 and are not implied by this release.

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
| BRULE-008 | Only a verified hazard changes driver routing; unverified reports never reroute a driver   | False alarms must not create unsafe detours                |
| BRULE-009 | A driver is rerouted when a verified hazard intersects the remaining route                 | Prevention is safer than a warning at the water's edge     |
| BRULE-010 | An SOS requires a location fix no older than 60 seconds                                    | A rescue request without a location is not actionable      |
| BRULE-011 | Only an available unit may be assigned; assignment changes its status to en route          | Double-booking a unit delays both responses                |
| BRULE-012 | A sensor threshold breach is advisory until a dispatcher confirms it                       | Sensors drift; a human owns the operational decision       |
| BRULE-013 | Driver location is rounded, device identity is hashed, and retention is at most 24 hours   | Data minimisation under RA 10173                           |

### B.2 Assumptions and constraints

| Type       | ID    | Statement                                                                 |
| ---------- | ----- | ------------------------------------------------------------------------- |
| Assumption | A-001 | A PostGIS-capable PostgreSQL instance is available                        |
| Assumption | A-002 | The pilot corridor is representative enough to demonstrate routing        |
| Assumption | A-003 | Free or institutional service tiers suffice for the pilot                 |
| Assumption | A-004 | Dispatchers have a modern desktop browser and reliable connectivity       |
| Assumption | A-005 | Rainfall is supplied manually, with optional OpenWeather data             |
| Assumption | A-006 | The client provides corridor and barangay naming conventions              |
| Assumption | A-007 | Drivers have a smartphone with a modern browser, camera and geolocation   |
| Assumption | A-008 | Cellular data can drop during an event, so offline operation is required  |
| Assumption | A-009 | Sensor readings may be simulated for the pilot but must be labelled       |
| Assumption | A-010 | Mapbox tiles are available on the pilot tier; OSM is the no-key fallback  |
| Constraint | C-001 | Delivery must fit the academic term                                       |
| Constraint | C-002 | Team effort is part-time and shared with coursework                       |
| Constraint | C-003 | No paid GitHub Code Security, so CodeQL cannot analyse the private repo   |
| Constraint | C-004 | Only synthetic or public data may be used                                 |
| Constraint | C-005 | Credentials are never committed; public keys are restricted by origin     |
| Constraint | C-006 | The driver client ships as a native Expo app, not a public store release |
| Constraint | C-007 | No real CCTV feed is available; a labelled demo registry is used          |
| Constraint | C-008 | Basemap tiles are online-only; offline mode uses the cached graph         |
| Constraint | C-009 | The pilot is single-LGU and single-region                                 |
| Constraint | C-010 | UI follows the client-supplied HTML/CSS template; no bespoke UI design    |
| Dependency | D-001 | Hosted database connection string supplied as a repository secret         |
| Dependency | D-002 | Adviser and panel availability for reviews                                |
| Dependency | D-003 | Client confirms the pilot corridor                                        |
| Dependency | D-004 | Supabase project credentials and pilot accounts supplied at deployment    |
| Dependency | D-005 | Persistent upload volume or object storage for evidence photos            |
| Dependency | D-006 | Mapbox and OSM tile services remain reachable within their usage policies |
| Dependency | D-007 | Weather, terrain and imagery providers remain within their quotas         |

## Appendix C — Glossary

| Term              | Meaning                                                       |
| ----------------- | ------------------------------------------------------------- |
| A\*               | Graph search that finds a shortest path using a heuristic     |
| Clearance         | Vehicle height in centimetres that water must stay below      |
| Corridor          | The set of roads covered by the pilot                         |
| Curve Number (CN) | SCS parameter describing how much rainfall becomes runoff     |
| Dispatch          | Committing a rescue unit to an incident                       |
| Edge              | A road segment between two intersections                      |
| EXIF              | Photo metadata, including capture time and GPS, when present  |
| GeoJSON           | JSON encoding of geographic features                          |
| Hazard polygon    | Verified flood area drawn or approved by the LGU              |
| SQLite            | On-device database used for offline driver data               |
| LGU               | Local Government Unit                                         |
| MDRRMC            | Disaster Risk Reduction and Management Council                |
| Node              | An intersection or endpoint on the road graph                 |
| Passability       | Whether a vehicle can drive an edge given current water depth |
| PostGIS           | Spatial extension for PostgreSQL                              |
| Expo              | React Native framework used for the native driver app         |
| RBAC              | Role-based access control                                     |
| Runoff            | Rainfall that does not infiltrate and flows over the surface  |
| SCS-CN            | Soil Conservation Service Curve Number runoff method          |
| SOS               | One-tap emergency rescue request with location                |
| SSE               | Server-sent events; one-way realtime stream from server       |
| Telemetry         | Periodic vehicle position and movement report                 |
| Triage            | Verifying and prioritising incoming reports                   |
