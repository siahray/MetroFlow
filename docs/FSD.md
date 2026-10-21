# FUNCTIONAL SPECIFICATION DOCUMENT (FSD)

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

Version 1.0

## Document Control

| Field       | Value          |
| ----------- | -------------- |
| Project     | MetroFlow      |
| Prepared By | «Project Team» |
| Version     | 1.0            |
| Status      | For Review     |

## BRD Requirements Reference

| BRD ID | Business Requirement                                                   |
| ------ | ---------------------------------------------------------------------- |
| BR-001 | Provide a single, current view of road passability                     |
| BR-002 | Allow the operations unit to simulate a rainfall event                 |
| BR-003 | Recommend a route that a vehicle of known clearance can actually drive |
| BR-004 | Present incoming reports as a prioritised queue                        |
| BR-005 | Allow the queue to be narrowed by source and free-text search          |
| BR-006 | Show the evidence behind a report before a decision is made            |
| BR-007 | Record a triage decision: reject, escalate, hold or dispatch           |
| BR-008 | Keep an auditable trail of overrides and decisions                     |
| BR-009 | Restrict access to authorised personnel by role                        |
| BR-010 | Operate on the equipment the LGU already has                           |
| BR-011 | Protect the personal data of reporters                                 |
| BR-012 | Provide management information after an event                          |

## Functional Requirements

| FSD ID     | BRD Reference | Functional Specification                                                                                      |
| ---------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| FSD-FR-001 | BR-001        | Return every road node and edge as GeoJSON `FeatureCollection`s with live depth and passability               |
| FSD-FR-002 | BR-001        | Accept a vehicle clearance in centimetres, defaulting to 30 cm                                                |
| FSD-FR-003 | BR-001        | Classify each edge as `PASSABLE`, `LIGHT_FLOOD` or `SUBMERGED` from live depth and the requested clearance    |
| FSD-FR-004 | BR-001        | Return stored PostGIS geometry when present and a straight line between endpoints otherwise                   |
| FSD-FR-005 | BR-001        | Reject clearance outside the range greater than 0 and at most 200 with HTTP 422                               |
| FSD-FR-006 | BR-002        | Accept a rainfall intensity from 0 to 250 mm/hr and a vehicle clearance                                       |
| FSD-FR-007 | BR-002        | Compute direct surface runoff for the storm using the SCS Curve Number method                                 |
| FSD-FR-008 | BR-002        | Convert runoff into street ponding depth, weighted by the elevation of the edge's upstream node               |
| FSD-FR-009 | BR-002        | Persist the resulting depth and degraded average speed per edge, leaving manually overridden edges untouched  |
| FSD-FR-010 | BR-002        | Return the updated network together with rainfall, runoff and the number of affected edges in one response    |
| FSD-FR-011 | BR-003        | Accept an origin node, a destination node and a vehicle clearance                                             |
| FSD-FR-012 | BR-003        | Compute the fastest route that avoids every edge whose water depth is at or above the clearance               |
| FSD-FR-013 | BR-003        | Return the ordered node path, a GeoJSON `LineString`, per-segment status and estimated travel time in minutes |
| FSD-FR-014 | BR-003        | Return HTTP 404 with an explanatory message when no safe route exists                                         |
| FSD-FR-015 | BR-003        | Return HTTP 404 naming the available node ids when a requested node does not exist                            |
| FSD-FR-016 | BR-003        | Treat roads as bidirectional                                                                                  |
| FSD-FR-017 | BR-003        | Allow a route whose origin equals its destination, returning a degenerate but valid line                      |
| FSD-FR-018 | BR-009        | Present a login screen with username and password fields, both required                                       |
| FSD-FR-019 | BR-009        | Allow the user to reveal and hide the password                                                                |
| FSD-FR-020 | BR-009        | Offer a forgot-password affordance that states how to obtain a reset                                          |
| FSD-FR-021 | BR-009        | Authenticate credentials against the backend and reject invalid credentials                                   |
| FSD-FR-022 | BR-009        | Maintain a session and end it on sign-out                                                                     |
| FSD-FR-023 | BR-009        | Restrict screens and actions by role                                                                          |
| FSD-FR-024 | BR-004        | List incidents ordered by descending urgency score                                                            |
| FSD-FR-025 | BR-004        | Show report id, urgency, location, reporter, age and evidence tags for each queue item                        |
| FSD-FR-026 | BR-005        | Filter by source: all, photo, sensor mismatch, escalated, with counts per filter                              |
| FSD-FR-027 | BR-005        | Search by report id, reporter, location or barangay                                                           |
| FSD-FR-028 | BR-005        | Show an explicit empty state when no incident matches                                                         |
| FSD-FR-029 | BR-004        | Load the selected incident into the detail panel and mark it as selected                                      |
| FSD-FR-030 | BR-007        | Remove a dismissed incident from the active count without deleting it                                         |
| FSD-FR-031 | BR-004        | Refresh the queue when new reports arrive                                                                     |
| FSD-FR-032 | BR-006        | Show the docket: report id, severity level, reporter, filing time and confidence score                        |
| FSD-FR-033 | BR-006        | Show the witness narrative                                                                                    |
| FSD-FR-034 | BR-006        | Show photo evidence with capture metadata and an estimated submersion range                                   |
| FSD-FR-035 | BR-006        | Show location and sensor context, including nearest rescue unit and rising-water indicators                   |
| FSD-FR-036 | BR-006        | Show the incident's operations log in chronological order and scroll to the newest entry                      |
| FSD-FR-037 | BR-007        | Allow the user to add an internal note to the operations log                                                  |
| FSD-FR-038 | BR-006        | Allow the user to open the original evidence file                                                             |
| FSD-FR-039 | BR-007        | Allow the user to reject an incident as a false alarm                                                         |
| FSD-FR-040 | BR-007        | Allow the user to escalate an incident to BFP or the Coast Guard                                              |
| FSD-FR-041 | BR-007        | Allow the user to hold an incident pending a sensor update                                                    |
| FSD-FR-042 | BR-007        | Allow the user to approve the incident and dispatch the assigned rescue unit                                  |
| FSD-FR-043 | BR-008        | Append a timestamped entry naming the actor to the operations log for every action                            |
| FSD-FR-044 | BR-008        | Persist every action to the backend with a required reason                                                    |
| FSD-FR-045 | BR-007        | Require confirmation before dispatch and offer a short undo window                                            |
| FSD-FR-046 | BR-007        | Constrain the action set by incident state (a dispatched incident cannot be re-dispatched)                    |
| FSD-FR-047 | BR-008        | Record overrides and dispatch decisions with actor, payload, timestamp and integrity hash                     |
| FSD-FR-048 | BR-009        | Allow an administrator to manage users and roles                                                              |
| FSD-FR-049 | BR-012        | Allow export of incident and audit records for post-event review                                              |
| FSD-FR-050 | BR-010        | Expose a health endpoint reporting service identity and status                                                |
| FSD-FR-051 | BR-011        | Carry baseline security headers on every API response                                                         |
| FSD-FR-052 | BR-010        | Expose the machine-readable contract at `/openapi.json`                                                       |
| FSD-FR-053 | BR-001        | Seed a demonstration corridor on first boot without duplicating it on restart                                 |

## Screen Specifications

| BRD Ref | FSD Ref    | Field                                | Type            | Mandatory |
| ------- | ---------- | ------------------------------------ | --------------- | --------- |
| BR-009  | FSD-FR-018 | Login — Username                     | Text            | Yes       |
| BR-009  | FSD-FR-018 | Login — Password                     | Password        | Yes       |
| BR-009  | FSD-FR-019 | Login — Show/hide password           | Button          | No        |
| BR-009  | FSD-FR-020 | Login — Forgot password              | Link            | No        |
| BR-009  | FSD-FR-018 | Login — Remember me                  | Checkbox        | No        |
| BR-009  | FSD-FR-018 | Login — Submit                       | Button          | Yes       |
| BR-010  | FSD-FR-024 | Dashboard — Sector status            | Static text     | No        |
| BR-010  | FSD-FR-024 | Dashboard — Weather advisory         | Static text     | No        |
| BR-010  | FSD-FR-024 | Dashboard — Active SOS count         | Computed number | No        |
| BR-010  | FSD-FR-024 | Dashboard — Operator identity        | Static text     | No        |
| BR-004  | FSD-FR-024 | Queue — Pending verification count   | Computed number | No        |
| BR-005  | FSD-FR-026 | Queue — Source filter                | Segmented tabs  | Yes       |
| BR-005  | FSD-FR-027 | Queue — Search                       | Text            | No        |
| BR-004  | FSD-FR-025 | Queue — Incident card                | List item       | Yes       |
| BR-007  | FSD-FR-030 | Queue — Dismiss                      | Button          | No        |
| BR-006  | FSD-FR-032 | Detail — Report id and severity      | Static text     | No        |
| BR-006  | FSD-FR-032 | Detail — Confidence score            | Static text     | No        |
| BR-006  | FSD-FR-033 | Detail — Witness narrative           | Static text     | No        |
| BR-006  | FSD-FR-034 | Detail — Photo evidence metadata     | Static block    | No        |
| BR-006  | FSD-FR-035 | Detail — Location and sensor context | Static block    | No        |
| BR-006  | FSD-FR-036 | Detail — Operations log              | Scrollable list | No        |
| BR-007  | FSD-FR-037 | Detail — Internal note               | Textarea        | Yes       |
| BR-007  | FSD-FR-039 | Detail — Reject                      | Button          | No        |
| BR-007  | FSD-FR-040 | Detail — Escalate                    | Button          | No        |
| BR-007  | FSD-FR-041 | Detail — Hold                        | Button          | No        |
| BR-007  | FSD-FR-042 | Detail — Approve and dispatch        | Button          | No        |

## Business Rules

| Rule ID   | BRD Ref | FSD Ref                | Rule                                                                         |
| --------- | ------- | ---------------------- | ---------------------------------------------------------------------------- |
| BRULE-001 | BR-003  | FSD-FR-003, FSD-FR-012 | An edge is impassable when water depth is greater than or equal to clearance |
| BRULE-002 | BR-001  | FSD-FR-003             | Water at or above the caution threshold is a warning but remains passable    |
| BRULE-003 | BR-008  | FSD-FR-043             | Every action records actor, timestamp and action                             |
| BRULE-004 | BR-002  | FSD-FR-009             | A manual override outranks simulation until cleared                          |
| BRULE-005 | BR-007  | FSD-FR-030             | Dismissal is recorded, never silent deletion                                 |
| BRULE-006 | BR-011  | FSD-FR-023, FSD-FR-048 | Personal data is visible only to authorised roles                            |
| BRULE-007 | BR-004  | FSD-FR-024             | Queue priority is urgency, not arrival time                                  |

## Interface Requirements

| Interface            | BRD Ref | FSD Ref                | Purpose                                              |
| -------------------- | ------- | ---------------------- | ---------------------------------------------------- |
| Network State API    | BR-001  | FSD-FR-001 to 005      | GeoJSON road network with live depth and passability |
| Simulation API       | BR-002  | FSD-FR-006 to 010      | Rainfall-to-depth simulation and state update        |
| Routing API          | BR-003  | FSD-FR-011 to 017      | Clearance-aware route and travel time                |
| PostgreSQL + PostGIS | BR-001  | FSD-FR-001, FSD-FR-053 | System of record for the road graph and live state   |
| Supabase (hosted)    | BR-011  | FSD-FR-051             | Managed Postgres with row-level security             |
| Browser              | BR-010  | FSD-FR-018 to 049      | Dispatch portal runtime                              |
| GitHub Actions       | BR-008  | FSD-FR-047             | Automated tests, security scan and schema migration  |

## Test Scenarios

| TC ID  | BRD Ref | FSD Ref                            | Expected Result                                                            |
| ------ | ------- | ---------------------------------- | -------------------------------------------------------------------------- |
| TC-001 | BR-001  | FSD-FR-001, FSD-FR-003             | Default network state returns every node and edge with a valid status      |
| TC-002 | BR-001  | FSD-FR-002, FSD-FR-003             | A lower clearance reclassifies edges from `PASSABLE` to `LIGHT_FLOOD`      |
| TC-003 | BR-001  | FSD-FR-005                         | Clearance of 0, 201 or text returns 422                                    |
| TC-004 | BR-002  | FSD-FR-006, FSD-FR-007             | Zero rainfall produces zero runoff and unchanged depth                     |
| TC-005 | BR-002  | FSD-FR-007, FSD-FR-008             | Runoff and depth increase monotonically with rainfall                      |
| TC-006 | BR-002  | FSD-FR-009                         | An overridden edge keeps its depth after a simulation                      |
| TC-007 | BR-003  | FSD-FR-012, FSD-FR-013             | Dry network returns the fastest three-hop corridor                         |
| TC-008 | BR-003  | FSD-FR-014                         | Blocking every path returns 404, not an empty 200                          |
| TC-009 | BR-003  | FSD-FR-015                         | Unknown node returns 404 naming available node ids                         |
| TC-010 | BR-003  | FSD-FR-016                         | Reverse trip returns the mirrored route                                    |
| TC-011 | BR-009  | FSD-FR-018                         | Submitting an empty login field is blocked by native validation            |
| TC-012 | BR-009  | FSD-FR-019                         | Password toggle switches masking and updates the accessible name           |
| TC-013 | BR-004  | FSD-FR-024, FSD-FR-025             | Queue is ordered by descending urgency with all required fields            |
| TC-014 | BR-005  | FSD-FR-026                         | Each filter shows exactly its source count                                 |
| TC-015 | BR-005  | FSD-FR-027, FSD-FR-028             | Search matches partial values; no match shows the empty state              |
| TC-016 | BR-006  | FSD-FR-029, FSD-FR-032, FSD-FR-033 | Selecting an incident replaces the docket and narrative                    |
| TC-017 | BR-007  | FSD-FR-037, FSD-FR-043             | A saved note appears in the log with a timestamp; empty notes are rejected |
| TC-018 | BR-007  | FSD-FR-042, FSD-FR-043             | Dispatch appends an identified log entry and confirms visibly              |
| TC-019 | BR-007  | FSD-FR-030                         | Dismiss de-emphasises the card and decrements the active count             |
| TC-020 | BR-009  | FSD-FR-022                         | Sign out returns to the login screen                                       |
| TC-021 | BR-010  | FSD-FR-050, FSD-FR-051             | Health endpoint responds and every response carries security headers       |

## Acceptance Criteria

| BRD Ref | FSD Ref                            | Acceptance Criteria                                                                     |
| ------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| BR-001  | FSD-FR-001 to 005                  | Every edge carries a status; invalid clearance is rejected; geometry renders            |
| BR-002  | FSD-FR-006 to 010                  | A simulation returns updated depth and status for the whole graph; overrides survive    |
| BR-003  | FSD-FR-011 to 017                  | Every returned segment is below the requested clearance, or the system refuses with 404 |
| BR-004  | FSD-FR-024, FSD-FR-025             | Queue order and counts reflect the underlying data                                      |
| BR-005  | FSD-FR-026 to 028                  | Filter counts match the data; search matches report id, reporter, location              |
| BR-006  | FSD-FR-032 to 038                  | Narrative, photo metadata, location context and sensor readings are visible together    |
| BR-007  | FSD-FR-039 to 046                  | Each action produces a timestamped log entry naming the actor                           |
| BR-008  | FSD-FR-043, FSD-FR-044, FSD-FR-047 | Every override and decision is attributable and immutable                               |
| BR-009  | FSD-FR-018 to 023, FSD-FR-048      | Only authenticated users reach the queue; roles bound what they can do                  |
| BR-010  | FSD-FR-050 to 052                  | Usable on a standard desktop browser at 1366×768 or larger                              |
| BR-011  | FSD-FR-051, FSD-FR-023             | No personal data is exposed to unauthenticated callers                                  |
| BR-012  | FSD-FR-049                         | Report of volumes, triage times, decisions and duplicates                               |

## Requirements Traceability Matrix

| BRD ID | FSD References                                 | Test Cases                     |
| ------ | ---------------------------------------------- | ------------------------------ |
| BR-001 | FSD-FR-001 to 005, FSD-FR-053                  | TC-001, TC-002, TC-003, TC-021 |
| BR-002 | FSD-FR-006 to 010                              | TC-004, TC-005, TC-006         |
| BR-003 | FSD-FR-011 to 017                              | TC-007, TC-008, TC-009, TC-010 |
| BR-004 | FSD-FR-024, FSD-FR-025, FSD-FR-029, FSD-FR-031 | TC-013, TC-016                 |
| BR-005 | FSD-FR-026 to 028                              | TC-014, TC-015                 |
| BR-006 | FSD-FR-032 to 038                              | TC-016                         |
| BR-007 | FSD-FR-030, FSD-FR-037, FSD-FR-039 to 046      | TC-017, TC-018, TC-019         |
| BR-008 | FSD-FR-043, FSD-FR-044, FSD-FR-047             | TC-017, TC-018                 |
| BR-009 | FSD-FR-018 to 023, FSD-FR-048                  | TC-011, TC-012, TC-020         |
| BR-010 | FSD-FR-050 to 052                              | TC-021                         |
| BR-011 | FSD-FR-023, FSD-FR-051                         | TC-021                         |
| BR-012 | FSD-FR-049                                     | — (planned)                    |

## Implementation Status

The pilot is honest about what exists. This table is the authoritative status
statement; the FSD identifiers above remain stable as items move.

| Module                   | FSD IDs           | Status      | Note                                                |
| ------------------------ | ----------------- | ----------- | --------------------------------------------------- |
| Network state            | FSD-FR-001 to 005 | Implemented | Contract-tested                                     |
| Rainfall simulation      | FSD-FR-006 to 010 | Implemented | Contract-tested; overrides respected                |
| Routing                  | FSD-FR-011 to 017 | Implemented | Unit and contract tests                             |
| Portal access            | FSD-FR-018 to 023 | Partial     | Screen and reveal toggle only; no credential check  |
| Incident queue           | FSD-FR-024 to 031 | Partial     | Implemented on mock data; no live refresh           |
| Incident detail          | FSD-FR-032 to 038 | Partial     | Implemented on mock data; evidence files not linked |
| Dispatch actions         | FSD-FR-039 to 046 | Partial     | In-memory log; no persistence or undo               |
| Audit and administration | FSD-FR-047 to 049 | Planned     | Entity exists; no write path                        |
| Operations               | FSD-FR-050 to 053 | Implemented | Health, headers, OpenAPI, idempotent seed           |

## Actors

| ID      | Actor              | Description                            | Access today                      |
| ------- | ------------------ | -------------------------------------- | --------------------------------- |
| ACT-001 | Dispatcher         | Verifies reports and commits resources | Portal, no authentication         |
| ACT-002 | MDRRMC commander   | Oversees operations across barangays   | Not distinguished from dispatcher |
| ACT-003 | Field responder    | Consumes route guidance                | None (future client)              |
| ACT-004 | Citizen reporter   | Submits reports                        | None (future intake channel)      |
| ACT-005 | Administrator      | Manages users and configuration        | None (future)                     |
| ACT-006 | Integration client | Calls the API programmatically         | Open API, no key                  |

## Use Cases

### UC-001 — View current network state

Actor: dispatcher or integration client. Precondition: graph seeded. Postcondition:
network rendered with passability per edge.

1. Actor requests network state with an optional clearance.
2. System validates the clearance.
3. System loads nodes, edges and live state.
4. System classifies each edge against the clearance.
5. System returns GeoJSON collections and a generation timestamp.

Alternate: clearance outside 0–200 returns 422. Requirements: FSD-FR-001 to 005.

### UC-002 — Simulate a rainfall event

Actor: dispatcher. Postcondition: live state reflects simulated depth.

1. Actor submits rainfall intensity and clearance.
2. System validates both parameters.
3. System computes runoff, then ponding depth per edge.
4. System updates non-overridden live state and degrades speeds.
5. System returns the updated network with simulation metadata.

Alternates: intensity above 250 returns 422; an overridden edge is skipped.
Requirements: FSD-FR-006 to 010.

### UC-003 — Request a safe route

Actor: dispatcher, future driver client. Postcondition: a passable route or an
explicit refusal.

1. Actor supplies origin, destination and clearance.
2. System validates the nodes exist.
3. System searches for the fastest path avoiding edges at or above clearance.
4. System assembles route geometry in the direction of travel.
5. System returns path, segments, geometry and estimated time.

Alternates: unknown node returns 404 with available ids; no surviving path
returns 404 with an explanatory message. Requirements: FSD-FR-011 to 017.

### UC-004 — Sign in to the portal

Actor: dispatcher. Postcondition: dashboard visible.

1. System presents the login screen with the pilot credentials prefilled.
2. Actor submits the form.
3. System shows a confirmation and reveals the dashboard after a short delay.

Current limitation: credentials are not verified. Requirements: FSD-FR-018 to 023.

### UC-005 — Triage an incident

Actor: dispatcher. Postcondition: incident verified or dismissed with a recorded
action.

1. System lists incidents by urgency with counts per source.
2. Actor narrows the queue by source or search.
3. Actor selects an incident.
4. System displays docket, narrative, evidence, location context and log.
5. Actor reads the evidence and optionally adds an internal note.
6. Actor chooses reject, escalate, hold or dispatch.
7. System records the action with time and actor, and confirms visibly.

Alternates: no match shows the empty state; an empty note is not submitted.
Requirements: FSD-FR-024 to 046.

### UC-006 — Sign out

Actor: dispatcher. Postcondition: login screen, dashboard state cleared.
Requirements: FSD-FR-022.

## Out of Scope for This Release

- Credential verification and session management (FSD-FR-021 to 023).
- Incident intake from citizens or field units (FSD-FR-031, FSD-FR-044, FSD-FR-046).
- Native driver application and turn-by-turn guidance.
- Live sensor, CCTV and weather ingestion.
- Map rendering inside the portal; the API already returns GeoJSON.
- Administrative screens (FSD-FR-048) and exports (FSD-FR-049).
- Multi-tenant operation.
