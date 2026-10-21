# Functional Specification Document — MetroFlow

| Field             | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Document ID       | MF-FSD-001                                           |
| Version           | 1.0 (Draft)                                          |
| Status            | For academic review                                  |
| Date              | 21 October 2026                                      |
| Prepared by       | «Project Team»                                       |
| Reviewed by       | «Project Adviser»                                    |
| Approved by       | «Project Sponsor»                                    |
| Related documents | [BRD.md](BRD.md), [TSD.md](TSD.md), [api.md](api.md) |

## Revision history

| Version | Date        | Author         | Change                           |
| ------- | ----------- | -------------- | -------------------------------- |
| 1.0     | 21 Oct 2026 | «Project Team» | Initial functional specification |

## 1. Purpose and scope

This document specifies **observable system behaviour**: what each actor can do,
what the system does in response, and how each requirement is verified. It
bridges the business requirements in [BRD.md](BRD.md) and the implementation in
[TSD.md](TSD.md).

Coverage: the flood simulation and routing API, the LGU dispatch portal, and the
supporting operational behaviour (health, security headers, audit).

Not covered: internal algorithms and data structures (TSD §5–§6), business
justification (BRD, business case), or project execution (PMP).

### 1.1 Requirement status vocabulary

Every functional requirement carries a status so this document doubles as an
implementation statement.

| Status          | Meaning                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| **Implemented** | Behaviour exists in `main` and is covered by a test or a verified demonstration |
| **Partial**     | Some behaviour exists; a named part is missing                                  |
| **Planned**     | Specified but not built; not part of the pilot's acceptance boundary            |

### 1.2 Requirement priority

MoSCoW, inherited from the BRD: `Must` items define the pilot's acceptance
boundary; `Should` and `Could` items are accepted only if delivered.

## 2. System overview

MetroFlow has three cooperating parts:

| Part                       | Responsibility                                                    | Current state                              |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| Simulation and routing API | Holds the road graph, computes flood depth, answers route queries | Operational                                |
| Dispatch portal            | Presents network state, a triage queue, evidence and actions      | Operational on mock incident data          |
| Data platform              | PostGIS schema, versioned migrations, access control              | Operational locally and on hosted Postgres |

```
                    rainfall input                      incident reports
                          │                                    │
                          ▼                                    ▼
              ┌───────────────────────┐            ┌───────────────────────┐
              │  Simulation engine    │            │  Dispatch portal      │
              │  SCS-CN → depth       │◄───────────│  queue · detail · log │
              │  TD-A*  → route       │  network   │  (mock data today)    │
              └───────────┬───────────┘  + routes  └───────────┬───────────┘
                          │                                    │
                          ▼                                    ▼
              ┌─────────────────────────────────────────────────────────┐
              │  PostgreSQL + PostGIS  (nodes · edges · live state)      │
              │  versioned by Alembic · row-level security on hosted DB  │
              └─────────────────────────────────────────────────────────┘
```

### 2.1 Context boundary

| In the system                        | Outside the system              |
| ------------------------------------ | ------------------------------- |
| Road graph and live edge state       | Actual road network survey data |
| Rainfall → runoff → ponding model    | Weather service feeds           |
| Route computation                    | Vehicle telematics              |
| Triage queue and decision log (mock) | Citizen reporting channel       |
| Portal screens                       | Identity provider               |

## 3. Actors

| ID     | Actor                    | Description                            | Access today                      |
| ------ | ------------------------ | -------------------------------------- | --------------------------------- |
| ACT-01 | Dispatcher               | Verifies reports and commits resources | Portal, no authentication         |
| ACT-02 | MDRRMC commander         | Oversees operations across barangays   | Not distinguished from dispatcher |
| ACT-03 | Field responder / driver | Consumes route guidance                | None (future client)              |
| ACT-04 | Citizen reporter         | Submits reports                        | None (future intake channel)      |
| ACT-05 | Administrator            | Manages users and configuration        | None (future)                     |
| ACT-06 | Integration client       | Calls the API programmatically         | Open API, no key                  |

ACT-01 and ACT-02 are the pilot's real users. ACT-03 to ACT-05 are named so the
specification is complete, but they have no acceptance criteria in this release.

## 4. Operating assumptions

| ID    | Assumption                                                                        |
| ----- | --------------------------------------------------------------------------------- |
| OA-01 | The portal is used at an operations desk, 1366×768 or larger, on a modern browser |
| OA-02 | The API and database are reachable over the network during an event               |
| OA-03 | Rainfall intensity is entered manually or supplied by an operator                 |
| OA-04 | Incident reports presented by the portal are mock records for the pilot           |
| OA-05 | Times displayed to users are Asia/Manila (UTC+8)                                  |

## 5. Functional requirements

### 5.1 Module A — Network state

| ID    | Requirement                                                                                                                                         | Priority | Status      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-01 | The system shall return every road node and edge as GeoJSON `FeatureCollection`s with properties for map rendering                                  | Must     | Implemented |
| FR-02 | The system shall accept a vehicle clearance in centimetres, defaulting to 30 cm, and reject values outside the range greater than 0 and at most 200 | Must     | Implemented |
| FR-03 | The system shall classify each edge as `PASSABLE`, `LIGHT_FLOOD` or `SUBMERGED` from live water depth and the requested clearance                   | Must     | Implemented |
| FR-04 | The system shall return stored PostGIS geometry when present and fall back to a straight line between the edge's endpoints otherwise                | Should   | Implemented |
| FR-05 | The system shall reject invalid query parameters with HTTP 422 and a field-level explanation                                                        | Should   | Implemented |

**Acceptance criteria**

- FR-01: response contains `edges.features[]` and `nodes.features[]`; each edge
  feature has `id`, `geometry.type = "LineString"`, and the properties listed in
  [api.md](api.md) §2.2.
- FR-03: for `water_depth_cm >= clearance_cm` the status is `SUBMERGED`; for
  `water_depth_cm >= caution_depth_cm` and below clearance it is `LIGHT_FLOOD`;
  otherwise `PASSABLE`. The boundary is inclusive on both thresholds.
- FR-05: `clearance_cm=0`, `201` and `abc` each return 422.

### 5.2 Module B — Rainfall simulation

| ID    | Requirement                                                                                                                      | Priority | Status      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-06 | The system shall accept a rainfall intensity in mm/hr from 0 to 250 and a vehicle clearance                                      | Must     | Implemented |
| FR-07 | The system shall compute direct surface runoff for the storm using the SCS Curve Number method                                   | Must     | Implemented |
| FR-08 | The system shall convert runoff into street ponding depth, weighted by the elevation of the edge's upstream node                 | Must     | Implemented |
| FR-09 | The system shall persist the resulting depth and degraded average speed per edge, leaving manually overridden edges untouched    | Must     | Implemented |
| FR-10 | The system shall return the updated network together with rainfall, runoff and the number of affected edges in a single response | Should   | Implemented |

**Acceptance criteria**

- FR-06: `rainfall_mm_hr=251` returns 422; `0` returns a valid response with
  zero runoff.
- FR-07: runoff is 0 when rainfall is 0 and increases monotonically with
  rainfall for a fixed curve number.
- FR-09: a second identical simulation produces the same depths, confirming the
  update is a function of the input rather than accumulated state.
- FR-10: the response contains both the network collections and
  `rainfall_mm_hr`, `runoff_mm`, `affected_edges`, `message`.

### 5.3 Module C — Routing

| ID    | Requirement                                                                                                                    | Priority | Status      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------- |
| FR-11 | The system shall accept an origin node, a destination node and a vehicle clearance                                             | Must     | Implemented |
| FR-12 | The system shall compute the fastest route that avoids every edge whose water depth is at or above the clearance               | Must     | Implemented |
| FR-13 | The system shall return the ordered node path, a GeoJSON `LineString`, per-segment status and estimated travel time in minutes | Must     | Implemented |
| FR-14 | The system shall return HTTP 404 with an explanatory message when no safe route exists                                         | Must     | Implemented |
| FR-15 | The system shall return HTTP 404 naming the available node ids when a requested node does not exist                            | Should   | Implemented |
| FR-16 | The system shall treat roads as bidirectional                                                                                  | Should   | Implemented |
| FR-17 | The system shall allow a route whose origin equals its destination, returning a degenerate but valid line                      | Could    | Implemented |

**Acceptance criteria**

- FR-12: every segment in the response has `status != "SUBMERGED"` for the
  requested clearance.
- FR-13: `optimal_path_nodes` starts at the origin and ends at the destination;
  `segments[]` matches the traversed hops; `estimated_travel_time_minutes > 0`
  unless origin equals destination.
- FR-14: raising water depth above clearance on every available path produces
  404, not an empty 200.

### 5.4 Module D — Portal access

| ID    | Requirement                                                                                  | Priority | Status                                   |
| ----- | -------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| FR-18 | The portal shall present a login screen with username and password fields, both required     | Must     | Implemented                              |
| FR-19 | The portal shall allow the user to reveal and hide the password                              | Should   | Implemented                              |
| FR-20 | The portal shall offer a forgot-password affordance that states how to obtain a reset        | Could    | Implemented                              |
| FR-21 | The portal shall authenticate credentials against the backend and reject invalid credentials | Must     | Planned                                  |
| FR-22 | The portal shall maintain a session and end it on sign-out                                   | Must     | Partial — screen switch only, no session |
| FR-23 | The portal shall restrict screens and actions by role                                        | Should   | Planned                                  |

**Acceptance criteria**

- FR-18: submitting with an empty field is blocked by the browser's required-field
  validation; the form does not navigate.
- FR-19: toggling changes the input type between `password` and `text` and updates
  the accessible name of the control.
- FR-22 (current): sign-out returns to the login screen and clears in-memory state.
- FR-21/FR-23: to be specified when the identity decision is made. Until then
  the portal is a presentation-layer gate only, and the BRD records this as BR-09.

### 5.5 Module E — Incident queue

| ID    | Requirement                                                                                               | Priority | Status      |
| ----- | --------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-24 | The queue shall list incidents ordered by descending urgency score                                        | Must     | Implemented |
| FR-25 | Each queue item shall show report id, urgency, location, reporter, age and evidence tags                  | Must     | Implemented |
| FR-26 | The queue shall filter by source: all, photo, sensor mismatch, escalated, with counts per filter          | Must     | Implemented |
| FR-27 | The queue shall search by report id, reporter, location or barangay                                       | Should   | Implemented |
| FR-28 | The queue shall show an explicit empty state when no incident matches                                     | Should   | Implemented |
| FR-29 | Selecting an incident shall load it into the detail panel and mark it as selected                         | Must     | Implemented |
| FR-30 | Dismissing an incident shall remove it from the active count and mark it as dismissed without deleting it | Must     | Implemented |
| FR-31 | The queue shall refresh when new reports arrive                                                           | Should   | Planned     |

**Acceptance criteria**

- FR-26: counts equal the number of records per source; selecting a filter shows
  exactly that many items.
- FR-27: search is case-insensitive and matches partial values; a search with no
  matches shows the empty state.
- FR-30: the dismissed item remains visible but visually de-emphasised, and the
  pending-verification count decreases by one.

### 5.6 Module F — Incident detail

| ID    | Requirement                                                                                                        | Priority | Status      |
| ----- | ------------------------------------------------------------------------------------------------------------------ | -------- | ----------- |
| FR-32 | The detail panel shall show the docket: report id, severity level, reporter, filing time and confidence score      | Must     | Implemented |
| FR-33 | The detail panel shall show the witness narrative                                                                  | Must     | Implemented |
| FR-34 | The detail panel shall show photo evidence with capture metadata and an estimated submersion range                 | Should   | Implemented |
| FR-35 | The detail panel shall show location and sensor context, including nearest rescue unit and rising-water indicators | Should   | Implemented |
| FR-36 | The detail panel shall show the incident's operations log in chronological order and scroll to the newest entry    | Must     | Implemented |
| FR-37 | The user shall be able to add an internal note to the operations log                                               | Must     | Implemented |
| FR-38 | The user shall be able to open the original evidence file                                                          | Could    | Planned     |

**Acceptance criteria**

- FR-32/33: the displayed id and narrative change when a different queue item is
  selected.
- FR-36: entries render with a time and text; the log scrolls to the latest entry
  after a new note or action.
- FR-37: an empty note is rejected; a saved note appears immediately and the
  composer closes.

### 5.7 Module G — Dispatch actions

| ID    | Requirement                                                                                                        | Priority | Status      |
| ----- | ------------------------------------------------------------------------------------------------------------------ | -------- | ----------- |
| FR-39 | The user shall be able to reject an incident as a false alarm                                                      | Must     | Implemented |
| FR-40 | The user shall be able to escalate an incident to BFP or the Coast Guard                                           | Must     | Implemented |
| FR-41 | The user shall be able to hold an incident pending a sensor update                                                 | Must     | Implemented |
| FR-42 | The user shall be able to approve the incident and dispatch the assigned rescue unit                               | Must     | Implemented |
| FR-43 | Every action shall append a timestamped entry naming the actor to the operations log                               | Must     | Implemented |
| FR-44 | Every action shall be persisted to the backend with a required reason                                              | Must     | Planned     |
| FR-45 | Dispatching shall require confirmation and offer a short undo window                                               | Should   | Planned     |
| FR-46 | The action set shall be constrained by incident state (for example, a dispatched incident cannot be re-dispatched) | Should   | Planned     |

### 5.8 Module H — Audit and administration

| ID    | Requirement                                                                                                | Priority | Status                                 |
| ----- | ---------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| FR-47 | The system shall record overrides and dispatch decisions with actor, payload, timestamp and integrity hash | Must     | Partial — entity exists, no write path |
| FR-48 | An administrator shall manage users and roles                                                              | Should   | Planned                                |
| FR-49 | The user shall be able to export incident and audit records for post-event review                          | Could    | Planned                                |

### 5.9 Module I — Operations

| ID    | Requirement                                                                                    | Priority | Status      |
| ----- | ---------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-50 | The system shall expose a health endpoint reporting service identity and status                | Must     | Implemented |
| FR-51 | Every API response shall carry baseline security headers                                       | Must     | Implemented |
| FR-52 | The system shall expose its machine-readable contract at `/openapi.json`                       | Should   | Implemented |
| FR-53 | The system shall seed a demonstration corridor on first boot without duplicating it on restart | Should   | Implemented |

## 6. Use cases

### UC-01 — View current network state

| Field         | Value                                        |
| ------------- | -------------------------------------------- |
| Actor         | Dispatcher, integration client               |
| Trigger       | Operator opens the map or a client refreshes |
| Precondition  | Road graph seeded; live state rows exist     |
| Postcondition | Network rendered with passability per edge   |

**Main flow**

1. Actor requests network state with an optional clearance.
2. System validates the clearance.
3. System loads nodes, edges and live state.
4. System classifies each edge against the clearance.
5. System returns GeoJSON collections and a generation timestamp.

**Alternate flows**

- 2a. Clearance outside 0–200 → 422 with field detail.

**Related requirements:** FR-01–FR-05.

### UC-02 — Simulate a rainfall event

| Field         | Value                                                 |
| ------------- | ----------------------------------------------------- |
| Actor         | Dispatcher                                            |
| Trigger       | Operator enters an intensity to test a scenario       |
| Precondition  | Graph seeded                                          |
| Postcondition | Live state reflects simulated depth; UI can render it |

**Main flow**

1. Actor submits rainfall intensity and clearance.
2. System validates both parameters.
3. System computes runoff for the storm.
4. System computes ponding depth per edge from upstream elevation.
5. System updates non-overridden live state and degrades speeds.
6. System returns the updated network with simulation metadata.

**Alternate flows**

- 2a. Intensity above 250 mm/hr → 422.
- 5a. An edge is manually overridden → depth is left unchanged and the edge is
  not counted as affected.

**Related requirements:** FR-06–FR-10.

### UC-03 — Request a safe route

| Field         | Value                                   |
| ------------- | --------------------------------------- |
| Actor         | Dispatcher, future driver client        |
| Trigger       | A unit must reach an incident           |
| Precondition  | Graph and live state available          |
| Postcondition | A passable route or an explicit refusal |

**Main flow**

1. Actor supplies origin, destination and clearance.
2. System validates the nodes exist.
3. System searches for the fastest path avoiding edges at or above clearance.
4. System assembles the route geometry in the direction of travel.
5. System returns path, segments, geometry and estimated time.

**Alternate flows**

- 2a. Unknown node → 404 listing available nodes.
- 3a. No path survives the clearance check → 404 with an explanatory message.

**Related requirements:** FR-11–FR-17.

### UC-04 — Sign in to the portal

| Field         | Value                     |
| ------------- | ------------------------- |
| Actor         | Dispatcher                |
| Trigger       | Operator opens the portal |
| Precondition  | None                      |
| Postcondition | Dashboard visible         |

**Main flow**

1. System presents the login screen with the username prefilled for the pilot.
2. Actor submits credentials.
3. System confirms the session visually and shows the dashboard.

**Current limitation:** step 3 does not verify credentials. The real flow is
specified by FR-21 and is a post-pilot increment.

**Related requirements:** FR-18–FR-23.

### UC-05 — Triage an incident

| Field         | Value                                                 |
| ------------- | ----------------------------------------------------- |
| Actor         | Dispatcher                                            |
| Trigger       | A report appears in the queue                         |
| Precondition  | Dashboard loaded                                      |
| Postcondition | Incident verified or dismissed with a recorded action |

**Main flow**

1. System lists incidents by urgency with counts per source.
2. Actor narrows the queue by source or search.
3. Actor selects an incident.
4. System displays docket, narrative, evidence, location context and log.
5. Actor reads the evidence and optionally adds an internal note.
6. Actor chooses reject, escalate, hold or dispatch.
7. System records the action with time and actor, and confirms visibly.

**Alternate flows**

- 2a. No match → empty state; filters remain usable.
- 3a. Actor dismisses instead of investigating → item de-emphasised, count drops.
- 6a. Note is empty → composer does not submit.

**Related requirements:** FR-24–FR-46.

### UC-06 — Sign out

| Field         | Value                                 |
| ------------- | ------------------------------------- |
| Actor         | Dispatcher                            |
| Trigger       | Shift handover                        |
| Postcondition | Login screen; dashboard state cleared |

**Main flow:** actor selects sign out; system returns to login and confirms.

**Related requirements:** FR-22.

## 7. Screen specifications

### 7.1 Login screen

| Element            | Behaviour                                                                           |
| ------------------ | ----------------------------------------------------------------------------------- |
| Operational header | Static status: operational grid, node id, encryption badge, version                 |
| Username field     | Required; prefilled for the pilot; text input                                       |
| Password field     | Required; masked; reveal/hide toggle with accessible label                          |
| Forgot password    | Shows guidance to contact the system administrator; no navigation                   |
| Remember me        | Checkbox, checked by default; not persisted (no session yet)                        |
| Login button       | Submits; shows a confirmation toast, then reveals the dashboard after a short delay |
| Footer             | Support contact and service description                                             |

**States:** default, validation error (browser-native), submitting (no explicit
spinner in the pilot).

### 7.2 Dashboard — layout regions

| Region       | Content                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Sidebar      | Brand, alert level, six navigation items with the active item marked, unit block, sign out                                     |
| Header       | Breadcrumb, sector status, weather advisory, active SOS count, operator identity                                               |
| KPI row      | Pending verification (live count), verified today, average triage speed, duplicate filter accuracy                             |
| Queue panel  | Title and count, sort label, filter tabs, search, scrollable incident list, empty state                                        |
| Detail panel | Docket header and confidence score, narrative, evidence and location cards, operations log, note composer, four action buttons |
| Toast        | Transient confirmation of the last action; auto-dismisses                                                                      |

### 7.3 Interaction specification

| Interaction                        | Expected result                                                  |
| ---------------------------------- | ---------------------------------------------------------------- |
| Filter tab selected                | `aria-pressed` set on the active tab; list and count update      |
| Search typed                       | List filters on each keystroke; empty state when nothing matches |
| Incident clicked                   | Detail panel replaces content; selected item highlighted         |
| Dismiss clicked                    | Card de-emphasised; active count decremented; confirmation toast |
| Action clicked                     | Log entry appended with actor and time; confirmation toast       |
| Note submitted                     | Log entry appended; composer closes and clears                   |
| Navigation item clicked (inactive) | Informational toast that the screen is outside the pilot         |
| Sign out                           | Returns to login                                                 |

### 7.4 Error and empty states

| Condition                 | Presentation                                                                     |
| ------------------------- | -------------------------------------------------------------------------------- |
| No incidents match        | "No incidents match this filter." inside the queue                               |
| No log entries            | "No entries yet for this incident." inside the log                               |
| Empty note                | Composer does not submit                                                         |
| API unavailable (planned) | To be specified with FR-21: inline error with retry, never a silent empty screen |

## 8. Data requirements

### 8.1 Core entities used by the pilot

| Entity          | Purpose                                         | Specified in          |
| --------------- | ----------------------------------------------- | --------------------- |
| Road node       | Intersection with coordinates and elevation     | [TSD.md](TSD.md) §7.2 |
| Road edge       | Segment with distance, speed limit and geometry | TSD §7.3              |
| Live edge state | Current depth, speed, override flag             | TSD §7.4              |
| User            | Account and role                                | TSD §7.1              |
| Audit log       | Decision and override trail                     | TSD §7.5              |

### 8.2 Incident record (portal, mock)

| Field                  | Type         | Rule                                                     |
| ---------------------- | ------------ | -------------------------------------------------------- |
| `id`                   | String       | Unique report identifier, format `FR-nnnn`               |
| `level`                | String       | Severity label shown in the docket                       |
| `urgency`              | Number 0–10  | One decimal; determines queue order and badge colour     |
| `reporter`             | String       | Name plus identifier, or the originating sensor/feed     |
| `reportedAt`           | String       | Display timestamp with elapsed time                      |
| `aiConfidence`         | String       | Percentage with a qualifier (`Authentic`, `Verified`, …) |
| `narrative`            | String       | Free text from the reporter                              |
| `location`, `barangay` | String       | Display address and search keys                          |
| `source`               | Enum         | `photo`, `sensor`, `escalated`                           |
| `tags`                 | String array | Evidence or hazard labels                                |

Incident records are illustrative and live in the portal source, not in the
database, until the intake channel exists.

### 8.3 Retention

| Data                       | Retention                      | Basis                                           |
| -------------------------- | ------------------------------ | ----------------------------------------------- |
| Incident and audit records | [TBC]                          | Client policy                                   |
| Reporter personal data     | [TBC]                          | Data Privacy Act; minimise and purge per policy |
| Simulation snapshots       | Not retained — live state only | Pilot limitation                                |

## 9. External interfaces

### 9.1 API surface

| Method | Path                       | Purpose                                            |
| ------ | -------------------------- | -------------------------------------------------- |
| GET    | `/`                        | Health and identity                                |
| GET    | `/api/v1/network/state`    | Renderable network with passability                |
| POST   | `/api/v1/simulation/rain`  | Run rainfall simulation and return updated network |
| GET    | `/api/v1/routing/navigate` | Clearance-aware route                              |

Full contracts, parameters and examples: [api.md](api.md).

### 9.2 Supporting systems

| System               | Interface                       | Failure behaviour                                   |
| -------------------- | ------------------------------- | --------------------------------------------------- |
| PostgreSQL + PostGIS | SQLAlchemy connection           | Startup fails if unreachable; no silent degradation |
| Supabase (hosted)    | Same Postgres protocol over TLS | Migrations gated in CI; API not yet hosted          |
| Browser              | HTTP/JSON                       | Portal shows stale data today; error state planned  |
| GitHub Actions       | Repository events               | Gates block merge; no runtime dependency            |

## 10. Non-functional requirements

| ID     | Category        | Requirement                                                                 | Measure                   | Status                   |
| ------ | --------------- | --------------------------------------------------------------------------- | ------------------------- | ------------------------ |
| NFR-01 | Performance     | Network state responds within 500 ms at p95 for the pilot graph             | Load test, 500 edges      | Target                   |
| NFR-02 | Performance     | Route request responds within 200 ms at p95                                 | Load test, 1 000 requests | Target                   |
| NFR-03 | Availability    | API available 99% of the time during a declared event                       | Health-check history      | Target                   |
| NFR-04 | Security        | No High or Medium findings in the OWASP ZAP API scan                        | ZAP workflow              | Met                      |
| NFR-05 | Security        | No secrets in the repository; runtime configuration via environment         | Secret scan, review       | Met                      |
| NFR-06 | Security        | Public database roles cannot read or write application tables               | RLS test                  | Met                      |
| NFR-07 | Privacy         | Reporter personal data is not exposed to unauthenticated callers            | Access review             | Partial — no auth on API |
| NFR-08 | Usability       | A dispatcher completes a triage decision in three interactions or fewer     | Observed usability test   | Target                   |
| NFR-09 | Usability       | System Usability Scale score of at least 75                                 | Post-test questionnaire   | Target                   |
| NFR-10 | Compatibility   | Usable in current Chrome, Edge and Firefox at 1366×768 and above            | Cross-browser check       | Met                      |
| NFR-11 | Accessibility   | Keyboard reachable controls and visible focus; AA contrast on text          | Manual audit              | Partial                  |
| NFR-12 | Maintainability | Schema changes only through migrations; no drift between models and history | `alembic check` in CI     | Met                      |
| NFR-13 | Portability     | The API runs from a container with configuration supplied by environment    | `docker compose up`       | Met                      |
| NFR-14 | Auditability    | Every override and decision is attributable to an actor and timestamp       | Log review                | Partial — UI only        |
| NFR-15 | Scalability     | API instances can be added horizontally behind a load balancer              | Architecture review       | Target                   |
| NFR-16 | Recoverability  | Recovery point and time objectives defined and tested                       | DR exercise               | [TBC]                    |
| NFR-17 | Localisation    | Times in PHT, distances in metres/kilometres, depths in centimetres         | UI review                 | Met                      |

## 11. Business rules

| ID       | Rule                                                                 | Enforced in                                   |
| -------- | -------------------------------------------------------------------- | --------------------------------------------- |
| BRULE-01 | Water at or above clearance means impassable                         | Routing engine, status classification         |
| BRULE-02 | Water at or above the caution threshold is a warning, still passable | Status classification                         |
| BRULE-03 | Every decision records actor, timestamp and action                   | Portal log (today), audit log (planned)       |
| BRULE-04 | Manual override outranks simulation until cleared                    | Simulation skips overridden edges             |
| BRULE-05 | Dismissal is recorded, never silent deletion                         | Portal dismissal state (today), API (planned) |
| BRULE-06 | Personal data visible only to authorised roles                       | RLS (today), authentication (planned)         |
| BRULE-07 | Queue priority is urgency, not arrival                               | Queue ordering                                |

Rules are defined once in [BRD.md](BRD.md) §8 and enforced at the layers above.

## 12. Traceability

| Business requirement | Functional requirements | Verified by                                        |
| -------------------- | ----------------------- | -------------------------------------------------- |
| BR-01                | FR-01–FR-05             | API contract tests; demonstration                  |
| BR-02                | FR-06–FR-10             | API contract tests; monotonicity unit test         |
| BR-03                | FR-11–FR-17             | Routing unit tests; contract tests; 404 path test  |
| BR-04                | FR-24, FR-25            | Portal demonstration; queue count assertion        |
| BR-05                | FR-26–FR-28             | Portal demonstration; filter and search assertions |
| BR-06                | FR-32–FR-36             | Portal demonstration                               |
| BR-07                | FR-39–FR-43             | Portal demonstration; log assertion                |
| BR-08                | FR-47                   | Schema review; write path pending                  |
| BR-09                | FR-21–FR-23             | Not verified — planned                             |
| BR-10                | NFR-10                  | Cross-browser check                                |
| BR-11                | NFR-06, NFR-07          | RLS test; access review                            |
| BR-12                | FR-49                   | Not verified — planned                             |

## 13. Out of scope for this release

- Credential verification and session management (FR-21, FR-22, FR-23).
- Incident intake from citizens or field units (FR-31, FR-44, FR-46).
- Native driver application and turn-by-turn guidance.
- Live sensor, CCTV and weather ingestion.
- Map rendering inside the portal; the API already returns GeoJSON.
- Administrative screens (FR-48) and exports (FR-49).
- Multi-tenant operation.

## 14. Acceptance

The pilot is accepted when:

1. Every `Must` functional requirement marked Implemented behaves as specified
   under §5 and §6.
2. The items marked Partial are documented as limitations in the final report.
3. NFR-04, NFR-05, NFR-06, NFR-12 and NFR-13 hold on `main`.
4. The demonstration in charter deliverable D-06 completes without a manual
   workaround that is not documented.

| Role                  | Name                    | Signature | Date  |
| --------------------- | ----------------------- | --------- | ----- |
| Project Adviser       | «Project Adviser»       |           | [TBC] |
| Client Representative | «Client Representative» |           | [TBC] |
| Project Team Lead     | «Project Team Lead»     |           | [TBC] |
