# Business Requirements Document — MetroFlow

| Field             | Value                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Document ID       | MF-BRD-001                                                                                       |
| Version           | 1.0 (Draft)                                                                                      |
| Status            | For academic review                                                                              |
| Date              | 21 October 2026                                                                                  |
| Prepared by       | «Project Team»                                                                                   |
| Reviewed by       | «Project Adviser»                                                                                |
| Approved by       | «Project Sponsor»                                                                                |
| Related documents | [PROJECT_CHARTER.md](PROJECT_CHARTER.md), [FSD.md](FSD.md), [BUSINESS_CASE.md](BUSINESS_CASE.md) |

## Revision history

| Version | Date        | Author         | Change                        |
| ------- | ----------- | -------------- | ----------------------------- |
| 1.0     | 21 Oct 2026 | «Project Team» | Initial business requirements |

## 1. Purpose and audience

This document states **what the business needs** from MetroFlow and how success
will be measured. It deliberately avoids technical design; the behaviour of the
system is specified in [FSD.md](FSD.md) and its construction in
[TSD.md](TSD.md).

Audiences:

- **Project sponsor and client representative** — to confirm the problem,
  priorities and acceptance measures.
- **Project adviser and panel** — to judge whether the delivered system answers a
  real operational need.
- **Project team** — to derive functional requirements without re-litigating
  business intent.

## 2. Business context

Metro Manila's flood risk is a recurring operational problem, not an exceptional
one. Seasonal rain, tidal backflow and constrained drainage combine so that
specific low-lying corridors — underpasses, creek-adjacent streets, and
intersections near spillways — become impassable within minutes. The roads that
flood are known; what is unknown during an event is **their current state**.

Two units are affected:

| Unit                             | Responsibility                                              | Current information source                            |
| -------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| LGU dispatch / operations centre | Verifies reports and commits rescue resources               | Radio, phone calls, social media, personal experience |
| MDRRMC operations                | Coordinates response across barangays and national agencies | Verbal updates and periodic situation reports         |

Both units make decisions under time pressure with information that is
unstructured, duplicated and unverified. A dispatcher cannot tell from a phone
call whether the route to a reported incident is itself submerged.

## 3. Problem statement

### 3.1 Current state

1. A citizen or field unit reports flooding by call, message or radio.
2. The dispatcher records it informally, often on paper or in a chat thread.
3. Verification depends on the dispatcher's familiarity with the area or on a
   second call.
4. A rescue unit is assigned without a verified route.
5. Outcomes are not captured in a form that supports review.

### 3.2 Pain points

| ID   | Pain point                                                           | Consequence                                                |
| ---- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| P-01 | No shared, current picture of road passability                       | Responders are routed into flooded roads                   |
| P-02 | Reports arrive unstructured and duplicated                           | Dispatcher time is spent deduplicating instead of deciding |
| P-03 | Evidence (photos, sensor readings) is not co-located with the report | Verification is slow and inconsistent                      |
| P-04 | Decisions and their rationale are not recorded                       | No accountability, no learning between events              |
| P-05 | Flood depth is estimated by eye                                      | Vehicle clearance is not matched to actual water depth     |
| P-06 | Queue priority is first-come rather than severity-based              | High-risk incidents wait behind low-risk ones              |

### 3.3 Evidence and validation

Quantitative baselines are `[TBC]` and must be collected from the client during
M1 (see PMP §10, R-08). The intended method is a one-week observation of the
operations centre during a rain event, recording report volume, time-to-triage
and the number of dispatches aborted because of road conditions.

Where a figure is `[TBC]`, the requirement still stands; only its target is
unconfirmed.

## 4. Vision and opportunity

> A dispatcher opens one screen during a rain event, sees which roads are
> passable right now, receives a prioritised queue of verified reports, and
> commits a rescue unit along a route the system has already checked against the
> vehicle's clearance — with every decision written down.

The opportunity is to convert fragmented, verbal coordination into a
**verifiable operational record** without requiring the LGU to replace its
existing command structure.

## 5. Objectives and key performance indicators

| ID    | Business objective                           | KPI                                                             | Baseline      | Target | Measurement                             |
| ----- | -------------------------------------------- | --------------------------------------------------------------- | ------------- | ------ | --------------------------------------- |
| BO-01 | Reduce time from report to triage decision   | Median minutes, report received → decision recorded             | [TBC]         | [TBC]  | System timestamps                       |
| BO-02 | Prevent dispatch into impassable roads       | Dispatch attempts aborted for road conditions per event         | [TBC]         | 0      | Incident log review                     |
| BO-03 | Reduce duplicated reports entering the queue | Duplicate reports screened per event                            | [TBC]         | [TBC]  | Queue audit                             |
| BO-04 | Make decisions auditable                     | Decisions with actor, timestamp and rationale                   | 0%            | 100%   | Operations log completeness             |
| BO-05 | Keep the system available during an event    | Availability during declared rain events                        | [TBC]         | [TBC]  | Health checks and incident reports      |
| BO-06 | Give responders a usable route               | Route requests returning a passable path or an explicit refusal | Not available | 100%   | API contract tests and field validation |

Targets are set with the client at M1. `BO-02` is expressed as zero tolerance
because a single dispatch into deep water can be fatal.

## 6. Business requirements

Priority uses MoSCoW. "Current state" records what the delivered pilot actually
does, so this document is also an honest statement of scope.

| ID    | Business requirement                                                         | Priority | Current state                                                              | Acceptance                                                                       |
| ----- | ---------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| BR-01 | Provide a single, current view of road passability across the pilot corridor | Must     | Met — network state endpoint returns every edge with depth and status      | Every edge carries `PASSABLE`, `LIGHT_FLOOD` or `SUBMERGED`                      |
| BR-02 | Allow the operations unit to ask "what happens if it rains this hard?"       | Must     | Met — rainfall simulation endpoint                                         | Simulation returns updated depth and status for the whole graph                  |
| BR-03 | Recommend a route that a vehicle of known clearance can actually drive       | Must     | Met — routing endpoint                                                     | Route segments are all below the requested clearance, or the system refuses      |
| BR-04 | Present incoming reports as a prioritised queue                              | Must     | Met — queue ordered by urgency score                                       | Queue order and counts reflect the underlying data                               |
| BR-05 | Allow narrowing the queue by source and by free-text search                  | Should   | Met — source filters and search                                            | Filter counts match the data; search matches report id, reporter, location       |
| BR-06 | Show the evidence behind a report before a decision is made                  | Must     | Partly met — evidence panels are populated from the report record          | Narrative, photo metadata, location context and sensor readings visible together |
| BR-07 | Record a triage decision: reject, escalate, hold or dispatch                 | Must     | Met in the portal — decisions append to the operations log                 | Each action produces a timestamped log entry naming the actor                    |
| BR-08 | Keep an auditable trail of overrides and decisions                           | Must     | Partly met — audit log entity and schema exist; writes are not yet exposed | Every override and decision is attributable and immutable                        |
| BR-09 | Restrict access to authorised personnel by role                              | Must     | Not met — the login screen is presentational                               | Only authenticated users reach the queue; roles bound what they can do           |
| BR-10 | Operate on the equipment the LGU already has                                 | Should   | Met — browser-based portal                                                 | Usable on a standard desktop browser at 1366×768 or larger                       |
| BR-11 | Protect the personal data of reporters                                       | Must     | Partly met — database access is denied to public API roles                 | No personal data is exposed to unauthenticated callers                           |
| BR-12 | Provide management information after an event                                | Could    | Not met — future release                                                   | Report of volumes, triage times, decisions and duplicates                        |

`Must` requirements form the acceptance boundary for the pilot. BR-09 is the
largest open item and is tracked as R-07 in the PMP risk register.

## 7. Stakeholders and personas

### 7.1 Stakeholder summary

| Stakeholder               | Influence | Interest                               | Engagement approach              |
| ------------------------- | --------- | -------------------------------------- | -------------------------------- |
| «Client LGU» / MDRRMC     | High      | Faster, safer dispatch                 | Weekly demo, acceptance sign-off |
| Dispatchers               | High      | Tool must not slow them down           | Usability sessions, shadowing    |
| Barangay responders       | Medium    | Routes and instructions they can trust | Field validation of routes       |
| Citizens                  | Low       | Faster response, data privacy          | Communicated through the LGU     |
| «Project Adviser» / panel | High      | Rigour and completeness                | Milestone reviews                |
| IT support                | Medium    | Something maintainable                 | Documentation and handover       |

### 7.2 Personas

| Persona                                  | Context                                            | Goals                                                        | Frustrations                                                    |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| **Maria — Lead Dispatch Officer**        | Operations centre, multiple screens, radio traffic | Clear priority order; evidence she can trust; fast decisions | Re-asking the same question; reports that contradict each other |
| **Capt. Reyes — MDRRMC Commander**       | Oversees several barangays                         | Know which corridors are cut; justify resource allocation    | Verbal updates that cannot be verified later                    |
| **Driver Santos — rescue unit** (future) | In a vehicle, moving                               | A route that is actually passable for the vehicle            | Being sent into water deeper than the vehicle                   |
| **Citizen**                              | Reporting from a flooded home                      | Report quickly; be rescued                                   | Being asked to repeat details; not knowing if help is coming    |
| **Admin** (future)                       | LGU IT                                             | Manage accounts and data                                     | Undocumented systems                                            |

## 8. Business rules

| ID       | Rule                                                                                       | Rationale                                                  |
| -------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| BRULE-01 | An edge is impassable when water depth is greater than or equal to the vehicle's clearance | Water at or above clearance means the vehicle cannot cross |
| BRULE-02 | Water depth at or above the caution threshold is a warning but remains passable            | Avoids rejecting routes that are still usable              |
| BRULE-03 | Every dispatch, escalation, hold or rejection must record actor, timestamp and action      | Accountability after the event                             |
| BRULE-04 | A manual override of simulated depth takes precedence over the model until cleared         | Local knowledge outranks a model                           |
| BRULE-05 | A report may be dismissed only with a recorded action; it is never silently deleted        | Audit integrity                                            |
| BRULE-06 | Personal data is visible only to authorised roles                                          | Data Privacy Act compliance                                |
| BRULE-07 | Queue priority is by urgency score, not arrival time                                       | Severity-first response                                    |

Thresholds referenced by BRULE-01 and BRULE-02 are configuration, not constants
in code, so the client can calibrate them without a release.

## 9. Scope

### 9.1 In scope

- Flood simulation across a defined pilot road graph.
- Clearance-aware route computation.
- LGU web portal: login, queue, incident detail, operations log, dispatch actions.
- Hosted database with versioned schema and access controls.
- Automated build, test and security checks.

### 9.2 Out of scope

- Native mobile clients.
- Live sensor, CCTV or weather-feed ingestion.
- Production identity provider and single sign-on.
- Real citizen report intake.
- Multi-LGU deployment, billing and tenancy.
- Public information portal.

### 9.3 Boundary statement for acceptance

The pilot is accepted on a **demonstration corridor with synthetic rainfall and
a documented mock incident queue**. It is not accepted as a production dispatch
system until BR-09 (authentication and roles) and the incident intake path are
delivered.

## 10. Assumptions, constraints and dependencies

Summarised from [PROJECT_CHARTER.md](PROJECT_CHARTER.md) §9:

| Type       | ID     | Statement                                                        |
| ---------- | ------ | ---------------------------------------------------------------- |
| Assumption | A-01   | A PostGIS-capable PostgreSQL instance is available               |
| Assumption | A-03   | Free or institutional service tiers are sufficient for the pilot |
| Assumption | A-06   | The client provides corridor and barangay naming conventions     |
| Constraint | C-01   | Delivery must fit the academic term                              |
| Constraint | C-04   | Only synthetic or public data may be used                        |
| Dependency | DEP-01 | Hosted database credentials are supplied as a repository secret  |
| Dependency | DEP-03 | Client confirms the pilot corridor                               |

## 11. Benefits

| Benefit                    | Type       | Realisation                                          | Evidence                  |
| -------------------------- | ---------- | ---------------------------------------------------- | ------------------------- |
| Faster triage              | Tangible   | Shorter median report-to-decision time               | System timestamps         |
| Fewer aborted dispatches   | Tangible   | No dispatch into impassable roads                    | Incident log              |
| Defensible decisions       | Tangible   | Complete action trail                                | Operations and audit logs |
| Shared situational picture | Tangible   | One queue and one map state                          | Demonstration             |
| Reduced cognitive load     | Intangible | Dispatcher works one screen instead of four channels | Usability feedback        |
| Institutional memory       | Intangible | Events can be reviewed and compared                  | Exported logs (future)    |

## 12. Risks

Business-level risks; the full register with scoring lives in the PMP.

| ID   | Risk                                              | Effect on the business                         |
| ---- | ------------------------------------------------- | ---------------------------------------------- |
| R-02 | Model outputs judged unrealistic by practitioners | Trust in the tool collapses; adoption fails    |
| R-07 | Authentication not delivered in the pilot         | Cannot be used with real data                  |
| R-08 | No baseline data available from the client        | Benefits cannot be demonstrated quantitatively |
| R-09 | Client changes the pilot corridor late            | Rework of seed data and demonstration          |
| R-12 | Portal is slower than the current radio process   | Dispatchers bypass the system                  |

## 13. Glossary

| Term              | Meaning                                                             |
| ----------------- | ------------------------------------------------------------------- |
| A\*               | Graph search algorithm that finds a shortest path using a heuristic |
| Clearance         | Height under a vehicle, in centimetres, that water must stay below  |
| Corridor          | The set of roads covered by the pilot                               |
| Curve Number (CN) | SCS parameter describing how much rainfall becomes runoff           |
| Dispatch          | Committing a rescue unit to an incident                             |
| Edge              | A road segment between two intersections                            |
| GeoJSON           | JSON encoding of geographic features                                |
| LGU               | Local Government Unit                                               |
| MDRRMC            | Disaster Risk Reduction and Management Council                      |
| Node              | An intersection or endpoint on the road graph                       |
| Passability       | Whether a vehicle can drive an edge given current water depth       |
| PostGIS           | Spatial extension for PostgreSQL                                    |
| Runoff            | Rainfall that does not infiltrate and flows over the surface        |
| SCS-CN            | Soil Conservation Service Curve Number runoff method                |
| Triage            | Verifying and prioritising incoming reports                         |

## 14. Approval

| Role                  | Name                    | Signature | Date  |
| --------------------- | ----------------------- | --------- | ----- |
| Project Sponsor       | «Project Sponsor»       |           | [TBC] |
| Client Representative | «Client Representative» |           | [TBC] |
| Project Adviser       | «Project Adviser»       |           | [TBC] |
| Project Team Lead     | «Project Team Lead»     |           | [TBC] |
