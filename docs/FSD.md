# FUNCTIONAL SPECIFICATION DOCUMENT (FSD)

## MetroFlow — Intelligent Urban Mobility and Flood Simulation System

Version 1.2

## Document Control

| Field       | Value                                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| Project     | MetroFlow                                                                      |
| Prepared By | «Project Team»                                                                 |
| Version     | 1.2                                                                            |
| Status      | For Review — CR-001 approved 27 October 2026                                   |
| Change      | CR-001 extends the FSD to the driver app, live map, fleet dispatch and sensors |

Version 1.2 records the provider configuration, API-issued session tokens, Mapbox
tiles and template-sourced UI under [CR-001](CR-001.md). It adds `TC-045` and `TC-046` for
provider fallback. Existing identifiers are unchanged.

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
| BR-013 | Give drivers flood-aware navigation and automatic rerouting            |
| BR-014 | Accept structured field reports with photo and depth evidence          |
| BR-015 | Let a driver request emergency rescue with an exact location           |
| BR-016 | Give dispatchers a live map, fleet visibility and flood-safe dispatch  |
| BR-017 | Ingest river and rain gauge readings and flag impacted roads           |
| BR-018 | Keep navigation, hazards and reporting usable offline                  |

## Functional Requirements

| FSD ID     | BRD Reference  | Functional Specification                                                                                      |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| FSD-FR-001 | BR-001         | Return every road node and edge as GeoJSON `FeatureCollection`s with live depth and passability               |
| FSD-FR-002 | BR-001         | Accept a vehicle clearance in centimetres, defaulting to 30 cm                                                |
| FSD-FR-003 | BR-001         | Classify each edge as `PASSABLE`, `LIGHT_FLOOD` or `SUBMERGED` from live depth and the requested clearance    |
| FSD-FR-004 | BR-001         | Return stored PostGIS geometry when present and a straight line between endpoints otherwise                   |
| FSD-FR-005 | BR-001         | Reject clearance outside the range greater than 0 and at most 200 with HTTP 422                               |
| FSD-FR-006 | BR-002         | Accept a rainfall intensity from 0 to 250 mm/hr and a vehicle clearance                                       |
| FSD-FR-007 | BR-002         | Compute direct surface runoff for the storm using the SCS Curve Number method                                 |
| FSD-FR-008 | BR-002         | Convert runoff into street ponding depth, weighted by the elevation of the edge's upstream node               |
| FSD-FR-009 | BR-002         | Persist the resulting depth and degraded average speed per edge, leaving manually overridden edges untouched  |
| FSD-FR-010 | BR-002         | Return the updated network together with rainfall, runoff and the number of affected edges in one response    |
| FSD-FR-011 | BR-003         | Accept an origin node, a destination node and a vehicle clearance                                             |
| FSD-FR-012 | BR-003         | Compute the fastest route that avoids every edge whose water depth is at or above the clearance               |
| FSD-FR-013 | BR-003         | Return the ordered node path, a GeoJSON `LineString`, per-segment status and estimated travel time in minutes |
| FSD-FR-014 | BR-003         | Return HTTP 404 with an explanatory message when no safe route exists                                         |
| FSD-FR-015 | BR-003         | Return HTTP 404 naming the available node ids when a requested node does not exist                            |
| FSD-FR-016 | BR-003         | Treat roads as bidirectional                                                                                  |
| FSD-FR-017 | BR-003         | Allow a route whose origin equals its destination, returning a degenerate but valid line                      |
| FSD-FR-018 | BR-009         | Present a login screen with email and password fields, both required                                          |
| FSD-FR-019 | BR-009         | Allow the user to reveal and hide the password                                                                |
| FSD-FR-020 | BR-009         | Offer a forgot-password affordance that states how to obtain a reset                                          |
| FSD-FR-021 | BR-009         | Authenticate against `POST /api/v1/auth/login` and reject invalid credentials                                 |
| FSD-FR-022 | BR-009         | Maintain a session and end it on sign-out                                                                     |
| FSD-FR-023 | BR-009         | Restrict screens and actions by role                                                                          |
| FSD-FR-024 | BR-004         | List incidents ordered by descending urgency score                                                            |
| FSD-FR-025 | BR-004         | Show report id, urgency, location, reporter, age and evidence tags for each queue item                        |
| FSD-FR-026 | BR-005         | Filter by source: all, photo, sensor mismatch, escalated, with counts per filter                              |
| FSD-FR-027 | BR-005         | Search by report id, reporter, location or barangay                                                           |
| FSD-FR-028 | BR-005         | Show an explicit empty state when no incident matches                                                         |
| FSD-FR-029 | BR-004         | Load the selected incident into the detail panel and mark it as selected                                      |
| FSD-FR-030 | BR-007         | Remove a dismissed incident from the active count without deleting it                                         |
| FSD-FR-031 | BR-004         | Refresh the queue when new reports arrive                                                                     |
| FSD-FR-032 | BR-006         | Show the docket: report id, severity level, reporter, filing time and confidence score                        |
| FSD-FR-033 | BR-006         | Show the witness narrative                                                                                    |
| FSD-FR-034 | BR-006         | Show photo evidence with capture metadata and an estimated submersion range                                   |
| FSD-FR-035 | BR-006         | Show location and sensor context, including nearest rescue unit and rising-water indicators                   |
| FSD-FR-036 | BR-006         | Show the incident's operations log in chronological order and scroll to the newest entry                      |
| FSD-FR-037 | BR-007         | Allow the user to add an internal note to the operations log                                                  |
| FSD-FR-038 | BR-006         | Allow the user to open the original evidence file                                                             |
| FSD-FR-039 | BR-007         | Allow the user to reject an incident as a false alarm                                                         |
| FSD-FR-040 | BR-007         | Allow the user to escalate an incident to BFP or the Coast Guard                                              |
| FSD-FR-041 | BR-007         | Allow the user to hold an incident pending a sensor update                                                    |
| FSD-FR-042 | BR-007         | Allow the user to approve the incident and dispatch the assigned rescue unit                                  |
| FSD-FR-043 | BR-008         | Append a timestamped entry naming the actor to the operations log for every action                            |
| FSD-FR-044 | BR-008         | Persist every action to the backend with a required reason                                                    |
| FSD-FR-045 | BR-007         | Require confirmation before dispatch and offer a short undo window                                            |
| FSD-FR-046 | BR-007         | Constrain the action set by incident state (a dispatched incident cannot be re-dispatched)                    |
| FSD-FR-047 | BR-008         | Record overrides and dispatch decisions with actor, payload, timestamp and integrity hash                     |
| FSD-FR-048 | BR-009         | Allow an administrator to manage users and roles                                                              |
| FSD-FR-049 | BR-012         | Allow export of incident and audit records for post-event review                                              |
| FSD-FR-050 | BR-010         | Expose a health endpoint reporting service identity and status                                                |
| FSD-FR-051 | BR-011         | Carry baseline security headers on every API response                                                         |
| FSD-FR-052 | BR-010         | Expose the machine-readable contract at `/openapi.json`                                                       |
| FSD-FR-053 | BR-001         | Seed a demonstration corridor on first boot without duplicating it on restart                                 |
| FSD-FR-054 | BR-013         | Let a driver enter a destination by searching seeded road nodes or selecting a point on the map               |
| FSD-FR-055 | BR-013         | Request a route from the device location to the destination, snapping both to the nearest road node           |
| FSD-FR-056 | BR-013         | Render the active route, remaining distance and estimated arrival time on the mobile map                      |
| FSD-FR-057 | BR-013         | Produce turn-by-turn instructions with manoeuvre, road name and distance to the next step                     |
| FSD-FR-058 | BR-013         | Advance the instruction from GPS position and announce arrival when the destination is reached                |
| FSD-FR-059 | BR-013, BR-018 | Subscribe to the verified hazard event stream and apply incremental updates without a reload                  |
| FSD-FR-060 | BR-013         | Detect when a newly verified hazard intersects the remaining route                                            |
| FSD-FR-061 | BR-013         | Recalculate the route automatically around an intersecting hazard and announce the change                     |
| FSD-FR-062 | BR-013         | Offer a manual refresh and an alternative route when automatic rerouting cannot find a safe path              |
| FSD-FR-063 | BR-013         | Raise a proximity alert when the driver is within the configured warning radius of a verified hazard          |
| FSD-FR-064 | BR-013         | Show hazard kind, obstruction level, distance and recommended action in the alert                             |
| FSD-FR-065 | BR-014         | Submit a flood report with a required depth of `Ankle-Deep`, `Knee-Deep` or `Impassable`                      |
| FSD-FR-066 | BR-014         | Capture a photo with the device camera or attach an existing image to the report                              |
| FSD-FR-067 | BR-014         | Attach GPS coordinates, EXIF metadata, capture time and device time to the report                             |
| FSD-FR-068 | BR-018         | Persist unsent reports in an offline queue with a visible pending state                                       |
| FSD-FR-069 | BR-018         | Synchronise the offline queue in submission order when connectivity returns                                   |
| FSD-FR-070 | BR-018         | Cache the road graph, active hazards, closures and the most recent route locally                              |
| FSD-FR-071 | BR-018         | Render and navigate the cached graph while the network is unavailable                                         |
| FSD-FR-072 | BR-013         | Transmit batched vehicle telemetry no more than once every five seconds while navigation is active            |
| FSD-FR-073 | BR-015         | Trigger a one-tap SOS containing the current location and an optional contact note                            |
| FSD-FR-074 | BR-015         | Display SOS acknowledgement, assignment and resolution status                                                 |
| FSD-FR-075 | BR-016         | Render live network, hazard, closure, fleet and SOS layers on a MapLibre map                                  |
| FSD-FR-076 | BR-016         | Show each rescue unit's call sign, type, status and active task                                               |
| FSD-FR-077 | BR-014         | Load the moderation queue from the report API ordered by urgency score                                        |
| FSD-FR-078 | BR-014         | Display photo evidence, EXIF, capture time and a location plausibility check                                  |
| FSD-FR-079 | BR-014, BR-017 | Cross-reference nearby CCTV demo feeds and rain gauges for a selected report                                  |
| FSD-FR-080 | BR-014, BR-016 | Approve a report, creating and publishing a verified hazard in one action                                     |
| FSD-FR-081 | BR-014         | Reject or mark a report as duplicate with a required reason                                                   |
| FSD-FR-082 | BR-016         | Draw a flood polygon on the map with at least three vertices                                                  |
| FSD-FR-083 | BR-016         | Draw a road closure as a line along the road network                                                          |
| FSD-FR-084 | BR-016         | Assign an obstruction level of `Caution`, `Level 2`, `Level 3` or `Impassable`                                |
| FSD-FR-085 | BR-013, BR-016 | Publish, update or withdraw a drawn hazard and broadcast the change                                           |
| FSD-FR-086 | BR-013, BR-016 | Stream hazard, fleet and SOS changes to connected clients over server-sent events                             |
| FSD-FR-087 | BR-015, BR-016 | Create a distress incident from an SOS or a dispatcher entry and show it on the map                           |
| FSD-FR-088 | BR-016         | Rank available units by flood-safe travel time to a distress incident                                         |
| FSD-FR-089 | BR-016         | Assign a unit and preview the flood-safe rescue route before confirmation                                     |
| FSD-FR-090 | BR-017         | Ingest river gauge and rain gauge readings with sensor identity and timestamp                                 |
| FSD-FR-091 | BR-017         | Mark roads within the configured impact radius of a threshold breach as advisory                              |
| FSD-FR-092 | BR-009         | Enforce role permissions on verification, publishing, dispatch and configuration                              |
| FSD-FR-093 | BR-008         | Write an immutable audit record for every privileged action                                                   |

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
| BR-013  | FSD-FR-054 | Driver — Destination search          | Text            | Yes       |
| BR-013  | FSD-FR-054 | Driver — Map destination pin         | Map interaction | No        |
| BR-013  | FSD-FR-056 | Driver — Route summary               | Panel           | No        |
| BR-013  | FSD-FR-057 | Driver — Next instruction banner     | Banner          | No        |
| BR-013  | FSD-FR-062 | Driver — Reroute and alternatives    | Button          | No        |
| BR-013  | FSD-FR-063 | Driver — Proximity alert             | Banner          | No        |
| BR-014  | FSD-FR-065 | Driver — Depth selector              | Segmented tabs  | Yes       |
| BR-014  | FSD-FR-066 | Driver — Camera or file attach       | Button          | Yes       |
| BR-014  | FSD-FR-067 | Driver — GPS and timestamp status    | Indicator       | No        |
| BR-018  | FSD-FR-068 | Driver — Offline pending banner      | Banner          | No        |
| BR-015  | FSD-FR-073 | Driver — SOS button                  | Button          | Yes       |
| BR-016  | FSD-FR-075 | Map — Layer toggles                  | Checkbox group  | Yes       |
| BR-016  | FSD-FR-076 | Fleet — Unit list and status         | List            | No        |
| BR-014  | FSD-FR-078 | Evidence — Photo and EXIF            | Static block    | No        |
| BR-014  | FSD-FR-079 | Evidence — CCTV and gauge cross-ref  | Static block    | No        |
| BR-016  | FSD-FR-082 | Map — Flood polygon draw tool        | Map interaction | No        |
| BR-016  | FSD-FR-083 | Map — Closure line draw tool         | Map interaction | No        |
| BR-016  | FSD-FR-084 | Map — Obstruction level selector     | Select          | Yes       |
| BR-016  | FSD-FR-085 | Map — Publish or withdraw hazard     | Button          | Yes       |
| BR-015  | FSD-FR-087 | Map — Distress incident marker       | Map marker      | No        |
| BR-016  | FSD-FR-088 | Dispatch — Nearest unit ranking      | Ranked list     | No        |
| BR-016  | FSD-FR-089 | Dispatch — Rescue route preview      | Map overlay     | No        |

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
| BRULE-008 | BR-013  | FSD-FR-059 to 061      | Only a verified hazard affects routing; unverified reports never reroute     |
| BRULE-009 | BR-013  | FSD-FR-060, FSD-FR-061 | A verified hazard intersecting the remaining route forces a recalculation    |
| BRULE-010 | BR-015  | FSD-FR-073             | An SOS requires a location fix no older than 60 seconds                      |
| BRULE-011 | BR-016  | FSD-FR-088, FSD-FR-089 | Only an available unit may be assigned; assignment changes it to en route    |
| BRULE-012 | BR-017  | FSD-FR-091             | A sensor breach is advisory until a dispatcher confirms it                   |
| BRULE-013 | BR-018  | FSD-FR-067, FSD-FR-068 | Driver location is rounded, device id hashed, and retained at most 24 hours  |

## Interface Requirements

| Interface             | BRD Ref | FSD Ref                | Purpose                                                 |
| --------------------- | ------- | ---------------------- | ------------------------------------------------------- |
| Network State API     | BR-001  | FSD-FR-001 to 005      | GeoJSON road network with live depth and passability    |
| Simulation API        | BR-002  | FSD-FR-006 to 010      | Rainfall-to-depth simulation and state update           |
| Routing API           | BR-003  | FSD-FR-011 to 017      | Clearance-aware route and travel time                   |
| PostgreSQL + PostGIS  | BR-001  | FSD-FR-001, FSD-FR-053 | System of record for the road graph and live state      |
| Supabase (hosted)     | BR-011  | FSD-FR-051             | Managed Postgres with row-level security                |
| API auth module       | BR-009  | FSD-FR-018 to 023      | Sign-in, HS256 session tokens and role lookup           |
| OpenWeather           | BR-002  | FSD-FR-006, 007        | Optional rainfall input with manual fallback (planned)  |
| OpenTopography        | BR-001  | FSD-FR-001             | Offline elevation model for derived terrain             |
| Copernicus            | BR-017  | FSD-FR-090             | Offline imagery and land cover for validation           |
| Browser               | BR-010  | FSD-FR-018 to 049      | Dispatch portal runtime                                 |
| GitHub Actions        | BR-008  | FSD-FR-047             | Automated tests, security scan and schema migration     |
| Hazard event stream   | BR-013  | FSD-FR-059, FSD-FR-086 | SSE feed of published, updated and withdrawn hazards    |
| Report upload API     | BR-014  | FSD-FR-065 to 067      | Multipart report with photo, depth and GPS metadata     |
| Device camera and GPS | BR-014  | FSD-FR-066, FSD-FR-067 | Camera and geolocation modules in the native app        |
| Map tile source       | BR-013  | FSD-FR-056, FSD-FR-075 | Keyless Carto Positron style via MapLibre (ADR-022); the style URL keeps a Mapbox or OSM raster an easy swap; graph offline |
| Sensor gateway        | BR-017  | FSD-FR-090             | River and rain gauge readings with identity             |
| Redis pub/sub         | BR-018  | FSD-FR-086             | Fan-out for hazard, fleet and SOS events                |

## Test Scenarios

| TC ID  | BRD Ref | FSD Ref                            | Expected Result                                                             |
| ------ | ------- | ---------------------------------- | --------------------------------------------------------------------------- |
| TC-001 | BR-001  | FSD-FR-001, FSD-FR-003             | Default network state returns every node and edge with a valid status       |
| TC-002 | BR-001  | FSD-FR-002, FSD-FR-003             | A lower clearance reclassifies edges from `PASSABLE` to `LIGHT_FLOOD`       |
| TC-003 | BR-001  | FSD-FR-005                         | Clearance of 0, 201 or text returns 422                                     |
| TC-004 | BR-002  | FSD-FR-006, FSD-FR-007             | Zero rainfall produces zero runoff and unchanged depth                      |
| TC-005 | BR-002  | FSD-FR-007, FSD-FR-008             | Runoff and depth increase monotonically with rainfall                       |
| TC-006 | BR-002  | FSD-FR-009                         | An overridden edge keeps its depth after a simulation                       |
| TC-007 | BR-003  | FSD-FR-012, FSD-FR-013             | Dry network returns the fastest three-hop corridor                          |
| TC-008 | BR-003  | FSD-FR-014                         | Blocking every path returns 404, not an empty 200                           |
| TC-009 | BR-003  | FSD-FR-015                         | Unknown node returns 404 naming available node ids                          |
| TC-010 | BR-003  | FSD-FR-016                         | Reverse trip returns the mirrored route                                     |
| TC-011 | BR-009  | FSD-FR-018                         | Submitting an empty login field is blocked by native validation             |
| TC-012 | BR-009  | FSD-FR-019                         | Password toggle switches masking and updates the accessible name            |
| TC-013 | BR-004  | FSD-FR-024, FSD-FR-025             | Queue is ordered by descending urgency with all required fields             |
| TC-014 | BR-005  | FSD-FR-026                         | Each filter shows exactly its source count                                  |
| TC-015 | BR-005  | FSD-FR-027, FSD-FR-028             | Search matches partial values; no match shows the empty state               |
| TC-016 | BR-006  | FSD-FR-029, FSD-FR-032, FSD-FR-033 | Selecting an incident replaces the docket and narrative                     |
| TC-017 | BR-007  | FSD-FR-037, FSD-FR-043             | A saved note appears in the log with a timestamp; empty notes are rejected  |
| TC-018 | BR-007  | FSD-FR-042, FSD-FR-043             | Dispatch appends an identified log entry and confirms visibly               |
| TC-019 | BR-007  | FSD-FR-030                         | Dismiss de-emphasises the card and decrements the active count              |
| TC-020 | BR-009  | FSD-FR-022                         | Sign out returns to the login screen                                        |
| TC-021 | BR-010  | FSD-FR-050, FSD-FR-051             | Health endpoint responds and every response carries security headers        |
| TC-022 | BR-013  | FSD-FR-054, FSD-FR-056             | A destination search returns matching nodes and draws the selected route    |
| TC-023 | BR-013  | FSD-FR-055                         | A GPS origin is snapped to the nearest node and the route uses it           |
| TC-024 | BR-013  | FSD-FR-057, FSD-FR-058             | Instructions follow the route in order and arrival is announced             |
| TC-025 | BR-013  | FSD-FR-060, FSD-FR-061             | A hazard across the remaining route triggers an automatic reroute           |
| TC-026 | BR-013  | FSD-FR-063, FSD-FR-064             | Entering the warning radius raises one alert with level and distance        |
| TC-027 | BR-014  | FSD-FR-065                         | A report cannot be submitted without a depth value from the allowed set     |
| TC-028 | BR-014  | FSD-FR-066, FSD-FR-067             | A photo is stored, EXIF is extracted, and the served image carries none     |
| TC-029 | BR-018  | FSD-FR-068, FSD-FR-069             | An offline report is queued and synchronised once on reconnect              |
| TC-030 | BR-018  | FSD-FR-070, FSD-FR-071             | With the network disabled the cached graph still renders and navigates      |
| TC-031 | BR-013  | FSD-FR-072                         | Telemetry sends no more than one batch per five seconds                     |
| TC-032 | BR-015  | FSD-FR-073, FSD-FR-074             | SOS without a fresh location is refused; a valid SOS is acknowledged        |
| TC-033 | BR-016  | FSD-FR-075, FSD-FR-076             | All five map layers render and a unit shows status and active task          |
| TC-034 | BR-014  | FSD-FR-077                         | The queue is served by the API in descending urgency order                  |
| TC-035 | BR-014  | FSD-FR-078, FSD-FR-079             | Evidence shows photo, EXIF, nearest gauge and a labelled CCTV reference     |
| TC-036 | BR-014  | FSD-FR-080                         | Approving a report creates a published hazard and emits one event           |
| TC-037 | BR-014  | FSD-FR-081                         | Rejecting without a reason is blocked; a valid rejection is recorded        |
| TC-038 | BR-016  | FSD-FR-082, FSD-FR-084, FSD-FR-085 | A drawn polygon with an obstruction level can be published and withdrawn    |
| TC-039 | BR-016  | FSD-FR-083                         | A closure line follows the road and removes the segment from routing        |
| TC-040 | BR-016  | FSD-FR-088                         | Available units are ranked by flood-safe travel time, not straight distance |
| TC-041 | BR-016  | FSD-FR-089                         | The dispatch preview avoids published hazards and assignment is confirmed   |
| TC-042 | BR-017  | FSD-FR-090, FSD-FR-091             | A threshold breach marks only roads inside the impact radius as advisory    |
| TC-043 | BR-009  | FSD-FR-092                         | A driver-role session cannot approve, publish or dispatch                   |
| TC-044 | BR-008  | FSD-FR-093                         | Every privileged action writes exactly one attributable audit record        |
| TC-045 | BR-013  | FSD-FR-056, FSD-FR-075             | With no provider token configured the map still renders basemap tiles and the network, and stays usable |
| TC-046 | BR-002  | FSD-FR-006, FSD-FR-007             | When OpenWeather is unavailable, rainfall is entered manually and labelled  |

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
| BR-013  | FSD-FR-054 to 064                  | A route avoids every verified hazard; a new hazard reroutes or explicitly refuses       |
| BR-014  | FSD-FR-065 to 081                  | Every report has depth, evidence and metadata; every decision is recorded with a reason |
| BR-015  | FSD-FR-073, FSD-FR-074, FSD-FR-087 | An SOS carries a fresh location and reaches an acknowledged state                       |
| BR-016  | FSD-FR-075 to 089                  | Map, fleet and dispatch operate on persisted data, not mock state                       |
| BR-017  | FSD-FR-090, FSD-FR-091             | A reading is stored with identity and time; only roads in radius become advisory        |
| BR-018  | FSD-FR-059, FSD-FR-068 to 071      | Navigation and reporting continue offline and reconcile without duplicates              |

## Requirements Traceability Matrix

| BRD ID | FSD References                                   | Test Cases                                             |
| ------ | ------------------------------------------------ | ------------------------------------------------------ |
| BR-001 | FSD-FR-001 to 005, FSD-FR-053                    | TC-001, TC-002, TC-003, TC-021                         |
| BR-002 | FSD-FR-006 to 010                                | TC-004, TC-005, TC-006                                 |
| BR-003 | FSD-FR-011 to 017                                | TC-007, TC-008, TC-009, TC-010                         |
| BR-004 | FSD-FR-024, FSD-FR-025, FSD-FR-029, FSD-FR-031   | TC-013, TC-016                                         |
| BR-005 | FSD-FR-026 to 028                                | TC-014, TC-015                                         |
| BR-006 | FSD-FR-032 to 038                                | TC-016                                                 |
| BR-007 | FSD-FR-030, FSD-FR-037, FSD-FR-039 to 046        | TC-017, TC-018, TC-019                                 |
| BR-008 | FSD-FR-043, FSD-FR-044, FSD-FR-047               | TC-017, TC-018                                         |
| BR-009 | FSD-FR-018 to 023, FSD-FR-048                    | TC-011, TC-012, TC-020                                 |
| BR-010 | FSD-FR-050 to 052                                | TC-021                                                 |
| BR-011 | FSD-FR-023, FSD-FR-051                           | TC-021                                                 |
| BR-012 | FSD-FR-049                                       | — (planned)                                            |
| BR-013 | FSD-FR-054 to 064, FSD-FR-072, FSD-FR-085 to 086 | TC-022, TC-023, TC-024, TC-025, TC-026, TC-031, TC-038 |
| BR-014 | FSD-FR-065 to 081                                | TC-027, TC-028, TC-034, TC-035, TC-036, TC-037         |
| BR-015 | FSD-FR-073, FSD-FR-074, FSD-FR-087               | TC-032                                                 |
| BR-016 | FSD-FR-075 to 076, FSD-FR-082 to 089             | TC-033, TC-038, TC-039, TC-040, TC-041                 |
| BR-017 | FSD-FR-090, FSD-FR-091                           | TC-042                                                 |
| BR-018 | FSD-FR-059, FSD-FR-068 to 071                    | TC-029, TC-030                                         |

## Implementation Status

The pilot is honest about what exists. This table is the authoritative status
statement; the FSD identifiers above remain stable as items move.

| Module                   | FSD IDs           | Status      | Note                                                |
| ------------------------ | ----------------- | ----------- | --------------------------------------------------- |
| Network state            | FSD-FR-001 to 005 | Implemented | Contract-tested; 34-node / 61-edge curated pilot graph (LIM-014 closed) |
| Rainfall simulation      | FSD-FR-006 to 010 | Implemented | Contract-tested; overrides respected                |
| Routing                  | FSD-FR-011 to 017 | Implemented | Unit and contract tests                             |
| Portal access            | FSD-FR-018 to 023 | Implemented | Real sign-in against `/auth/login`; the token and profile are kept for the session, every request sends the token, and the shell returns to `/login` without one or when the API answers `401` |
| Incident queue           | FSD-FR-024 to 031 | Partial     | Live SOS feed with filters and search; field reports are queued separately on `/moderation` |
| Incident detail          | FSD-FR-032 to 038 | Implemented | Docket, witness narrative, authenticated evidence photo viewer with EXIF and submersion range, location with nearest unit ETA and rising-water indicator, and original file lightbox |
| Dispatch actions         | FSD-FR-039 to 046 | Implemented | Reject (false alarm), hold, escalate to BFP/Coast Guard, approve/dispatch, 5-second undo window, state constraints, and persistent attributable operations log persisted via API and audit trail |
| Audit and administration | FSD-FR-047 to 049 | Partial     | Hash-chained write path, `/audit` read API and `/audit/verify`; user management and export absent |
| Operations               | FSD-FR-050 to 053 | Implemented | Health, headers, OpenAPI, idempotent seed           |
| Authentication and RBAC  | FSD-FR-092, 093   | Implemented | Login, registration, roles, `/auth/me`, route-level enforcement and one attributable audit row per privileged action |
| Driver navigation        | FSD-FR-054 to 064 | Implemented | Turn-by-turn guidance, road names, GPS instruction tracking, hazard-aware routing, proximity alerts, and SSE auto-rerouting |
| Field reporting          | FSD-FR-065 to 067 | Implemented | Driver report intake with camera/gallery photo, EXIF retention, live GPS with accuracy fallback, depth selector and multipart submission |
| Offline operation        | FSD-FR-068 to 071 | Planned     | The offline screen is a labelled visual placeholder |
| Telemetry and SOS        | FSD-FR-072 to 074 | Implemented | POST /vehicles/{id}/telemetry (5 s throttle); SOS uses real GPS (VAL-021); status display on SOS screen (FSD-FR-074) |
| Live operational map     | FSD-FR-075, 076   | Implemented | MapLibre renders live network and A* route with toggleable overlays for verified hazards, fleet units and active SOS signals |
| Moderation and evidence  | FSD-FR-077 to 081 | Partial     | Portal desk at `/moderation`: urgency-ordered queue, authenticated evidence viewer, EXIF, approve (creates and publishes a hazard), reject and duplicate, all audited; CCTV/gauge cross-reference (FR-079) absent |
| Hazard authoring         | FSD-FR-082 to 086 | Implemented | Create, update, and publish via the API; live SSE event stream at `/api/v1/hazards/stream` |
| Distress and dispatch    | FSD-FR-087 to 089 | Partial     | Incident list, assignment and confirmation; rescue route absent |
| Portal and driver app UI | FSD-FR-054 to 089 | Partial     | The portal is template-derived; the driver app covers map, route, report, SOS and profile shells |
| Sensor ingestion         | FSD-FR-090, 091   | Planned     | No readings or threshold evaluation                 |

## Actors

| ID      | Actor              | Description                            | Access today                           |
| ------- | ------------------ | -------------------------------------- | -------------------------------------- |
| ACT-001 | Dispatcher         | Verifies reports and commits resources | Portal behind `/login`; `LGU_DISPATCHER` or `SUPER_ADMIN` token required |
| ACT-002 | MDRRMC commander   | Oversees operations across barangays   | Not distinguished from dispatcher      |
| ACT-003 | Field responder    | Consumes route guidance                | None (planned driver app, CR-001)      |
| ACT-004 | Citizen reporter   | Submits reports                        | None (planned report API, CR-001)      |
| ACT-005 | Administrator      | Manages users and configuration        | None (future)                          |
| ACT-006 | Integration client | Calls the API programmatically         | Bearer token from `/auth/login`; role decides the routes |
| ACT-007 | Driver/commuter    | Navigates, reports and requests rescue | Expo app; driver account token for `/sos` |
| ACT-008 | Rescue commander   | Approves dispatch and rescue routes    | None (planned, CR-001)                 |
| ACT-009 | Sensor gateway     | Posts river and rain gauge readings    | None (planned, CR-001)                 |
| ACT-010 | CCTV demo feed     | Labelled reference footage in evidence | None (demo registry, CR-001)           |

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

Actor: dispatcher or driver client. Postcondition: a passable route or an
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

Current limitation: the shell redirects signed-out visitors to `/login`, and the
portal sends its token on every request; a `401` clears the session. Role checks
on individual screens and audit records are still CR-001 work.
Requirements: FSD-FR-018 to 023, FSD-FR-092.

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

### UC-007 — Navigate with live hazard avoidance

Actor: driver. Precondition: destination selected and a route computed.
Postcondition: the driver reaches the destination on a route that avoids every
verified hazard, or is told that none exists.

1. Driver enters a destination or selects a point on the map.
2. System snaps the origin and destination to the road graph and requests a route.
3. System draws the route with distance, ETA and the first instruction.
4. System subscribes to the verified hazard stream.
5. When a hazard intersects the remaining route, system recalculates and
   announces the change.
6. When the driver approaches any verified hazard, system raises one proximity
   alert with level and distance.
7. System advances instructions by GPS and announces arrival.

Alternates: no safe route returns an explicit refusal and offers alternatives;
a dropped connection switches to the cached graph and cached hazards.
Requirements: FSD-FR-054 to 064.

### UC-008 — Report a hazard while offline

Actor: driver. Precondition: the app is open with location permission.
Postcondition: the report is queued and later reaches the moderation queue once.

1. Driver selects the depth: `Ankle-Deep`, `Knee-Deep` or `Impassable`.
2. Driver captures or attaches a photo.
3. System captures GPS, EXIF, capture time and device time.
4. With no connection, system stores the report and photo in the offline queue
   and shows a pending state.
5. On reconnect, system uploads queued reports in order and marks each synced.
6. The report appears in the LGU moderation queue with its evidence.

Alternates: a missing location blocks submission; a duplicate near an existing
report is accepted but flagged to the dispatcher.
Requirements: FSD-FR-065 to 069.

### UC-009 — Request emergency rescue

Actor: driver or citizen. Postcondition: a distress incident exists and a unit is
assigned, or the driver is told to use the telephone fallback.

1. Actor presses SOS and confirms.
2. System requires a location fix no older than 60 seconds and an optional note.
3. System creates a distress incident and shows it on the LGU map.
4. Dispatcher selects the incident and assigns the nearest suitable unit.
5. Driver sees acknowledgement, assignment and resolution status.

Alternates: a stale fix is refreshed before sending; with no connection the SOS
cannot be transmitted and the screen directs the user to the emergency line.
Requirements: FSD-FR-073, FSD-FR-074, FSD-FR-087.

### UC-010 — Draw and publish a hazard

Actor: dispatcher or rescue commander. Postcondition: a verified hazard is
published and connected clients are updated.

1. Actor selects the flood polygon or closure line tool.
2. Actor places vertices or traces the closed road segment.
3. System validates geometry and previews the feature.
4. Actor assigns an obstruction level.
5. Actor publishes; system stores the hazard, writes an audit record and emits
   an event.
6. Connected driver and LGU clients apply the change without a reload.

Alternates: fewer than three polygon vertices returns a validation error; an
overlapping active hazard prompts a merge or replace decision.
Requirements: FSD-FR-082 to 086, FSD-FR-093.

### UC-011 — Dispatch the nearest unit

Actor: dispatcher or rescue commander. Postcondition: an available unit is en
route on a flood-safe path.

1. Actor selects a distress incident.
2. System ranks available units by flood-safe travel time.
3. Actor previews the route for a candidate unit.
4. Actor confirms the assignment.
5. System sets the unit to en route, records the task and emits the update.
6. Fleet panel and map show the unit and its route.

Alternates: no available unit leaves the incident queued for escalation; a route
that becomes unsafe triggers the next candidate.
Requirements: FSD-FR-087 to 089.

### UC-012 — Ingest sensor data and flag roads

Actor: sensor gateway, then dispatcher. Postcondition: impacted roads are
advisory and visible on the map.

1. Gateway posts a river or rain gauge reading with sensor id and timestamp.
2. System validates the sensor and the reading range, then stores it.
3. System compares the reading with the configured threshold.
4. On a breach, system marks edges inside the impact radius as advisory.
5. System alerts connected LGU clients and records the event.
6. Dispatcher confirms the advisory as a hazard or dismisses it.

Alternates: unknown sensor returns 404; out-of-range reading returns 422; a
repeated breach inside the debounce window does not duplicate the advisory.
Requirements: FSD-FR-090, FSD-FR-091.

## Out of Scope for This Release

- Public App Store and Play Store releases; pilot distribution uses EAS internal builds.
- Real CCTV integration; a labelled demo feed registry is used.
- Production SMS, telephony or carrier delivery for SOS.
- Offline basemap tiles; offline mode renders the cached road graph.
- Administrative screens (FSD-FR-048) and exports (FSD-FR-049) remain planned.
- Multi-tenant operation and public information portal.
