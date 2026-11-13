# MetroFlow — Admin UI Design Baseline

## Document Control

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| Project        | MetroFlow                                            |
| Document       | Admin UI Design Baseline                             |
| Version        | 0.4                                                  |
| Status         | For Review — design gate not passed                  |
| Date           | 22 October 2026                                      |
| Scope          | LGU admin / dispatch portal only                     |
| Source         | Client-supplied HTML/CSS, 4 of 4 UIs received        |
| Behaviour ref  | [FSD](../FSD.md)                                     |
| Architecture   | [TSD](../TSD.md)                                     |
| Implementation | Implemented; see the 8 November 2026 status note below |

This baseline turns the supplied HTML/CSS into a design specification for the
modelled LGU admin site. It does not approve implementation, cost, schedule or
the outstanding scope. This is an academic capstone project, not an
official LGU deployment; the LGU is a scenario user context and no endorsement,
funding or data-sharing agreement is implied. The native Expo driver app is
covered separately in [DRIVER_APP_BASELINE.md](DRIVER_APP_BASELINE.md).

> **Implementation status (27 October 2026).** This baseline is a design
> specification, not a status report. The API gap tables further down were
> written against the v1.2 baseline; authentication, SOS, hazard create/update/
> publish and fleet endpoints have since been implemented. [api.md](../api.md)
> §9 is the authoritative list of what exists, and [FSD.md](../FSD.md)
> §Implementation Status records how far each screen is wired.

> **Implementation status (8 November 2026).** The report-verification desk now
> has the hold action, the duplicate target, location plausibility, the
> flood-safe nearest-unit ranking and the dispatch route preview that this
> baseline marked as missing from UI 2. The decision summary is partial: the
> reason and moderator are stored and audited, and the operations log is shown,
> but there is no single decision/audit block. The cells below are corrected
> where the current portal has moved past the note.

> **Implementation status (10 November 2026).** Swept every data-delta and
> API-call table in §9 against the actual routes in `backend/main.py`: hold,
> escalate, notes, duplicate (folded into reject), the hazard `name`/
> `avg_depth_cm`/`edge_id` columns, hazard publish/withdraw, and
> `vehicles.clearance_cm` are all `Done`, not missing. Civic Broadcasts,
> Evacuation Centers, Crew Profiles, Comms Streams and Air-Asset Escalation are
> marked `Out of scope` rather than `[TBD]` — that scope decision is settled
> per `AGENTS.md`, not still open. What's left genuinely open: ranked dispatch
> candidates, mission reroute, decision/audit as one block, and a few
> cosmetic-only fields (asset code, unit subtype, battery/endurance).

The supplied UIs are the **visual source of truth**. The FSD remains the
**behavioural source of truth**. Where the two disagree, the FSD behaviour wins
and the UI is adapted. Where the FSD is silent, the UI is used and the gap is
recorded below.

## 1. Source Inventory

### Received UIs

| #   | File                                                                                  | Screen                      | Coverage        |
| --- | ------------------------------------------------------------------------------------- | --------------------------- | --------------- |
| 1   | [lgu-admin-flood-closure-editor.html](source/lgu-admin-flood-closure-editor.html)     | Flood / Road Closure Editor | Layout supplied |
| 2   | [lgu-admin-report-verification.html](source/lgu-admin-report-verification.html)       | Report Verification Detail  | Layout supplied |
| 3   | [lgu-admin-published-hazard-alert.html](source/lgu-admin-published-hazard-alert.html) | Published Hazard Alert      | Layout supplied |
| 4   | [lgu-admin-rescue-tracking.html](source/lgu-admin-rescue-tracking.html)               | Rescue Tracking             | Layout supplied |

### Common implementation

| Item            | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| Framework       | Static HTML with Tailwind CDN and Lucide CDN                                             |
| Font            | Inter, loaded from Google Fonts                                                          |
| Data            | Hard-coded demo values                                                                   |
| External assets | Unsplash images, Tailwind CDN, Lucide CDN, Google Fonts                                  |
| UI 1 map        | Decorative dotted background with an inline SVG overlay                                  |
| UI 2 map        | Static Unsplash map image with an HTML pin                                               |
| UI 3 map        | Static Unsplash map image with an SVG route overlay                                      |
| UI 4 map        | Simulated SVG map with a vector route and no base map                                    |
| Known defects   | UI 1: one `className` attribute on a `<div>`; valid only in JSX                          |
| Known defects   | UI 2: full phone number shown; 2025 date; feet and centimetres mixed                     |
| Known defects   | UI 3: 2025 date; feet; second navy palette; public evidence images                       |
| Known defects   | UI 4: knots and metres; second navy palette; crew, comms and biometric claims not in FSD |

All four sources are archived for provenance and formatted for storage. They
are not production code and must not be served as-is.

Production adaptation:

- Tailwind CSS 4 is already installed in `metroflow-admin/`; the token values in
  `app/globals.css` match the palette. Do not add the Tailwind CDN.
- `lucide-react` is already installed. Do not add the Lucide CDN.
- Inter is already loaded through `next/font/google`. Do not add the Google
  Fonts import.
- All maps are replaced by MapLibre. The inline SVG, static Unsplash maps and
  route overlay are visual references only.
- Hard-coded values become props or API data. Unsplash images become local
  placeholders or real evidence thumbnails.
- UI 3 must not be treated as approval to send SMS, cell broadcast or siren
  messages. Those channels are demo-only until a provider and change request
  exist.
- UI 3 must not publish citizen evidence or CCTV frames. Public imagery needs a
  separate consent, redaction and provenance decision.
- The `className` defect is corrected when the markup is converted to React.
- The teal approve button in UI 2 is normalised to the existing success token
  unless the client confirms a separate success colour.
- The full phone number in UI 2 is masked by default; see §10.

## 2. Scope and Boundaries

### In scope

- The LGU admin / dispatch portal on desktop browsers.
- Login, dashboard, triage queue, incident detail, moderation, live map,
  hazard authoring, fleet, dispatch, sensors and conditional administration.
- Visual and interaction design derived from the supplied UIs.
- Data and API deltas needed to support the UIs' fields.

### Out of scope

- The native Expo driver app (`metroflow-mobile/`).
- Native build, signing and store distribution for the driver app.
- Bespoke visual design outside the supplied UIs.
- Real CCTV integration. CCTV remains a labelled demo registry.
- Real rain-gauge integration. Simulated gauges must be labelled.
- Financial, schedule and staffing values.

### Current boundary statement

Four of four UIs have been supplied: the Flood / Road Closure Editor, the
Report Verification Detail, the Published Hazard Alert and the Rescue Tracking
screen. The remaining admin screens are designed from the FSD and the existing
prototype, using the same shell and tokens. They are not covered by the client
UIs.

UI 3 supplies a **Civic Broadcasts** screen and a public-facing alert preview.
UI 4 supplies a **Rescue Units & Fleet** detail screen, including mission
telemetry, an encrypted comms stream and a distress beacon. Civic Broadcasts and
Evacuation Centers are not in the FSD or TSD; neither are crew profiles, radio
comms or air-asset escalation. They are baselined visually here and flagged for a
scope decision; this document does not add them to the requirements baseline.

The current React prototype is limited to the FSD-backed shell, queue and
incident detail, Dispatch Radar report verification, Live Map & Hazards editor
and Rescue Tracking. It omits Civic Broadcasts and the conditional UI 4 crew,
comms, payload, battery, safe-haven and air-escalation features until a change
request resolves them.

## 3. Design Tokens

### Colour

| Token           | Value     | Use                                            |
| --------------- | --------- | ---------------------------------------------- |
| `brand-50`      | `#f0f7ff` | Informational surfaces                         |
| `brand-100`     | `#e0effe` | Secondary button surface                       |
| `brand-500`     | `#0284c7` | Primary accent, focus, flood polygon stroke    |
| `brand-800`     | `#075985` | Strong accent text                             |
| `brand-900`     | `#0c4a6e` | Heading accent                                 |
| `navy-800`      | `#0f2942` | Primary button hover                           |
| `navy-900`      | `#0a1a2b` | Sidebar, logo tile, active navigation, primary |
| `slate-50`      | system    | Page background                                |
| `slate-200`     | system    | Borders and dividers                           |
| `slate-500/600` | system    | Secondary text                                 |
| `slate-800/900` | system    | Primary text                                   |
| `rose-600`      | system    | Road closure, SOS, destructive action          |
| `amber-500`     | system    | Caution and pending states                     |
| `emerald-600`   | system    | Safe, verified, success                        |
| `indigo-50/800` | system    | Advisory / reroute note surface                |

Flood polygon fill uses `brand-500` at 30% opacity with a solid `brand-500`
stroke. Road closure uses `rose-600`, dashed. These are baseline map styles.

UI 2 uses teal `#0f766e` for the approve action. The baseline normalises this
to `emerald-600` to avoid a second success colour; if the client wants a
distinct approve token, it must be added to `globals.css` and documented here.

UI 3 redefines `navy-800` as `#1e293b`, `navy-900` as `#0f172a` and introduces
`navy-950` as `#020617`. The baseline keeps the existing `#0f2942` / `#0a1a2b`
palette and uses Tailwind slate for the rest. UI 3 also uses `blue-600` for
primary accents; use `brand-500` and `brand-800`. Do not add a second navy scale
without a brand decision.

UI 4 repeats the UI 3 navy drift and uses `blue-600`, `ring-blue-50` and a
`rose-600` SOS action. It also displays speed in knots and depth in metres. Use
the approved navy and brand tokens, `rose-600` for SOS, centimetres for depth
(`NFR-017`) and a single declared speed unit. Do not add a second navy scale or a
second primary blue.

### Typography

| Role             | Size | Weight  | Notes                                              |
| ---------------- | ---- | ------- | -------------------------------------------------- |
| Screen title     | 14px | 700     | Header and panel titles                            |
| Body             | 14px | 400–500 | Inputs, primary copy                               |
| Secondary        | 12px | 400–600 | Metadata, helper text                              |
| Label            | 11px | 600     | Form labels; minimum for interactive context       |
| Micro-label      | 10px | 600–700 | Uppercase section labels; not for essential values |
| Decorative label | 9px  | 600–700 | Supplied UIs only; must not carry unique meaning   |

The supplied UIs use 9px and 10px text for meaningful content. The baseline raises
interactive labels and values to at least 11px and body copy to 12px. Nine-pixel
text is retained only for decorative uppercase captions, never as the only
carrier of status, time or identity.

### Shape, spacing and elevation

| Token          | Value                           |
| -------------- | ------------------------------- |
| Base unit      | 4px                             |
| Page gutter    | 24px                            |
| Card radius    | 12px (`rounded-xl`)             |
| Control radius | 8px (`rounded-lg`)              |
| Pill radius    | 9999px                          |
| Card border    | 1px `slate-200`                 |
| Card shadow    | `shadow-sm`; no heavy elevation |
| Sidebar        | 256px fixed                     |
| Header         | 64px fixed                      |
| Action bar     | 48px fixed                      |
| Inspector      | 360px fixed                     |
| Content gap    | 24px                            |

The design is desktop-first. The supported target is 1366×768 and above, per
`NFR-010`. At 1280–1365 the inspector narrows to 340px and telemetry cards may
stack. Below 1280 the layout must scroll rather than compress the map below a
usable width.

## 4. Application Shell

### Left sidebar

1. MetroFlow mark, wordmark and "LGU Operations" caption.
2. Sector status badge with a live indicator.
3. Primary navigation.
4. MDRRMC unit badge.
5. Operator identity and sign-out. The supplied UIs omit sign-out; the existing
   prototype includes it and it is required by `FSD-FR-022`.

Proposed navigation baseline:

| Order | Item                  | Screen                | Source                      |
| ----- | --------------------- | --------------------- | --------------------------- |
| 1     | Dispatch Radar        | Report verification   | UI 2 + FSD-FR-024–046       |
| 2     | Triage & Verification | Queue and detail      | FSD-FR-024–046              |
| 3     | Live Map & Hazards    | Map and hazard editor | UI 1 + FSD-FR-075–089       |
| 4     | Rescue Units & Fleet  | Fleet                 | UI 4 + FSD-FR-076           |
| 5     | Sensors & Water Level | Sensors               | UIs + FSD-FR-090–091        |
| 6     | Administration        | Users, audit, export  | Conditional; FSD-FR-047–049 |
| 7     | Evacuation Centers    | —                     | UI 1/3/4 only; not in FSD   |
| 8     | Civic Broadcasts      | —                     | UI 1/3 only; not in FSD     |

UI 1 marks **Sensors & Water Level** active while showing the hazard
editor. The editor belongs under **Live Map & Hazards**; the active state must
follow the route, not a fixed item. UI 4 correctly marks **Rescue Units & Fleet**
active, but the item label implies a fleet list while the screen shows a single
unit. The route model needs both a list and a unit detail view.

**Evacuation Centers** and **Civic Broadcasts** have no FSD requirement in
v1.2. Baseline decision: hide them until a change request adds requirements, or
show them disabled with an explicit "not in pilot" label. They must not open
empty screens.

### Top header

- Screen context: product name and "MDRRMC Operations Portal".
- Weather advisory, with source and timestamp.
- Active SOS count, from live data.
- Operator name, role and initials.
- A visible sign-out path.

The UIs' "28°C Rain Advisory" and "Active SOS: 14" are demo values. The
header must distinguish live, cached and unavailable data. When OpenWeather is
unavailable, show the manual-rainfall state rather than a stale temperature.

### Action bar

- Authoring mode: Flood Polygon or Road Closure.
- Telemetry sync state: live, stale or offline.
- Reset canvas, with confirmation when unsaved geometry exists.

The action bar is specific to the map editor. Other screens use the same band
for their primary action and filters, not for authoring controls.

### Main area

The editor uses a split layout: flexible map pane and a 360px scrollable
inspector. The map pane contains the map, a floating tool palette, zoom and
layer controls, a hazard summary bar and a telemetry row. The inspector contains
the polygon and closure forms.

Report verification uses a single scrolling column with a 7/5 split inside a
large card. The left column holds submission parameters, narrative, evidence
chips and the operations log; the right column holds the photo viewer and the
geo-anchor map. The decision bar sits at the bottom of the card and must remain
visible without scrolling past all the evidence. A sticky action bar is the
baseline; the supplied UI places it at the end of the card.

## 5. Screen Map

| Route              | Screen                     | UI coverage      | FSD reference           | Baseline status    |
| ------------------ | -------------------------- | ---------------- | ----------------------- | ------------------ |
| `/login`           | Sign in                    | None             | FSD-FR-018–023          | Reuse prototype    |
| `/`                | Redirect to dashboard      | None             | —                       | New                |
| `/dashboard`       | Operational dashboard      | None             | FSD-FR-024              | Reuse prototype    |
| `/triage`          | Queue                      | None             | FSD-FR-024–031          | Reuse prototype    |
| `/triage/[id]`     | Report verification detail | Full             | FSD-FR-032–046, 077–081 | UI 2               |
| `/map`             | Live map and hazard editor | Partial          | FSD-FR-075–089          | UI 1               |
| `/moderation`      | Evidence and moderation    | Implemented      | FSD-FR-077–081          | Queue, evidence viewer, approve, reject/duplicate; CCTV cross-reference absent |
| `/fleet`           | Rescue units and fleet     | None             | FSD-FR-076              | New; list          |
| `/fleet/[id]`      | Rescue unit tracking       | Full layout      | FSD-FR-076, 086–089     | UI 4               |
| `/dispatch`        | Distress and dispatch      | Unit detail link | FSD-FR-087–089          | New; queue pending |
| `/sensors`         | Sensors and advisories     | Partial card     | FSD-FR-090–091          | New                |
| `/broadcasts`      | Civic broadcast list       | None             | Not in FSD              | New; conditional   |
| `/broadcasts/[id]` | Published hazard alert     | Full layout      | FSD-FR-080, 085–086     | UI 3               |
| `/evacuation`      | Evacuation centers         | Card only        | Not in FSD              | New; conditional   |
| `/admin/users`     | Users and roles            | None             | FSD-FR-048, 092         | Conditional        |
| `/admin/audit`     | Audit log and export       | None             | FSD-FR-047, 049, 093    | Conditional        |

The map editor and moderation desk may share a route with a mode switch, but
the baseline keeps them separate: moderation is a queue-and-evidence task,
while authoring is a map task.

## 6. Component Inventory

| UI element                | Proposed React component | FSD reference       | Data / API                      | Baseline note                               |
| ------------------------- | ------------------------ | ------------------- | ------------------------------- | ------------------------------------------- |
| Sidebar                   | `PortalSidebar`          | FSD-FR-023, 048     | Session roles                   | Add sign-out; role-filtered items           |
| Sector status badge       | `SectorStatusBadge`      | FSD-FR-024, 075     | Network / hazard summary        | Live state, not static text                 |
| Header weather pill       | `WeatherAdvisory`        | FSD-FR-006–007      | OpenWeather or manual label     | Must show stale/manual state                |
| Header SOS pill           | `SosCounter`             | FSD-FR-087          | `GET /api/v1/sos`               | Live count; links to dispatch               |
| Operator block            | `OperatorMenu`           | FSD-FR-022–023      | `GET /api/v1/auth/me`           | Add sign-out and role label                 |
| Mode buttons              | `AuthoringModeSwitch`    | FSD-FR-082–083      | Local state                     | Keep; active state tied to mode             |
| Telemetry sync indicator  | `SyncStatus`             | FSD-FR-086          | SSE connection state            | Add stale/offline states                    |
| Reset canvas              | `ResetCanvasButton`      | FSD-FR-082–083      | Local state                     | Confirm when dirty                          |
| Map canvas                | `OperationalMap`         | FSD-FR-075–089      | Network, hazards, vehicles, SOS | Replace decorative SVG with MapLibre        |
| Map tool palette          | `MapToolbar`             | FSD-FR-082–083      | Local state                     | Add labels, keyboard access, active state   |
| Zoom / layer controls     | `MapControls`            | FSD-FR-075          | Local state                     | Layer toggles must be explicit              |
| SVG overlays              | Map sources and layers   | FSD-FR-075, 082–083 | GeoJSON                         | Not DOM overlays in production              |
| Depth label               | `HazardMarker` / popup   | FSD-FR-082–085      | Hazard metadata                 | Use NFR-017 units                           |
| Closure label             | `ClosureMarker` / popup  | FSD-FR-083–085      | Hazard metadata                 | Label must not be the only cue              |
| Map footer summary        | `HazardSummaryBar`       | FSD-FR-082–085      | Geometry metrics                | Area/perimeter computed from geometry       |
| Node edit hint            | `DrawHint`               | FSD-FR-082–083      | —                               | Collapsible help; not a persistent banner   |
| Sensor telemetry card     | `SensorTelemetryCard`    | FSD-FR-079, 090–091 | `GET /api/v1/sensors`           | Link to sensor and threshold                |
| Ground truth card         | `EvidenceCard`           | FSD-FR-078–079      | `GET /api/v1/reports/{id}`      | Real thumbnail; no external hotlink         |
| Fleet impact card         | `FleetImpactCard`        | FSD-FR-076, 088     | `GET /api/v1/vehicles`          | Summary only; full fleet has its own screen |
| Flood polygon form        | `FloodPolygonForm`       | FSD-FR-082, 084–085 | `POST/PATCH /api/v1/hazards`    | Add draft/publish split                     |
| Polygon name field        | `HazardNameField`        | FSD-FR-082          | `name`                          | Required; new schema field                  |
| Obstruction select        | `ObstructionLevelSelect` | FSD-FR-084          | `obstruction_level`             | Use FSD enum, not High/Moderate/Low         |
| Average depth field       | `DepthField`             | FSD-FR-082          | `avg_depth_cm`                  | Store cm; label cm per NFR-017              |
| Estimated residents field | `ResidentEstimateField`  | None                | `estimated_residents`           | No source; conditional                      |
| Colour swatches           | `SeverityPalette`        | FSD-FR-084          | Derived                         | Do not persist arbitrary colour             |
| Save polygon              | `SaveHazardButton`       | FSD-FR-085          | `POST/PATCH`                    | Split into Save draft and Publish           |
| Road closure form         | `RoadClosureForm`        | FSD-FR-083–085      | `POST/PATCH /api/v1/hazards`    | Bind to road edge, not free text            |
| Target segment field      | `RoadEdgeSelect`         | FSD-FR-083          | `edge_id`                       | Must select from network                    |
| Closure reason            | `ClosureReasonField`     | FSD-FR-083, 085     | `notes` / reason                | Required for audit                          |
| Barrier toggle            | `BarrierToggle`          | None                | `barrier_deployed`              | New field; decision required                |
| Suggested reroute         | `RerouteNoteField`       | None                | `reroute_note`                  | New field; decision required                |
| Save closure              | `SaveHazardButton`       | FSD-FR-085          | `POST/PATCH`                    | Same draft/publish split                    |

### Report verification components

| UI 2 element             | Proposed React component | FSD reference           | Data / API                   | Baseline note                                      |
| ------------------------ | ------------------------ | ----------------------- | ---------------------------- | -------------------------------------------------- |
| Back to queue / counters | `QueueContextBar`        | FSD-FR-024, 032         | Queue summary                | Live counts; preserve filters on return            |
| Report title and state   | `ReportHeader`           | FSD-FR-032              | `GET /api/v1/reports/{id}`   | Show report id, status and received time           |
| Urgency score            | `UrgencyScore`           | FSD-FR-024, 032         | `urgency_score`              | Show score and the reason it is high               |
| Submission parameters    | `SubmissionSummary`      | FSD-FR-032, 035         | Report record                | Keep; add source timestamp                         |
| Reporter identity        | `ReporterIdentity`       | FSD-FR-032, BR-011      | Reporter hash / profile      | Mask phone and citizen id by default               |
| Citizen description      | `ReportNarrative`        | FSD-FR-033              | `narrative`                  | Keep; do not truncate without a full view          |
| Evidence chips           | `EvidenceSummary`        | FSD-FR-034–035, 078–079 | Evidence links               | Chips must reflect real attachments                |
| Photo verification       | `EvidencePhoto`          | FSD-FR-034, 038, 078    | `photo_path`, `photo_sha256` | Authenticated viewer; no Unsplash                  |
| Photo metadata           | `EvidenceMetadata`       | FSD-FR-034, 078         | `exif`, `captured_at`        | Separate EXIF present from model confidence        |
| Location plausibility    | `LocationPlausibility`   | FSD-FR-078              | Claimed vs EXIF vs sensor    | Built: inside/outside pilot area; distance not shown |
| Photo depth estimate     | `DepthEstimate`          | FSD-FR-034              | `depth_level`, estimate      | Show a range in cm, plus the depth label           |
| Geo-anchor map           | `IncidentMap`            | FSD-FR-035, 075, 088    | Geometry, units              | Replace static image with MapLibre                 |
| Nearest unit summary     | `NearestUnitSummary`     | FSD-FR-088              | Ranked units                 | Show flood-safe ETA, not only straight distance    |
| Operations log           | `OperationsLog`          | FSD-FR-036, 043         | Log entries                  | Chronological; newest visible; actor and time      |
| Add note action          | `AddNoteForm`            | FSD-FR-037              | `POST` note                  | Inline form; reject empty notes                    |
| Escalate action          | `EscalateDialog`         | FSD-FR-040              | Escalation target and reason | FSD names BFP or Coast Guard, not PNP              |
| Reject action            | `RejectReportDialog`     | FSD-FR-039, 081         | Reason code and text         | Reason required; record decision                   |
| Approve and dispatch     | `ApproveDispatchFlow`    | FSD-FR-042, 080, 045    | Hazard payload, unit, route  | Approve/publish then dispatch; two audited actions |
| Hold action              | `HoldReportAction`       | FSD-FR-041              | Status transition            | Built: required reason; the report stays pending |
| Duplicate action         | `MarkDuplicateDialog`    | FSD-FR-081              | `duplicate_of`, reason       | Built: the reject dialog records `duplicate_of` |
| Decision summary         | `DecisionSummary`        | FSD-FR-043–044, 047     | Audit record                 | Partial: reason and moderator stored and audited; no decision block |

### Published hazard alert components

| UI 3 element             | Proposed React component   | FSD reference        | Data / API                    | Baseline note                                      |
| ------------------------ | -------------------------- | -------------------- | ----------------------------- | -------------------------------------------------- |
| Alert context bar        | `AlertContextBar`          | FSD-FR-080, 085–086  | Broadcast status              | Show published, expired or withdrawn; not static   |
| Share bulletin           | `ShareBulletinDialog`      | FSD-FR-085           | Share link / channel delivery | Confirm channel and audience; no silent send       |
| Review advisory          | `ReviewAdvisoryAction`     | FSD-FR-085           | Draft revision                | Must not edit the live bulletin in place           |
| Public alert banner      | `PublicAlertHeader`        | FSD-FR-080, 085      | Alert type and level          | Use one severity vocabulary                        |
| Title and issue metadata | `PublicAlertMeta`          | FSD-FR-080, 085      | Issued at, issuer, validity   | Real timestamp, timezone and expiry                |
| Public description       | `PublicAlertBody`          | FSD-FR-080, 085      | Bulletin text                 | Approved copy; no unreviewed narrative             |
| Areas affected           | `AffectedAreasList`        | FSD-FR-082–085, 091  | Hazard ids, levels            | Link each area to a hazard record                  |
| Public imagery           | `PublicEvidenceStrip`      | FSD-FR-078–079       | Approved media                | Consent, redaction and provenance required         |
| Action footer            | `PublicAlertActions`       | FSD-FR-085           | Bulletin actions              | Map, print and share must be separate actions      |
| Evacuation assignment    | `EvacuationAssignmentCard` | Not in FSD           | Center, capacity, timestamp   | New scope; capacity source is `[TBD]`              |
| Sector impact map        | `SectorImpactMap`          | FSD-FR-075, 085, 091 | Hazards, closures, detour     | Replace static image with MapLibre                 |
| Road status chip         | `RoadStatusChip`           | FSD-FR-083–084, 091  | Obstruction level             | Use the FSD level; no “100% inundated”             |
| Detour summary           | `DetourSummary`            | Not in FSD           | Detour route                  | New scope; must be validated against hazards       |
| Sensor telemetry list    | `SensorTelemetryList`      | FSD-FR-090–091       | Sensors and readings          | Show sensor id, time, threshold and simulated flag |
| Broadcast channels       | `BroadcastChannelList`     | Not in FSD           | Channel and delivery status   | Demo only until a provider exists                  |
| Delivery status          | `DeliveryStatus`           | Not in FSD           | Delivery receipts             | No fabricated counts or “100% sent”                |
| Print bulletin           | `PrintBulletinButton`      | Not in FSD           | Print stylesheet or PDF       | Public-safe version only                           |

### Rescue tracking components

| UI 4 element            | Proposed React component | FSD reference       | Data / API                       | Baseline note                                     |
| ----------------------- | ------------------------ | ------------------- | -------------------------------- | ------------------------------------------------- |
| Back to dispatch        | `FleetContextBar`        | FSD-FR-076, 087     | Task or unit context             | Preserve queue filters and scroll position        |
| Unit title and state    | `UnitHeader`             | FSD-FR-076          | `GET /api/v1/vehicles/{id}`      | Show call sign, status and task id                |
| Comm link               | `RadioLinkButton`        | Not in FSD          | No contract                      | Demo only; no encryption claim                    |
| Broadcast ping          | `BroadcastPingAction`    | Not in FSD          | No contract                      | Define audience and channel, or remove            |
| Unit identity           | `UnitIdentity`           | FSD-FR-076          | `call_sign`, `vehicle_type`      | Use call sign and enum; no invented asset id      |
| Crew profile            | `CrewCard`               | Not in FSD          | No crew table                    | Crew PII is new scope; mask or omit               |
| Live payload            | `PayloadCard`            | FSD-FR-076          | `capacity`, current load         | Current occupancy is not in schema                |
| Water speed and battery | `UnitTelemetryStrip`     | FSD-FR-072, 076     | Telemetry                        | Speed unit and battery are `[TBD]`                |
| Distress beacon         | `DistressBeaconCard`     | FSD-FR-074, 087     | `GET /api/v1/sos/{id}`           | Distress id, not a report id                      |
| Trapped-person summary  | `DistressDetails`        | FSD-FR-074, 087     | SOS note or new fields           | Structured counts and vulnerability are new scope |
| Field recon photo       | `EvidenceThumbnail`      | FSD-FR-034, 078     | Authenticated evidence route     | No Unsplash; internal use only                    |
| Comms stream            | `CommsStream`            | Not in FSD          | No contract                      | Conditional; audit and retention required         |
| Rescue map              | `RescueMap`              | FSD-FR-075, 088–089 | Route, hazards, unit, SOS        | Replace simulated SVG with MapLibre               |
| Route clearance summary | `RouteClearanceSummary`  | FSD-FR-089          | Route segments and vehicle draft | “Optimal clearance” needs a source                |
| Map layer controls      | `RescueMapControls`      | FSD-FR-075          | Local state                      | Name each layer; keyboard reachable               |
| Mission metrics         | `MissionMetricCard`      | FSD-FR-088–089      | Route ETA, distance, depth       | ETA may be stale; show as-of time                 |
| Safe haven              | `SafeHavenCard`          | Not in FSD          | Evacuation center                | Same conditional scope as UI 3                    |
| Mission timeline        | `MissionTimeline`        | FSD-FR-076, 087     | `dispatch_tasks` status history  | Add complete and cancelled states                 |
| Reroute action          | `RerouteAction`          | FSD-FR-089          | Routing endpoint                 | Requires preview and confirmation                 |
| Escalate to air assets  | `AirEscalationAction`    | Not in FSD          | No contract                      | Out of scope unless a CR adds it                  |
| Request support unit    | `RequestSupportAction`   | FSD-FR-087          | `POST /api/v1/sos` or reassign   | Clarify whether this creates or reassigns a task  |
| Telemetry sync state    | `SyncStatus`             | FSD-FR-086          | SSE connection state             | Reuse the shell component; no “just now” label    |

## 7. Screen Field Specifications

### Editor controls

The editor has two authoring forms, one for a flood polygon and one for a road
closure. Both write to the same hazard model and share the draft, publish and
withdraw lifecycle.

### Flood polygon

| Field                | Control         | Required | Validation                                    | Baseline decision                                    |
| -------------------- | --------------- | -------- | --------------------------------------------- | ---------------------------------------------------- |
| Polygon ID           | Read-only       | —        | Server-generated UUID; display a short code   | UI 1's `FP-2025-08` is demo only                     |
| Polygon name         | Text            | Yes      | 1–120 characters; trimmed                     | New `name` field                                     |
| Obstruction severity | Select          | Yes      | `CAUTION`, `LEVEL_2`, `LEVEL_3`, `IMPASSABLE` | Replace High/Moderate/Low                            |
| Average depth        | Number          | No       | 0–500 cm; integer                             | Store cm; display `cm`                               |
| Estimated residents  | Number          | No       | 0–1,000,000; integer                          | Only if a data source or manual estimate is accepted |
| Overlay colour       | Derived palette | No       | One colour per obstruction level              | Do not store arbitrary colour                        |
| Geometry             | Map draw / edit | Yes      | At least 3 vertices; closed; valid polygon    | FSD-FR-082 / VAL-017                                 |
| Notes                | Textarea        | No       | 0–1,000 characters                            | Existing `notes` field                               |
| Validity             | Date-time       | No       | Must be in the future when set                | Existing `valid_until`; optional in first slice      |
| Status               | System          | —        | `DRAFT`, `PUBLISHED` or `WITHDRAWN`           | New explicit model; see §9                           |

### Road closure

| Field                | Control           | Required | Validation                                       | Baseline decision                         |
| -------------------- | ----------------- | -------- | ------------------------------------------------ | ----------------------------------------- |
| Closure ID           | Read-only         | —        | Server-generated UUID                            | Same hazard identifier model              |
| Road segment         | Searchable select | Yes      | Must resolve to an existing `road_edges.edge_id` | Free-text segment is rejected             |
| Obstruction severity | Select            | Yes      | FSD enum                                         | Same as polygon                           |
| Closure reason       | Select + text     | Yes      | Reason code plus optional detail                 | Required for audit trail                  |
| Physical barrier     | Toggle            | No       | Boolean                                          | New field; conditional on client approval |
| Suggested reroute    | Textarea          | No       | 0–500 characters                                 | New field; conditional                    |
| Geometry             | Map draw / snap   | Yes      | At least 2 points; follows the selected edge     | FSD-FR-083 / VAL-017                      |
| Notes                | Textarea          | No       | 0–1,000 characters                               | Existing `notes` field                    |
| Status               | System            | —        | `DRAFT`, `PUBLISHED` or `WITHDRAWN`              | Same model as polygon                     |

### Map tools

| Tool            | Behaviour                                               | Keyboard equivalent                  |
| --------------- | ------------------------------------------------------- | ------------------------------------ |
| Select / pan    | Select a hazard or move the map                         | Arrow keys pan; Tab reaches controls |
| Place point     | Add a vertex at the pointer                             | Coordinate entry in the inspector    |
| Draw polygon    | Click vertices; double-click or Enter closes            | Enter closes; Escape cancels         |
| Draw closure    | Click along a road edge; snap to the network            | Select an edge from the inspector    |
| Delete          | Delete the selected vertex or hazard, with confirmation | Delete key                           |
| Vertex drag     | Move a vertex; update area and perimeter                | Numeric coordinate fields            |
| Midpoint insert | Insert a vertex on a segment                            | Add-point action                     |

The UI 1 "drag the white vertex handles" and "click midpoint" behaviour is kept,
but the map implementation is MapLibre, not inline SVG.

### Report verification fields

| Field                  | Control             | Required | Rule                                                          | Baseline decision                                |
| ---------------------- | ------------------- | -------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Report ID              | Read-only           | —        | Server identifier                                             | Display as `#FR-0248`                            |
| Status                 | Badge               | —        | `PENDING`, `VERIFIED`, `REJECTED` or `DUPLICATE`              | Replace static "Pending" with the real state     |
| Severity               | Badge               | —        | Derived from depth level and urgency; distinct from status    | UI 2 shows status and urgency, not severity      |
| Confidence             | Score + source      | —        | Report or evidence confidence, with the model or source named | UI 2 says "98.2% Authentic" without a source     |
| Urgency                | Score + explanation | —        | 0–10, computed by §2.8 of the TSD                             | Show why it is high, not only the number         |
| Source                 | Label               | —        | `PHOTO`, `CCTV`, `SENSOR` or `CALL`                           | "Citizen Mobile App v2.4" is not a source enum   |
| Received at            | Timestamp           | —        | ISO timestamp in PHT; relative age                            | UI 2 says 2025; use the real record              |
| Reporter name          | Text                | —        | Authorised roles only                                         | Keep; apply PII rules                            |
| Reporter contact       | Masked text         | —        | Mask by default; reveal is role-gated and audited             | Portal masks by default                          |
| Reporter ID            | Masked text         | —        | Never display the raw identifier                              | Show "Verified citizen" rather than the ID       |
| Barangay               | Text                | —        | From report record                                            | Keep                                             |
| Sector                 | Label               | —        | Derived from a configured boundary, not free text             | "Sector 4B" has no schema source                 |
| Coordinates            | Coordinate pair     | —        | Six decimal places; link to map                               | Keep; show accuracy separately                   |
| Narrative title        | Text                | —        | Derived summary or a new `summary` field                      | UI 2 invents a title not present in the schema   |
| Narrative body         | Text                | —        | Full report text                                              | Keep                                             |
| Photo                  | Thumbnail + viewer  | —        | Authenticated evidence route; EXIF stripped on serve          | Replace Unsplash; add viewer                     |
| Photo dimensions       | Text                | —        | From the stored image                                         | Keep                                             |
| Capture time           | Timestamp           | —        | From EXIF, labelled as device time                            | Keep; distinguish from server receipt            |
| Camera / orientation   | Text                | —        | From EXIF; may be absent                                      | Show "Unknown" when absent                       |
| EXIF status            | Badge               | —        | Present / absent / stripped, not "verified"                   | Rename to avoid claiming authenticity            |
| Depth estimate         | Text                | —        | Canonical depth level plus centimetre range                   | Remove feet; `NFR-017` requires centimetres      |
| Location plausibility  | Badge               | —        | Compare claimed point, EXIF point and sensor location         | Built: inside/outside pilot area; distance not shown |
| Sensor references      | List                | —        | Sensor id, type, value, unit, timestamp, threshold            | Nearest gauge with value, unit and time; simulated flag not shown |
| CCTV references        | List                | —        | Demo registry only; show "demo" and availability              | Removed: CCTV is out of scope                    |
| Operations log         | Chronological list  | —        | Actor, role, time, entry; newest visible                      | Keep; connect to audit                           |
| Internal note          | Textarea            | Yes      | Non-empty; 1–1,000 characters                                 | Built: inline note; the API caps it at 500 characters |
| Escalation target      | Select + reason     | Yes      | BFP or Coast Guard                                            | Built: agency and required reason                |
| Rejection reason       | Select + text       | Yes      | Reason required; recorded in the audit trail                  | Built: required reason                           |
| Duplicate of           | Report selector     | Yes      | Must reference an existing report                             | Built: the reject dialog records the target      |
| Nearest unit           | Ranked summary      | —        | Flood-safe travel time first; distance secondary              | Built: ranked by flood-safe ETA, with distance   |
| Dispatch route preview | Map overlay         | —        | Route avoids active hazards; confirmation required            | Built: previewed by the API before confirm       |
| Decision summary       | Audit block         | —        | Actor, action, reason, timestamp, integrity hash              | Partial: reason and moderator stored and audited |

### Published hazard alert fields

| Field               | Control             | Required | Rule                                                              | Baseline decision                                     |
| ------------------- | ------------------- | -------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Alert ID            | Read-only           | —        | Server identifier, not a hard-coded year prefix                   | `ADV-2025-0427-09` is demo only                       |
| Public status       | Badge               | —        | `DRAFT`, `PUBLISHED`, `EXPIRED` or `WITHDRAWN`                    | Replace static “Live Public Broadcast”                |
| Hazard link         | Read-only           | Yes      | One bulletin references one or more hazards                       | Add explicit hazard ids                               |
| Alert type          | Heading             | Yes      | Canonical vocabulary, e.g. advisory or warning                    | “FLOOD WARNING” and “Flood Advisory” conflict         |
| Severity / response | Badge + explanation | Yes      | One canonical level mapped to `FSD-FR-084`                        | “High Risk” and “Level 3 Response” need mapping       |
| Issued at           | Timestamp           | Yes      | ISO timestamp in PHT with timezone                                | UI 3 uses a 2025 date                                 |
| Issued by           | Text                | Yes      | Authenticated role and organisation                               | “MDRRMC Command Bureau” is a placeholder              |
| Effective / expiry  | Timestamp range     | Yes      | Expiry required; expired bulletins are not “live”                 | Missing from UI 3                                     |
| Public title        | Text                | Yes      | Approved public wording, max 120 characters                       | Keep; separate from internal hazard name              |
| Public description  | Rich text           | Yes      | Approved, sanitised copy; no internal notes or PII                | Keep; add approval state                              |
| Areas affected      | List                | Yes      | Hazard id, barangay, road segment and obstruction level           | Replace hard-coded three cards                        |
| Depth / obstruction | Text                | —        | Centimetres and/or canonical level; no feet                       | “1.5 - 2.0 ft” violates `NFR-017`                     |
| Roads closed        | Count + list        | —        | Derived from active closures                                      | “2 Roads Closed” needs a source                       |
| Inundation extent   | Text                | —        | Use obstruction level, not an invented percentage                 | “100% Inundated” is not a defined metric              |
| Detour              | Text + map          | —        | Validated flood-safe route; may be absent                         | “Bypass Route 4B” has no source                       |
| Public imagery      | Thumbnail set       | —        | Consent, redaction, provenance and approval required              | Citizen and CCTV images must not be public by default |
| Sensor readings     | List                | —        | Sensor id, type, value, unit, timestamp, threshold, simulated     | UI 3 shows names and values only                      |
| Evacuation center   | Text                | —        | Center id, name, address and status                               | No center table or assignment model                   |
| Capacity            | Percentage + time   | —        | Sourced from the center record with an as-of time                 | “74%” has no source                                   |
| Broadcast channels  | List                | —        | Channel, audience, provider and delivery state                    | CB, SMS and sirens are not implemented                |
| Geo-target          | Number + map        | —        | Radius or polygon from configuration; show the unit               | “4.5 km” has no source                                |
| Channel status      | Badge               | —        | `NOT_CONFIGURED`, `DEMO`, `QUEUED`, `SENT`, `DELIVERED`, `FAILED` | “Wailing Sound” is not a status                       |
| Withdraw / expire   | Action              | —        | Withdraw with reason; expiry is automatic                         | UI 3 has no withdraw or expiry action                 |
| Delivery status     | List                | —        | Queued, sent, delivered or failed, with counts and time           | “100% Sent” and “14,820” are fabricated               |
| Share action        | Button              | —        | Confirm whether it shares a link or sends a channel               | “Share Bulletin” is ambiguous                         |
| Review action       | Button              | —        | Creates a draft revision, not an in-place edit                    | “Review Advisory” needs this rule                     |
| Print action        | Button              | —        | Public-safe print stylesheet or server PDF                        | “Print PDF” has no contract                           |

### Rescue unit and mission fields

| Field                     | Control            | Required | Rule                                                               | Baseline decision                                         |
| ------------------------- | ------------------ | -------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| Unit call sign            | Read-only          | Yes      | Stable unique label from `vehicles.call_sign`                      | UI 4 `RU-03` is consistent with the schema                |
| External asset id         | Read-only          | —        | Only if the LGU has an authoritative asset register                | `#LCT-0321` has no source                                 |
| Unit type                 | Badge              | Yes      | `AMBULANCE`, `RESCUE_BOAT`, `FIRE_TRUCK` or `PATROL`               | Add a display subtype, or use the enum only               |
| Unit subtype              | Text               | —        | Optional label such as “Amphibious swiftwater”                     | New field; not in schema                                  |
| Unit status               | Badge              | Yes      | `AVAILABLE`, `EN_ROUTE`, `ON_SCENE` or `OFFLINE`                   | UI 4 `EN ROUTE` matches the schema                        |
| Active task               | Link               | —        | Task id and state; absent when available                           | Add to the fleet read contract                            |
| Home depot                | Text               | —        | `home_node_id` resolved to a node label                            | `Depot Delta` needs a network label                       |
| Last position             | Coordinate + map   | —        | Position, heading and freshness                                    | Show age and source                                       |
| Last telemetry            | Timestamp          | —        | Capture time, not “just now”                                       | UI 4 has no timestamp                                     |
| Crew member               | List               | —        | Name, role and certification; authorised roles only                | New PII scope; not in FSD                                 |
| Current load              | Number + capacity  | —        | 0 ≤ load ≤ capacity                                                | `2 / 6` needs a current-occupancy field                   |
| Water speed               | Number             | —        | One declared unit; label derived or reported                       | `14.8 knots` conflicts with `speed_kmh`                   |
| Battery / endurance       | Percentage + hours | —        | Only if the telemetry device reports it                            | `88% (4.2 hrs)` has no field                              |
| Vehicle clearance / draft | Number             | —        | Centimetres; used by rescue routing                                | Missing from `vehicles`; required for “optimal clearance” |
| Distress id               | Read-only          | Yes      | `sos_requests.sos_id` or `dispatch_tasks.task_id`                  | `Ticket #FR-0248` is a report id, not a distress id       |
| Linked report             | Link               | —        | Optional originating report                                        | Keep the relationship explicit                            |
| Distress location         | Coordinate + map   | Yes      | Coordinates, barangay and sector                                   | `Sector Delta` needs a boundary source                    |
| People trapped            | Number             | —        | Integer ≥ 0; labelled unverified if not confirmed                  | New structured field or SOS note                          |
| Vulnerable persons        | Counts             | —        | Infant, senior, disabled or medical; sensitive                     | New scope; minimise and restrict access                   |
| Water depth at target     | Number             | —        | Centimetres plus trend                                             | UI 4 uses metres and “rising” without a source            |
| Evidence photo            | Thumbnail + viewer | —        | Authenticated internal evidence; timestamp and provenance          | Replace Unsplash; no public release by default            |
| ETA                       | Duration           | —        | Flood-safe route ETA with as-of time                               | `12 min` / `12:13 PM` must come from routing              |
| Remaining distance        | Number             | —        | Route remaining distance; derive from geometry                     | `4.2 km` has no contract                                  |
| Total route distance      | Number             | —        | Assignment route length                                            | `6.8 km` needs a stored or derived route length           |
| Route depth               | Number             | —        | Maximum depth on the route in centimetres                          | `1.2 m` violates `NFR-017`                                |
| Safe haven                | Link + capacity    | —        | Evacuation center id, name, occupancy and as-of time               | Not in FSD; same scope decision as UI 3                   |
| Mission milestone         | Timeline           | Yes      | Assigned, en route, arrived, complete or cancelled with timestamps | UI 4 stops at “On Site”; add complete/cancelled           |
| Comms channel             | Text               | —        | Channel label and provider; authenticated history                  | `CH-4` has no integration or contract                     |
| Comms message             | Chronological list | —        | Author, role, time, body; retention and access rules               | New scope; no schema                                      |
| Reroute                   | Action + preview   | —        | Recompute a flood-safe route; confirmation and audit               | UI 4 has a button but no preview                          |
| Air-asset escalation      | Action             | —        | Target agency, reason and contact path                             | Not in FSD or TSD                                         |
| Support request           | Action + reason    | —        | Creates a new SOS or requests reassignment; define which           | “Signal Immediate Support Unit” is ambiguous              |

## 8. State and Interaction Specification

### Report verification lifecycle

The report status is the incident state, not the hazard state.

| State       | Meaning                                   | Allowed actions                                  |
| ----------- | ----------------------------------------- | ------------------------------------------------ |
| `PENDING`   | Awaiting a dispatcher decision            | Note, hold, escalate, reject, duplicate, approve |
| `VERIFIED`  | Approved; the published hazard is live    | Note, escalate, dispatch, view                   |
| `REJECTED`  | Closed as a false alarm or invalid report | View (reopening is not specified)                |
| `DUPLICATE` | Linked to an existing report              | View, open the canonical report                  |

Action rules:

- **Add note** is available in every state and requires non-empty text
  (`FSD-FR-037`, `VAL-010`).
- **Hold** sets a pending-sensor state and records the reason (`FSD-FR-041`).
- **Escalate** requires a target, BFP or Coast Guard, and a reason
  (`FSD-FR-040`).
- **Reject** requires a reason and records the decision (`FSD-FR-039`,
  `FSD-FR-044`).
- **Duplicate** requires the canonical report and a reason (`FSD-FR-081`).
- **Approve** creates and publishes a verified hazard in one action
  (`FSD-FR-080`). Dispatching a unit is a separate action (`FSD-FR-042`).
- **Dispatch** requires an available unit and a route preview, then a
  confirmation with a short undo window (`FSD-FR-042`, `FSD-FR-045`,
  `FSD-FR-088–089`). A dispatched report cannot be dispatched again without an
  explicit reassignment (`FSD-FR-046`).
- A verified, rejected or duplicate report cannot be approved again
  (`FSD-FR-046`).
- Every action appends an entry naming the actor and timestamp, and writes an
  audit record with the reason (`FSD-FR-043–044`, `FSD-FR-093`).

The UI 2 "Approve & Dispatch" button must not be implemented as one
irreversible server action. It opens a guided flow: review the hazard that will
be published, approve and publish it, then optionally choose a unit, preview the
flood-safe route, confirm the dispatch, and show the undo window. The audit
trail records approval and dispatch as separate decisions. `FSD-FR-042` currently
reads as if approval and dispatch are a single action; the FSD should be
reworded to match this flow before the design gate.

### Rescue mission lifecycle

UI 4 presents a dispatch task as a unit view. The task status and the vehicle
status are related but not the same record.

| Task state  | Meaning                             | Vehicle state | Allowed actions                          |
| ----------- | ----------------------------------- | ------------- | ---------------------------------------- |
| `ASSIGNED`  | Unit assigned, has not departed     | `EN_ROUTE`    | View route, reassign, cancel             |
| `EN_ROUTE`  | Unit is travelling to the incident  | `EN_ROUTE`    | View telemetry, reroute, request support |
| `ARRIVED`   | Unit has reached the scene          | `ON_SCENE`    | View, complete, request support          |
| `COMPLETE`  | Incident resolved and unit released | `AVAILABLE`   | View; no further dispatch action         |
| `CANCELLED` | Task withdrawn before completion    | `AVAILABLE`   | View; reopen only through a new task     |

Rules:

- Only an available unit may be assigned; assignment moves it to `EN_ROUTE`
  (`BRULE-011`, `FSD-FR-088–089`).
- UI 4's “Dispatched”, “En Route” and “On Site” milestones map to `ASSIGNED`,
  `EN_ROUTE` and `ARRIVED`. `COMPLETE` and `CANCELLED` are missing and must be
  added before the timeline is complete.
- Milestone times come from `assigned_at`, `started_at`, `completed_at` and the
  audit trail. Do not hard-code `11:58 AM`, `12:01 PM` or `12:13 PM`.
- The ETA is the flood-safe route estimate at assignment, recalculated only when
  the route is refreshed. Show its as-of time; do not present a stale ETA as
  live.
- **Reroute** recomputes the route, shows the new path and ETA, and requires
  confirmation before replacing the active route (`FSD-FR-089`).
- **Signal Immediate Support Unit** must be defined as either a new SOS
  (`FSD-FR-087`) or a task reassignment. It is not a silent vehicle-status
  change.
- **Escalate to Air Assets** has no actor, agency, resource model or API. It is
  not part of the pilot until a change request adds it.
- Completing a task resolves the linked SOS, records the outcome and returns the
  unit to `AVAILABLE`. A cancellation returns the SOS to the queue.
- The comms stream and crew profile are not in the FSD. If retained, they need
  access rules, retention, encryption and audit. A label is not a security
  control; “Encrypted Comms Stream” must not be shown unless the channel is
  actually encrypted end to end.
- “Biometric beacon link” in the subtitle implies health or biometric data.
  Remove the phrase or define the data, consent and retention rules.

### Public bulletin lifecycle

Civic Broadcasts are not in the FSD. The following is a proposed lifecycle for
the UI 3 screen, not an approved requirement.

| State       | Meaning                                  | Allowed actions                               |
| ----------- | ---------------------------------------- | --------------------------------------------- |
| `DRAFT`     | Bulletin is being prepared               | Edit, preview, publish, discard               |
| `PUBLISHED` | Publicly visible and within its validity | Share link, review, withdraw, view deliveries |
| `EXPIRED`   | Validity end has passed                  | View, duplicate as draft                      |
| `WITHDRAWN` | Removed before expiry                    | View, duplicate as draft                      |

Rules:

- A published bulletin is immutable. **Review Advisory** creates a new draft
  revision; publishing it supersedes the live version but preserves the prior
  version in history.
- An expiry timestamp is required. The “Live Public Broadcast” indicator is
  shown only while the bulletin is published and unexpired.
- **Withdraw** requires a reason and records which channels were already
  delivered. Delivery cannot be assumed to be reversible.
- **Share Bulletin** must state whether it copies a public link or sends a new
  channel message. Sending requires a confirmation and an audit entry.
- Public imagery must be approved for release. Never publish raw citizen
  evidence, faces, plates or CCTV frames by default.
- Each channel reports its own state: `NOT_CONFIGURED`, `DEMO`, `QUEUED`,
  `SENT`, `DELIVERED` or `FAILED`. There is no single “100% Sent” state.
- Publishing, revising and withdrawing are privileged actions and must be
  audited (`FSD-FR-093`).

### Hazard lifecycle

The UI 1 editor has one action, "Save", but the FSD requires publish and
withdraw. Baseline model:

| State       | Visible to drivers | Allowed actions                      |
| ----------- | ------------------ | ------------------------------------ |
| `DRAFT`     | No                 | Edit, publish, discard               |
| `PUBLISHED` | Yes                | Edit (creates a new draft), withdraw |
| `WITHDRAWN` | No                 | View, duplicate as draft             |

Proposed mapping:

- **Save draft** creates or updates a hazard with `published_at = null`.
- **Publish** sets `published_at`, `published_by` and `active = true`, then emits
  the hazard event.
- **Withdraw** sets `active = false` and emits a withdrawal event. It does not
  delete the row.
- Editing a published hazard creates a draft revision; the published geometry
  remains live until the revision is published.

This needs an explicit API contract before implementation. The current TSD
schema has `published_at` and `active` but no `status` column; the baseline can
derive status from those two fields without a migration. The UI still needs the
three-state model.

### Interaction states

| State            | Presentation                                                         |
| ---------------- | -------------------------------------------------------------------- |
| Loading          | Map skeleton and inspector skeleton; no layout shift                 |
| Empty            | "No hazard selected" with a draw action                              |
| Drawing          | Active tool, vertex count, area/perimeter, instructions              |
| Dirty            | Unsaved indicator; navigation and reset require confirmation         |
| Validating       | Inline field errors; draw errors next to the map                     |
| Saving           | Buttons disabled; progress label; no duplicate submit                |
| Saved            | Timestamp and actor; toast; dirty state cleared                      |
| Publishing       | Confirmation dialog naming the hazard and level                      |
| Published        | Status chip; withdraw action; audit entry                            |
| Withdrawing      | Confirmation dialog with reason                                      |
| Conflict         | Banner: the hazard changed elsewhere; compare or reload              |
| Forbidden        | Action hidden or disabled with a reason; 403 does not clear the form |
| Offline          | Sync status changes; save is blocked or queued per API contract      |
| Server error     | Inline error with request id; form values preserved                  |
| Delivery partial | Per-channel failure banner; retry only the failed channel            |
| Expired          | Read-only banner; duplicate as draft                                 |
| Channel demo     | “Demo” badge; no delivery or audience claim                          |

### Confirmations

- Reset canvas with unsaved geometry.
- Publish a hazard, naming its level and affected segment.
- Withdraw a published hazard.
- Discard a draft.
- Delete a vertex or hazard.
- Dispatch or reassign a unit (`FSD-FR-045`).
- Reroute an active rescue mission.
- Request a support unit or escalate to another agency.
- Publish or revise a public bulletin.
- Withdraw a public bulletin, with a reason.
- Send a bulletin to an external channel.
- Print a public bulletin as PDF.

### SSE behaviour

- Subscribe to hazard, fleet and SOS streams while the map is open.
- Apply incremental updates without a full reload (`FSD-FR-086`).
- If the open hazard is updated remotely, do not overwrite the form silently.
  Show a conflict banner and offer reload or compare.
- Reconnect with a snapshot; mark data stale after a missed heartbeat.

## 9. Data and API Deltas

The UIs introduce fields that are not in the current schema or API. These
must be resolved before implementation.

| Item                          | Current state                                     | Required change                                             | Decision |
| ----------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | -------- |
| Hazard name                   | `hazard_zones.name varchar(120) not null`         | —                                                            | Done     |
| Average depth                 | `hazard_zones.avg_depth_cm smallint null`         | —                                                            | Done     |
| Estimated residents           | Not in `hazard_zones`                             | Add `estimated_residents integer null`, or drop the field   | `[TBD]`  |
| Overlay colour                | Not in `hazard_zones`                             | Derive from `obstruction_level`; do not persist             | Proposed |
| Closure barrier               | Not in `hazard_zones`                             | Add `barrier_deployed boolean null`, or fold into `notes`   | `[TBD]`  |
| Suggested reroute             | Not in `hazard_zones`                             | Add `reroute_note text null`, or fold into `notes`          | `[TBD]`  |
| Closure edge                  | `hazard_zones.edge_id` FK to `road_edges`         | —                                                            | Done     |
| Draft / published / withdrawn | `published_at` and `active` exposed on the contract | Client derives draft/published/withdrawn from those two fields | Done  |
| Hazard read for editing       | `GET /api/v1/hazards/{id}`                        | —                                                            | Done (9 Nov 2026) |
| Hazard list by status         | `GET /api/v1/hazards?active=`                     | —                                                            | Done — filters by `active`, not a `status` enum |
| Publish and withdraw          | `POST /hazards/{id}/publish`, `PATCH /hazards/{id}` (withdraw sets `active=false`) | —                             | Done     |
| Validation errors             | `E001`–`E015` exist                               | Add geometry, state-transition and conflict errors          | `[TBD]`  |

The `barrier_deployed` and `reroute_note` fields are useful operationally but
are not in the FSD. They should either be added through a change request or
removed from the form. They must not be silently persisted as free text.

The "estimated residents" field has no population source. It must be labelled
as a manual estimate, or removed. It must not be presented as computed.

### Report verification data deltas

| Item                    | Current state                   | Required change                                                   | Decision |
| ----------------------- | ------------------------------- | ----------------------------------------------------------------- | -------- |
| Reporter display name   | `reporter_hash` only            | Resolve through an authorised profile, or show "Verified citizen" | `[TBD]`  |
| Reporter phone          | Not in `incident_reports`       | Do not add unless a lawful need and retention rule exist          | `[TBD]`  |
| Reporter citizen ID     | Not in `incident_reports`       | Do not display; use verification status only                      | Proposed |
| Source channel          | `source` enum only              | Use `PHOTO`, `CCTV`, `SENSOR` or `CALL`; no app version field     | Proposed |
| Sector                  | No field                        | Derive from a configured boundary; do not free-text               | `[TBD]`  |
| Report summary / title  | No field                        | Derive from the narrative, or add `summary varchar(160)`          | `[TBD]`  |
| Depth estimate range    | `depth_level` only              | Add `estimated_depth_min_cm` and `estimated_depth_max_cm`         | `[TBD]`  |
| Location plausibility   | Not computed                    | Compare claimed point, EXIF point and sensor point                | `[TBD]`  |
| Photo viewer            | `GET /api/v1/reports/{id}/photo` (authenticated) | —                                                 | Done     |
| Sensor cross-reference  | `GET /api/v1/reports/{id}/nearest-sensor`        | —                                                 | Done     |
| CCTV cross-reference    | Removed                         | Real CCTV integration is out of scope (`AGENTS.md`); no references remain | Out of scope |
| Nearest-unit candidates | Only assign and route endpoints | Add a ranked candidate endpoint with ETA and safety               | `[TBD]`  |
| Report notes            | `POST /api/v1/reports/{id}/notes`                | —                                                                 | Done     |
| Hold action             | `POST /api/v1/reports/{id}/hold`                 | —                                                                 | Done     |
| Escalate action         | `POST /api/v1/reports/{id}/escalate`             | —                                                                 | Done     |
| Duplicate action        | `POST /api/v1/reports/{id}/reject` with `duplicate_of` | —                                                           | Done — folded into reject rather than a separate endpoint |
| Decision summary        | `GET /api/v1/reports/{id}/log`                   | —                                                                 | Done     |
| PII masking             | Phone numbers masked by default in the portal (`maskPhoneNumber()`); reporter identity is a salted hash, never a user id | A reveal-with-audit path for phone numbers does not exist | Done — masking; no reveal path |

The report detail screen must not display a full phone number, citizen ID or
exact home address to every dispatcher by default. The UI can show a verified
badge and a masked contact. Revealing contact details is a privileged action and
must be audited.

### Published alert data deltas

UI 3 introduces a public bulletin and broadcast-delivery surface that has no
current schema or API contract. It is not in the FSD, and the scope decision
below is now settled: **Civic Broadcasts and Evacuation Centers are out of
scope for the pilot** (`AGENTS.md`). The sidebar entry is disabled with a
"Out of scope for pilot" tooltip. The deltas below are left as a record of
what a future-product implementation would need, not open work.

| Item                    | Current state                         | Required change                                                        | Decision |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------------------- | -------- |
| Public bulletin entity  | No `broadcasts` table                 | Add a bulletin record linked to one or more hazards                    | `[TBD]`  |
| Public alert level      | Only `obstruction_level` on hazards   | Add `alert_level`, or map one canonical level to the hazard level      | `[TBD]`  |
| Public title and body   | Hazard `name` and internal notes only | Add approved public title, summary and body                            | `[TBD]`  |
| Validity and expiry     | Hazard `published_at` and `active`    | Add `valid_from` and `valid_until`; require expiry                     | `[TBD]`  |
| Bulletin versioning     | No revision model                     | Add version, supersedes and approval fields                            | `[TBD]`  |
| Public evidence release | `photo_path` and `photo_sha256`       | Add explicit consent, redaction and release fields; default denied     | `[TBD]`  |
| Evacuation centers      | No table                              | Add center identity, location, capacity, occupancy and source          | `[TBD]`  |
| Center assignment       | No table                              | Add bulletin-to-center assignment with as-of time                      | `[TBD]`  |
| Broadcast channels      | No channel or provider model          | Add channel configuration, audience and provider state                 | `[TBD]`  |
| Delivery receipts       | No delivery model                     | Add per-channel queued, sent, delivered and failed counts              | `[TBD]`  |
| Public sensor read      | `GET /api/v1/sensors` only            | Return public-safe id, value, unit, timestamp, threshold and simulated | `[TBD]`  |
| Roads closed / detour   | Derived from hazards                  | Add a public summary contract or compute from active hazards           | `[TBD]`  |
| Share link              | No public URL                         | Add a signed or stable public bulletin URL                             | `[TBD]`  |
| Print / PDF             | No contract                           | Use a print stylesheet or a server-generated public-safe PDF           | `[TBD]`  |
| Public cache            | No invalidation rule                  | Invalidate on publish, revision and withdrawal                         | `[TBD]`  |
| Audit                   | `audit_logs` schema only              | Record publish, revision, share, print and withdraw                    | `[TBD]`  |

The UI 3 counts — “14,820 Residents Notified”, “100% Sent”, “74%” capacity and
“2 Roads Closed” — have no source. They must be removed or labelled as demo and
must never be presented as live operational data.

The UI 2 and UI 3 demo datasets also disagree: UI 2 says CCTV is “0 Available”
while UI 3 shows “CCTV Station 04 Malaya”, and the sensor names and river levels
do not match. Use one shared demo dataset or label each value independently.

### Rescue tracking data deltas

UI 4 adds mission telemetry, crew, comms and support actions. Only the unit
identity, status, task and route have an FSD basis. The rest is a scope decision.

| Item                      | Current state                             | Required change                                                    | Decision |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------ | -------- |
| Unit detail read          | `GET /api/v1/vehicles/{id}`; active task is the separate `GET /api/v1/vehicles/{id}/mission` | — | Done (9 Nov 2026) |
| Active task               | `GET /api/v1/vehicles` lists status only  | Return task id, distress id, status and timestamps                 | `[TBD]`  |
| External asset id         | `call_sign` and `vehicle_id` only         | Add `asset_code`, or remove `#LCT-0321`                            | `[TBD]`  |
| Unit subtype              | `vehicle_type` enum only                  | Add `subtype`, or display the enum only                            | `[TBD]`  |
| Vehicle clearance / draft | `vehicles.clearance_cm`                   | —                                                                   | Done     |
| Current load              | `capacity` only                           | Add `current_load`, or remove “Live Payload”                       | `[TBD]`  |
| Water speed               | `speed_kmh`, displayed as km/h             | —                                                                   | Done — decision taken: display km/h, no separate water-speed field |
| Battery and endurance     | Not in `vehicle_telemetry`                | Add fields, or remove the battery card                             | `[TBD]`  |
| Crew profile              | Removed                                   | Crew Profiles are out of scope for the pilot (`AGENTS.md`)         | Out of scope |
| Crew certification        | Removed                                   | Same as Crew profile above                                         | Out of scope |
| Distress detail           | `sos_requests` has `contact_note` only    | Add structured counts, vulnerability and water depth/trend         | `[TBD]`  |
| Report-to-SOS link        | `sos_requests` has no report id           | Add a link or state that they are separate records                 | `[TBD]`  |
| Mission history           | `dispatch_events` table (created/assigned/dispatched/en_route/arrived/completed/cancelled); `GET /api/v1/dispatch/{id}/events` | — | Done (F-4) |
| Complete / cancel         | `POST /sos/{id}/arrive` + `POST /sos/{id}/resolve` (complete); `POST /dispatch/{id}/undo` (cancel) | — | Done |
| Reroute                   | Routing endpoint only                     | Add a mission reroute contract with audit and collision handling   | `[TBD]`  |
| Comms stream              | Removed                                   | Comms Streams are out of scope for the pilot (`AGENTS.md`)         | Out of scope |
| Radio channel             | Removed                                   | Same as Comms stream above                                         | Out of scope |
| Broadcast ping            | Removed                                   | Civic Broadcasts are out of scope for the pilot (`AGENTS.md`)      | Out of scope |
| Support unit request      | `POST /api/v1/sos` or reassignment        | Choose one behaviour and define idempotency                        | `[TBD]`  |
| Air-asset escalation      | Removed                                   | Air-Asset Escalation is out of scope for the pilot (`AGENTS.md`)   | Out of scope |
| Safe haven                | Removed                                   | Evacuation Centers are out of scope for the pilot (`AGENTS.md`)    | Out of scope |
| Route depth and distance  | Route response has segments and ETA       | Add route distance and maximum depth, or derive them client-side   | `[TBD]`  |
| Telemetry freshness       | No stale threshold in UI                  | Return `recorded_at` and stale/offline state                       | Proposed |
| Evacuation capacity       | Removed                                   | Evacuation Centers are out of scope for the pilot (`AGENTS.md`)    | Out of scope |

The UI 4 figures — 14 active SOS, a 2/6 payload, 14.8 knots, 88% battery,
4.2 km remaining, a 6.8 km corridor, 1.2 m route depth and a 450-person center
with 180 free — are demo values. None may be presented as live without a field,
source and timestamp.

The 2025 report identifier in UI 2, the 2025 bulletin in UI 3 and the ticket
`#FR-0248` in UI 4 also disagree. They must be generated from the record, not
hard-coded.

### API calls used by the editor

| Purpose          | Endpoint                           | Status      |
| ---------------- | ---------------------------------- | ----------- |
| Road network     | `GET /api/v1/network/state`        | Implemented |
| Active hazards   | `GET /api/v1/hazards/active`       | Done        |
| Create hazard    | `POST /api/v1/hazards`             | Done        |
| Update hazard    | `PATCH /api/v1/hazards/{id}`       | Done        |
| Withdraw hazard  | `PATCH /api/v1/hazards/{id}` with `active=false` | Done — no separate DELETE; withdraw is a PATCH |
| Hazard stream    | `GET /api/v1/hazards/stream` (SSE) | Done        |
| Vehicles         | `GET /api/v1/vehicles`             | Done        |
| SOS queue        | `GET /api/v1/sos`                  | Done        |
| Sensor readings  | `GET /api/v1/sensors`              | Done        |
| Report evidence  | `GET /api/v1/reports/{id}`         | Done        |
| Session and role | `GET /api/v1/auth/me`              | Done        |

### API calls used by report verification

| Purpose                  | Endpoint                                    | Status  |
| ------------------------ | ------------------------------------------- | ------- |
| Report detail            | `GET /api/v1/reports/{id}`                  | Done |
| Original evidence        | `GET /api/v1/reports/{id}/photo`            | Done — single evidence photo, not a generic `{asset}` route |
| Add internal note        | `POST /api/v1/reports/{id}/notes`           | Done |
| Hold report              | `POST /api/v1/reports/{id}/hold`            | Done |
| Escalate report          | `POST /api/v1/reports/{id}/escalate`        | Done |
| Reject report            | `POST /api/v1/reports/{id}/reject`          | Done |
| Mark duplicate           | `POST /api/v1/reports/{id}/reject` with `duplicate_of` | Done — folded into reject |
| Approve report           | `POST /api/v1/reports/{id}/approve`         | Done |
| Rank dispatch candidates | No endpoint                                 | `[TBD]` |
| Preview rescue route     | `GET /api/v1/dispatch/{id}/preview`         | Done |
| Assign unit              | `POST /api/v1/sos/{id}/assign`              | Done |
| Neighbouring sensors     | `GET /api/v1/reports/{id}/nearest-sensor`   | Done — nearest sensor, not a list by proximity |
| Decision audit           | `GET /api/v1/reports/{id}/log`              | Done |

### API calls used by the published alert

| Purpose               | Endpoint                                 | Status  |
| --------------------- | ---------------------------------------- | ------- |
| Active public hazards | `GET /api/v1/hazards/active`             | Done |
| Hazard detail         | `GET /api/v1/hazards/{id}`               | Done |
| Bulletin detail       | No endpoint                              | Out of scope |
| Create bulletin       | No endpoint                              | Out of scope |
| Publish bulletin      | No endpoint                              | Out of scope |
| Revise bulletin       | No endpoint                              | Out of scope |
| Withdraw bulletin     | No endpoint                              | Out of scope |
| Delivery status       | No endpoint                              | Out of scope |
| Public bulletin URL   | No endpoint                              | Out of scope |
| Evacuation centers    | No endpoint                              | Out of scope |
| Sensor readings       | `GET /api/v1/sensors`                    | Done |
| Public hazard stream  | `GET /api/v1/hazards/stream`             | Done |
| Hazard update         | `PATCH /api/v1/hazards/{id}`             | Done |
| Hazard withdrawal     | `PATCH /api/v1/hazards/{id}` with `active=false` | Done — no separate DELETE |

### API calls used by rescue tracking

| Purpose              | Endpoint                               | Status  |
| -------------------- | -------------------------------------- | ------- |
| Unit detail          | `GET /api/v1/vehicles/{id}`            | Done |
| Fleet list and task  | `GET /api/v1/vehicles`                 | Done |
| Manual unit status   | `PATCH /api/v1/vehicles/{id}`          | Done — generic update, not a dedicated `/status` route |
| Telemetry stream     | `GET /api/v1/vehicles/stream` (SSE)    | Done |
| Telemetry batch      | `POST /api/v1/vehicles/{id}/telemetry` | Done |
| Distress detail      | `GET /api/v1/sos/{id}`                 | Done |
| Distress queue       | `GET /api/v1/sos`                      | Done |
| Active task detail   | No endpoint                            | `[TBD]` — use `GET /api/v1/vehicles/{id}/mission` or `GET /api/v1/sos/{id}` |
| Rescue route preview | `GET /api/v1/dispatch/{id}/preview`    | Done |
| Rank candidates      | No endpoint                            | `[TBD]` |
| Assign unit          | `POST /api/v1/sos/{id}/assign`         | Done |
| Reroute mission      | No endpoint                            | `[TBD]` |
| Complete mission     | `POST /api/v1/sos/{id}/resolve`        | Done |
| Cancel mission       | `POST /api/v1/dispatch/{id}/undo`      | Done |
| Request support      | `POST /api/v1/sos` or reassignment     | `[TBD]` |
| Mission timeline     | `GET /api/v1/dispatch/{id}/events`     | Done (9 Nov 2026) |
| Comms history        | No endpoint                            | Out of scope |
| Send comms message   | No endpoint                            | Out of scope |
| Radio link           | No contract                            | Out of scope |
| Broadcast ping       | No contract                            | Out of scope |
| Air-asset escalation | No contract                            | Out of scope |
| Safe haven detail    | No endpoint                            | Out of scope |

## 10. Role and Permission Matrix

Roles follow `TSD` §Database Design — users.

| Capability                           | SUPER_ADMIN (Head) | ADMIN (Dispatcher) | RESPONDER / PUBLIC_DRIVER |
| ------------------------------------ | :-----------------: | :----------------: | :------------------------: |
| Sign in to the admin portal          |         Yes          |         Yes         |             No              |
| View dashboard and queue             |         Yes          |         Yes         |             No              |
| View masked reporter identity        |         Yes          |         Yes         |             No              |
| Reveal reporter contact (audited)    |         Yes          |       `[TBD]`       |             No              |
| Triage: reject, hold, escalate       |         Yes          |         Yes         |             No              |
| Approve and dispatch                 |         Yes          |         Yes         |             No              |
| Create hazard draft                  |         Yes          |         Yes         |             No              |
| Publish or withdraw hazard           |         Yes          |       `[TBD]`       |             No              |
| View civic broadcasts                |         Yes          |         Yes         |             No              |
| Publish or withdraw bulletin         |         Yes          |       `[TBD]`       |             No              |
| Share or send bulletin               |         Yes          |       `[TBD]`       |             No              |
| Approve public imagery               |       `[TBD]`        |         No          |             No              |
| View evacuation capacity             |         Yes          |         Yes         |             No              |
| Manage evacuation centers            |         Yes          |         No          |             No              |
| View fleet                           |         Yes          |         Yes         |             No              |
| View unit telemetry and task         |         Yes          |         Yes         |             No              |
| View crew identity and certification |         Yes          |       `[TBD]`       |             No              |
| View comms stream                    |         Yes          |       `[TBD]`       |             No              |
| Send comms or broadcast ping         |         Yes          |       `[TBD]`       |             No              |
| Reroute an active unit               |         Yes          |         Yes         |             No              |
| Complete or cancel a mission         |         Yes          |       `[TBD]`       |             No              |
| Request support or air escalation    |         Yes          |       `[TBD]`       |             No              |
| Assign or reassign a unit            |         Yes          |         Yes         |             No              |
| View sensors and advisories          |         Yes          |         Yes         |             No              |
| Configure sensor thresholds          |         Yes          |         No          |             No              |
| Manage users and roles               |         Yes          |         No          |             No              |
| Export incident and audit records    |         Yes          |       `[TBD]`       |             No              |

`RESPONDER` (a field responder, typically linked to a rescue unit) and
`PUBLIC_DRIVER` (the general public) are both driver-app roles with
identical, non-privileged API access and no admin portal access. An earlier
revision of this matrix carried a speculative `LGU_COMMANDER` role, column
removed -- `FSD.md` ACT-002 already notes a commander "is not distinguished
from dispatcher," so it was never a role distinct from `ADMIN`. The matrix
is a proposal until the client confirms who may publish hazards and public
bulletins. `FSD-FR-092` requires the decision to be explicit and enforced by
the API, not only by hiding buttons.

## 11. Accessibility and Usability

`NFR-011` requires keyboard-reachable controls, visible focus and AA contrast.
`NFR-023` requires colour to be paired with a text or shape cue.

Baseline requirements:

- Every icon-only button has an accessible name and a tooltip.
- The barrier toggle has a programmatic label, not an empty `<label>`.
- Colour swatches have text labels and selected state; colour is never the only
  severity cue.
- Form labels are associated with inputs; errors are linked with
  `aria-describedby`.
- Validation errors are announced through an `aria-live` region.
- Dialogs trap focus, close on Escape and restore focus.
- The map has a keyboard path to pan, zoom and select; drawing has a coordinate
  entry fallback.
- Focus rings remain visible on navy and sky surfaces.
- The pulsing status dot respects `prefers-reduced-motion`.
- Minimum body text is 12px; 9px text is decorative only.
- Contrast is checked for `sky-600` on white, `slate-500` on `slate-50`, and
  white on `rose-600`.

The UI 1 empty toggle label, unlabelled colour swatches and 9px meaningful text
do not meet this baseline. UI 2 adds the following issues:

- Evidence photo alt text must describe the evidence, not just "Flooded Street";
  the map image must not be a decorative stock photo.
- The photo confidence badge and the check icon need text equivalents.
- The full phone number must be masked and not exposed in the accessible name.
- The action bar must remain reachable without scrolling past the entire card.
- The status badge must not rely on amber colour alone.
- The operations log must be a list with actor, time and entry semantics.
- The map pin's pulsing animation must respect `prefers-reduced-motion`.

UI 3 adds these issues:

- The sidebar is hidden below `md` with no menu replacement; navigation must
  remain reachable.
- “Live Public Broadcast”, sensor states and channel states use colour and pulse
  alone; each needs a text label and a timestamp.
- The map is a stock image with an SVG overlay; it has no accessible geographic
  meaning and must become a real MapLibre map.
- Public imagery needs meaningful alt text that describes the evidence, not
  “Ground Photo” or “CCTV Photo”.
- The print stylesheet must preserve headings, hazard levels, areas and times;
  “Print PDF” must not print admin-only metadata.
- The public alert must remain readable at 200% zoom and in a single column.

UI 4 adds these issues:

- The unit status, SOS beacon and “Distress Target Beacon” rely on colour and
  pulse; each needs a text state and a timestamp.
- The map is a simulated SVG with no base map; route, flood zones and unit
  position have no accessible geographic meaning. Use MapLibre and provide a
  text route summary.
- Icon-only zoom and layer controls lack accessible names; the layer buttons do
  not expose which layer is active.
- The unit, payload, ETA and battery values use 9–10px labels and 30px numerals
  without a unit or source in the accessible name.
- The timeline uses a visual progress bar and opacity alone; expose an ordered
  list with state, time and actor.
- The comms stream has no list semantics, author role or time element.
- “Telemetry Synced Just Now” is not a timestamp and must not be announced as
  live without a recorded time.
- The crew name is PII; do not place it in the accessible name of a card or
  expose it to roles that cannot see it.
- The distress photo needs meaningful alt text and an internal-only label; do
  not describe vulnerable people in public-facing copy.
- The 2/6 payload and “4 slots available” must be text, not a colour or icon
  only, and must not imply capacity is current if the field is absent.

## 12. Traceability

| FSD reference  | Capability                      | UI coverage                                                   | Baseline action                                      |
| -------------- | ------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| FSD-FR-018–023 | Login and session               | Implemented: API sign-in, session token, 401 returns to `/login` | Keep; API-issued tokens (ADR-021)                  |
| FSD-FR-024–031 | Queue, filters, search          | Implemented: `/triage` queue, filters, search and dismiss     | Keep                                                 |
| FSD-FR-032–038 | Incident detail and evidence    | Implemented: docket, narrative, evidence viewer, original file, plausibility, operations log | Keep                                |
| FSD-FR-039–046 | Triage actions and log          | Implemented: reject, hold, escalate, notes, approve, confirmation, undo, resolve | Keep                                |
| FSD-FR-047     | Override and decision audit     | Partial: hash-chained writes and CSV export; no audit view    | Add an audit view                                    |
| FSD-FR-048     | User and role management        | Implemented: `/users` CRUD with role guards                   | Keep                                                 |
| FSD-FR-049     | Export records                  | Implemented: `/export` audit and incident CSV                 | Keep                                                 |
| FSD-FR-075     | Live map layers                 | Implemented: MapLibre live network, hazard, fleet, SOS and sensor layers | Keep                                      |
| FSD-FR-076     | Fleet status                    | Implemented: `/fleet` list and unit detail                    | Keep                                                 |
| FSD-FR-077     | Moderation queue                | Implemented: queue and selection flow on `/moderation`        | Keep; add decided-report history when audit view lands |
| FSD-FR-078     | Evidence, EXIF, plausibility    | Partial: evidence viewer, EXIF, camera GPS and claimed-point plausibility on `/moderation` | Add claimed-vs-EXIF distance check |
| FSD-FR-079     | Nearest gauge cross-reference   | Implemented: nearest rain gauge in the report desk; CCTV is out of scope | Keep                                       |
| FSD-FR-080     | Approve and publish             | Implemented: approve publishes a hazard behind a confirmation step | Keep; show the resulting hazard on the map |
| FSD-FR-081     | Reject or duplicate with reason | Implemented: required reason and duplicate target             | Keep |
| FSD-FR-082     | Draw flood polygon              | Implemented: polygon draw, validation and publish             | Keep                                                 |
| FSD-FR-083     | Draw closure line               | Implemented: line draw and withdraw; not snapped to a road edge | Snap to the nearest edge                           |
| FSD-FR-084     | Obstruction level               | Implemented: `CAUTION`, `LEVEL_2`, `LEVEL_3`, `IMPASSABLE`    | Keep                                                 |
| FSD-FR-085     | Publish, update, withdraw       | Implemented: create, update, publish and withdraw             | Keep; add expiry                                     |
| FSD-FR-086     | SSE updates                     | Implemented: hazard, SOS and fleet streams reconcile live state | Keep                                               |
| FSD-FR-087     | Distress incident               | Implemented: SOS intake, dispatcher call-in and map markers   | Keep                                                 |
| FSD-FR-088     | Rank available units            | Implemented: flood-safe ETA ranking                           | Keep                                                 |
| FSD-FR-089     | Assign and preview route        | Implemented: candidate selection, API preview and confirmation | Keep                                                |
| FSD-FR-090     | Sensor ingestion                | Partial: registry CRUD and readings; simulated flag not shown | Show the simulated flag                              |
| FSD-FR-091     | Advisory roads                  | Partial: impact-radius advisories and routing penalty; no flood-state view | Add the flood-state view                 |
| FSD-FR-092     | Role enforcement                | Implemented: portal guards and API role checks                | Keep                                                 |
| FSD-FR-093     | Immutable audit                 | Partial: hash-chained writes and verification; no audit view  | Add an audit view                                    |
| Not in FSD     | Civic broadcasts                | Partial: UI 3 public alert                                    | Scope decision; add requirements or drop the screen  |
| Not in FSD     | Evacuation centers              | Partial: UI 3/4 cards                                         | Scope decision; add requirements or drop the card    |
| Not in FSD     | Crew, comms and air escalation  | Partial: UI 4 crew, stream and actions                        | Scope decision; add requirements or remove           |

## 13. Implementation Slices

No slice starts until this baseline is accepted.

| Slice | Output                                                        | FSD reference           | Verification                          |
| ----- | ------------------------------------------------------------- | ----------------------- | ------------------------------------- |
| A     | Shell, tokens, login, dashboard, queue, report verification   | FSD-FR-018–049          | Component tests; visual review        |
| B     | Map foundation, network, hazards, fleet, SOS layers           | FSD-FR-075–076          | Map render and layer tests            |
| C     | Hazard editor: draw, edit, validate, save, publish, withdraw  | FSD-FR-082–086          | Geometry validation, publish tests    |
| D     | Moderation and evidence desk                                  | FSD-FR-077–081          | Approve, reject, duplicate tests      |
| E     | Dispatch: queue, ranking, route preview, assignment, tracking | FSD-FR-087–089          | Ranking, assignment and mission tests |
| F     | Sensors and advisories                                        | FSD-FR-090–091          | Threshold and impact tests            |
| G     | Administration, roles, audit, export                          | FSD-FR-047–049, 092–093 | RBAC and audit tests                  |
| H     | Public advisory and civic broadcast (conditional)             | Not in FSD              | Scope decision; CR/FSD extension      |

UI 1's editor is slice C. Slices A and B are prerequisites because the
editor needs the shell, session and map. UI 4's rescue tracking is slice E and
depends on the dispatch ranking and route preview. UI 3's broadcast screen is
slice H and must not start until its scope and delivery channels are approved.
UI 4's crew, comms, safe haven and air escalation are also conditional; they are
not part of slice E until their scope decisions are closed.

## 14. Open Design Decisions

These are design-phase decisions, separate from requirement identifiers.

| ID    | Decision                                                                       | Owner              | Needed by |
| ----- | ------------------------------------------------------------------------------ | ------------------ | --------- |
| OD-01 | Does admin scope include user management and audit screens?                    | Client / PM        | Slice A   |
| OD-02 | Are Evacuation Centers and Civic Broadcasts in scope? UI 3/4 supply them.      | Client             | Slice H   |
| OD-03 | Who may publish and withdraw hazards: dispatcher, commander or both?           | Client / PM        | Slice C   |
| OD-04 | Keep or remove "Estimated residents" and "Physical barrier"?                   | Client / BA        | Slice C   |
| OD-05 | Keep or remove "Suggested reroute" and its free-text field?                    | Client / BA        | Slice C   |
| OD-06 | Is a closure bound to a road edge, or drawn freely?                            | Backend / Frontend | Slice C   |
| OD-07 | Are draft revisions required for published hazards?                            | Backend / PM       | Slice C   |
| OD-08 | What is the hazard conflict policy when SSE updates the open record?           | Frontend / Backend | Slice C   |
| OD-09 | What are the sensor thresholds and impact radius?                              | Client / Data      | Slice F   |
| OD-10 | Which fields are exportable, and in what format?                               | Client / PM        | Slice G   |
| OD-11 | Confirm the exact role names and role-to-screen mapping.                       | Client / Backend   | Slice A   |
| OD-12 | Confirm the visual source for screens the UIs do not cover.                    | Client             | Slice A   |
| OD-13 | What reporter contact data may dispatchers see, and who may reveal it?         | Client / DPO       | Slice A   |
| OD-14 | Should approval and dispatch remain one flow or two separate actions?          | Client / PM        | Slice A   |
| OD-15 | Is the escalation target BFP/Coast Guard, or does PNP belong in scope?         | Client / PM        | Slice A   |
| OD-16 | What is the canonical depth range and unit shown to dispatchers?               | Client / Data      | Slice A   |
| OD-17 | Which source labels replace "Citizen Mobile App v2.4"?                         | Client / Backend   | Slice A   |
| OD-18 | Should nearest-unit ranking show ETA, distance or both?                        | Client / Backend   | Slice E   |
| OD-19 | What model produces the photo "authentic" confidence, and how is it labelled?  | Backend / QA       | Slice D   |
| OD-20 | How are barangay sectors derived, and is "Sector 4B" authoritative?            | Client / Data      | Slice A   |
| OD-21 | Which broadcast channels are real, and which remain labelled demos?            | Client / PM        | Slice H   |
| OD-22 | Who may publish, revise, share and withdraw a public bulletin?                 | Client / PM        | Slice H   |
| OD-23 | May citizen or CCTV imagery appear publicly, and under what consent rules?     | Client / DPO       | Slice H   |
| OD-24 | What is the source and owner of evacuation-center capacity data?               | Client / LGU       | Slice H   |
| OD-25 | Which public alert vocabulary maps to the `FSD-FR-084` obstruction levels?     | Client / BA        | Slice H   |
| OD-26 | What expiry, versioning and revision rules apply to a published bulletin?      | Client / Backend   | Slice H   |
| OD-27 | Does "Share Bulletin" copy a link or send a channel message?                   | Client / PM        | Slice H   |
| OD-28 | Is "Print PDF" a browser print or a server-generated public-safe PDF?          | Client / Backend   | Slice H   |
| OD-29 | What counts as sent versus delivered for each channel?                         | Client / Backend   | Slice H   |
| OD-30 | Is the bulletin a public page, an admin preview, or both?                      | Client / PM        | Slice H   |
| OD-31 | What legal authority and approval chain applies to a public warning?           | Client / Legal     | Slice H   |
| OD-32 | Which languages must the public bulletin support?                              | Client / PM        | Slice H   |
| OD-33 | Are crew profiles, names and certifications in scope, and who may see them?    | Client / DPO       | Slice E   |
| OD-34 | Is the comms stream real, demo-only, or out of scope; what is retained?        | Client / Security  | Slice E   |
| OD-35 | What does "Broadcast Ping" send, to whom, and over which channel?              | Client / PM        | Slice E   |
| OD-36 | What does "Signal Immediate Support Unit" create: a new SOS or a reassignment? | Client / Backend   | Slice E   |
| OD-37 | Is air-asset escalation in scope, and which agency owns it?                    | Client / PM        | Slice E   |
| OD-38 | What are mission complete, cancel and reassignment rules?                      | Client / Backend   | Slice E   |
| OD-39 | Should speed show knots or km/h, and is it water speed or road speed?          | Client / Data      | Slice E   |
| OD-40 | Does the vehicle record carry clearance/draft, current load and battery?       | Client / Backend   | Slice E   |
| OD-41 | Is the external asset id real, and is it distinct from the call sign?          | Client / LGU       | Slice E   |
| OD-42 | Are trapped-person counts and vulnerability data structured or free text?      | Client / DPO       | Slice E   |
| OD-43 | Is safe-haven assignment part of dispatch, or only an evacuation-center link?  | Client / PM        | Slice E   |
| OD-44 | Does "biometric beacon" carry health data, and if so under what consent?       | Client / DPO       | Slice E   |
| OD-45 | What is the source of "optimal clearance" and channel-depth guidance?          | Backend / Data     | Slice E   |

Until OD-12 is answered, screens without a UI use the existing prototype layout
and the tokens in this document. No new visual language is invented.

## 15. Design Gate Checklist

- [ ] Visual shell, tokens and navigation accepted by the client.
- [ ] All four supplied UIs reconciled to the FSD.
- [ ] Admin scope decided, including user management and audit.
- [ ] UI-only navigation items resolved.
- [ ] Fleet list, unit detail and mission lifecycle accepted.
- [ ] Crew, comms and air-asset scope decided.
- [ ] Vehicle clearance, load and battery fields accepted or removed.
- [ ] Rescue speed unit and route-depth unit accepted.
- [ ] Distress-person data and access rules accepted.
- [ ] Civic broadcast scope and delivery channels decided.
- [ ] Public bulletin lifecycle, expiry and revision rules accepted.
- [ ] Public imagery, consent and redaction policy accepted.
- [ ] Evacuation-center data source and ownership accepted.
- [ ] Public alert role matrix accepted.
- [ ] Delivery-status model accepted.
- [ ] UI 3 and UI 4 palette drift normalised to the approved tokens.
- [ ] UI 4 speed and depth units normalised.
- [ ] Report status model and action gating accepted.
- [ ] Reporter PII masking and contact-reveal policy accepted.
- [ ] Approve-versus-dispatch flow accepted.
- [ ] Escalation targets aligned to `FSD-FR-040`.
- [ ] Depth unit and range accepted.
- [ ] Obstruction levels aligned to `FSD-FR-084`.
- [ ] Draft, publish and withdraw model accepted.
- [ ] Hazard metadata fields approved or removed.
- [ ] Closure-to-road-edge binding decided.
- [ ] Role and permission matrix approved.
- [ ] API deltas added to `TSD` and `api.md`.
- [ ] FSD screen specifications updated where the UIs add fields.
- [ ] Accessibility corrections accepted.
- [ ] Traceability reviewed by QA.
- [ ] Design gate signed off.

Sign-off roles: Client Representative, Project Adviser, Project Team Lead,
Frontend Lead, Backend Lead and QA Lead. Names remain `«placeholder»` until the
Charter is completed.

## 16. What This Document Does Not Approve

- It does not approve implementation or a sprint.
- It does not close the Requirements phase.
- It does not confirm budget, dates or staffing.
- It does not add Evacuation Centers, Civic Broadcasts, resident estimates or
  physical-barrier tracking to the requirements baseline, even though UI 3
  supplies a Civic Broadcasts screen and UI 4 supplies an evacuation-center card.
- It does not approve crew profiles, comms retention, radio integration,
  broadcast ping, air-asset escalation, support requests or biometric data,
  even though UI 4 shows them.
- It does not approve SMS, cell broadcast, siren or other public-warning
  delivery, evacuation-center management, or the publication of citizen
  evidence.
- It does not authorise use of the supplied UIs' CDN scripts or external images
  in production.
