# MetroFlow - Required Features and Deliverables

**As of:** November 8, 2026
**Documentation Source:** FSD.md, TSD.md, PROGRESS_REPORT.md

---

## ✅ Implemented Features

### 1. Core Network & Routing (FSD-FR-001 to FR-017)
- **Network state API** - Return passability per edge with GeoJSON collections
- **Clearance-aware routing** - A* algorithm with water depth and vehicle clearance
- **Route passability logic** - Exclude edges where water depth >= clearance
- **Distance and ETA calculation** - Per-segment status and travel time
- **Error handling** - 404 for no safe route, 404 for unknown nodes
- **Bidirectional roads** - Treat roads as bidirectional
- **Zero-length routes** - Allow origin == destination with degenerate line
- **Rainfall simulation** - Apply rainfall events, compute runoff and ponding depth
- **Simulation overrides** - Manual overrides outrank simulation until cleared

### 2. Authentication & Access Control (FSD-FR-018 to FR-023, FR-092, FR-093)
- **Login screen** - Email and password fields, both required
- **Password visibility toggle** - Show/hide password
- **Forgot password** - Affordance stating how to obtain reset
- **Authentication** - POST /api/v1/auth/login, reject invalid credentials
- **Session management** - Maintain session, end on sign-out
- **Role-based access control** - Restrict screens and actions by role
- **JWT tokens** - API-issued HS256 session tokens
- **Password hashing** - bcrypt-hashed on users table
- **Registration** - Create driver accounts only (not ADMIN or SUPER_ADMIN)
- **User profile** - GET /api/v1/auth/me returns caller from token
- **Route enforcement** - Bearer token required on all routes except auth endpoints
- **Role permissions** - Enforce on verification, publishing, dispatch, configuration
- **Request limits** - Rate limiting per client address (login, register, SOS, simulation)
- **Audit trail** - Immutable audit record for every privileged action

### 3. Incident Queue & Triage (FSD-FR-024 to FR-031)
- **Urgency-ordered queue** - List incidents by descending urgency score
- **Incident cards** - Show report id, urgency, location, reporter, age, evidence tags
- **Source filtering** - Filter by all, photo, sensor mismatch, escalated with counts
- **Search** - Search by report id, reporter, location, barangay
- **Empty state** - Explicit empty state when no incident matches
- **Selection** - Load selected incident into detail panel and mark as selected
- **Dismiss** - Remove dismissed incident from active count without deletion
- **Auto-refresh** - Refresh queue when new reports arrive (10s polling)

### 4. Incident Detail & Operations (FSD-FR-032 to FR-038)
- **Docket display** - Report id, severity level, reporter, filing time, confidence score
- **Witness narrative** - Show narrative from reporter
- **Photo evidence** - Show photo with capture metadata and estimated submersion range
- **Location context** - Show location, sensor context, nearest rescue unit, rising-water indicators
- **Operations log** - Show chronological operations log, scroll to newest entry
- **Internal notes** - Allow adding internal notes to operations log
- **Evidence file** - Allow opening original evidence file

### 5. Dispatch Actions (FSD-FR-039 to FR-046)
- **Reject** - Reject incident as false alarm with required reason
- **Escalate** - Escalate to BFP or Coast Guard with required reason
- **Hold** - Hold incident pending sensor update with required reason
- **Approve/Dispatch** - Approve incident and dispatch assigned rescue unit
- **Audit logging** - Timestamped entry naming actor for every action
- **Persistence** - Persist every action to backend with required reason
- **Confirmation** - Require confirmation before dispatch
- **Undo window** - Offer short undo window (5 seconds)
- **State constraints** - Constrain action set by incident state (dispatched cannot be re-dispatched)
- **Integrity hash** - Record decisions with actor, payload, timestamp, integrity hash

### 6. Audit & Administration (FSD-FR-047 to FR-049)
- **Hash-chained write path** - Tamper-evident audit logs
- **Audit read API** - GET /api/v1/audit (newest first, filterable by action and actor)
- **Audit verification** - GET /api/v1/audit/verify
- **User management** - CRUD endpoints for users (GET, POST, PATCH, DELETE)
- **User audit trail** - All user changes audited (USER_CREATE, USER_UPDATE, USER_DELETE)
- **User security** - Role validation, email uniqueness, self-protection, last admin protection
- **User management UI** - Search, role badges, create/edit modals, delete confirmation
- **Export** - CSV export for audit logs and incidents
- **Export filtering** - Optional filtering by action_type, user_id, status
- **Export UI** - One-click export buttons with toast notifications

### 7. Operations (FSD-FR-050 to FR-053)
- **Health endpoint** - GET / reporting service identity and status
- **Security headers** - Baseline security headers on every API response
- **OpenAPI contract** - Machine-readable contract at /openapi.json
- **Idempotent seed** - Seed demonstration corridor on first boot without duplication

### 8. Driver Navigation (FSD-FR-054 to FR-064)
- **Destination entry** - Search seeded road nodes or select point on map
- **Route request** - Request route from device location to destination, snap to nearest nodes
- **Route rendering** - Render active route, remaining distance, ETA on mobile map
- **Turn-by-turn instructions** - Manoeuvre, road name, distance to next step
- **GPS advancement** - Advance instruction from GPS position
- **Arrival detection** - Announce arrival when destination reached
- **Hazard stream** - Subscribe to verified hazard event stream (SSE)
- **Incremental updates** - Apply hazard updates without reload
- **Hazard intersection** - Detect when new verified hazard intersects remaining route
- **Auto-rerouting** - Recalculate route automatically around intersecting hazard
- **Manual refresh** - Offer manual refresh and alternative route when auto-rerouting fails
- **Proximity alerts** - Alert when within configured warning radius of verified hazard
- **Alert details** - Show hazard kind, obstruction level, distance, recommended action

### 9. Field Reporting (FSD-FR-065 to FR-067)
- **Depth selection** - Submit with Ankle-Deep, Knee-Deep, or Impassable
- **Photo capture** - Capture with device camera or attach existing image
- **GPS attachment** - Attach GPS coordinates, EXIF metadata, capture time, device time
- **Live GPS** - High-accuracy GPS with accuracy fallback
- **Duplicate detection** - Warning alerts for duplicate reports
- **Offline-safe draft** - Preserve reports in offline-safe draft with retry

### 10. Telemetry & SOS (FSD-FR-072 to FR-074)
- **Telemetry throttling** - Batched vehicle telemetry max once per 5 seconds during navigation
- **SOS trigger** - One-tap SOS with current location and optional contact note
- **SOS GPS** - Real GPS fix (<60s freshness required)
- **SOS acknowledgement** - Display acknowledgement, assignment, resolution status
- **Telemetry endpoint** - POST /api/v1/vehicles/{id}/telemetry

### 11. Live Operational Map (FSD-FR-075, FR-076)
- **MapLibre rendering** - Render live network, hazard, closure, fleet, SOS layers
- **Fleet display** - Show each rescue unit's call sign, type, status, active task

### 12. Moderation & Evidence (FSD-FR-077 to FR-081)
- **Moderation queue** - Load from report API ordered by urgency score
- **Evidence viewer** - Display photo evidence, EXIF, capture time, location plausibility check
- **Approve action** - Approve report, create and publish verified hazard in one action
- **Reject action** - Reject with required reason
- **Duplicate marking** - Mark as duplicate with required reason
- **Audit logging** - All moderation actions audited
- **Nearest-gauge cross-reference** - `GET /api/v1/reports/{id}/nearest-sensor` returns the closest active rain gauge, its latest reading, distance and breach state (FSD-FR-079); the report desk shows it beside the evidence

### 13. Hazard Authoring (FSD-FR-082 to FR-086)
- **Polygon drawing** - Draw flood polygon with at least three vertices
- **Closure drawing** - Draw road closure as line along road network
- **Obstruction levels** - Assign Caution, Level 2, Level 3, or Impassable
- **Publish/Update/Withdraw** - Publish, update, or withdraw drawn hazard
- **Broadcast changes** - Broadcast changes via SSE
- **Hazard stream** - Live SSE event stream at /api/v1/hazards/stream

### 14. Distress & Dispatch (FSD-FR-087 to FR-089)
- **Incident creation** - Create distress incident from SOS or dispatcher entry, show on map
- **Unit ranking** - Rank available units by flood-safe travel time to distress incident
- **Unit assignment** - Assign unit with route preview before confirmation
- **Route preview** - Preview flood-safe rescue route with optional vehicle_id parameter
- **BRULE-011** - Only available units assignable; undo or reject releases them
- **Three-step dispatch:** Publish hazard → Select unit → Confirm route

### 15. Sensor Ingestion (FSD-FR-090, FR-091)
- **Reading ingestion** - Ingest river gauge and rain gauge readings with sensor identity and timestamp
- **Sensor validation** - Sensor must be known and active
- **Timestamp validation** - Timestamp cannot be in the future
- **Threshold breach detection** - Compare reading against configured threshold
- **Impact radius marking** - Mark roads within configured impact radius of threshold breach as advisory
- **BRULE-012** - Advisory until dispatcher confirms
- **Sensor registry CRUD** - GET, POST, PATCH, DELETE for sensors
- **Sensor audit trail** - SENSOR_CREATE, SENSOR_UPDATE, SENSOR_DELETE, SENSOR_BREACH
- **Impact radius edge marking** - PostGIS ST_DWithin query to find impacted edges
- **Test coverage** - Integration tests for sensor reading rejection and CRUD operations

### 16. Portal & Driver App UI (FSD-FR-054 to FR-089)
- **Portal pages** - /login, /triage, /dashboard, /radar, /fleet, /hazards, /moderation, /sensors, /users, /export
- **Real sign-in** - Against API, token in sessionStorage, 401 returns to /login
- **Live data** - SOS, reports, vehicles, hazards load live from API
- **Incident detail drawer** - Links evidence photos with EXIF, submersion ranges, nearest-unit ETA, water dynamics
- **Dispatch by vehicle_id** - Assign by backend vehicle_id instead of hardcoded id
- **PII protection** - Phone numbers masked by default
- **Units** - cm for depths/clearance, km/h for speed
- **Colors** - slate-900 primary, emerald-500 success
- **Out of scope disabled** - Civic Broadcasts, Evacuation Centers, Air-Asset Escalation
- **Driver app tabs** - Map, Report, SOS, Profile
- **Driver navigation screen** - Destination search, route queries, turn-by-turn, GPS advance, proximity alerts, SSE rerouting
- **Guest mode** - Browse app, but SOS/report requires sign-in
- **Profile** - Display clearance in cm
- **Offline screen** - Reports what is actually cached on the device: road graph, hazard count, last route and size on disk. Basemap tiles stay out of scope (TSD LIM-017)
- **AuthProvider** - Mounted in root layout

### 17. Offline Operation (FSD-FR-068 to FR-071)
- **Offline report queue** - Unsent reports are queued in order with a visible pending banner; a photo is copied next to the queue so an OS purge cannot lose it
- **Ordered sync** - On reconnect the queue drains oldest-first, and a `client_id` sent with each report makes a replay after a lost response return the original report instead of a duplicate
- **Local cache** - The road graph, active hazards and the most recent route are cached in on-device SQLite (`expo-sqlite`) and rendered when the network is unavailable
- **Offline routing** - A client-side port of the same time-dependent A* plans a new route over the cached graph with the same hazard-blocking rule (BRULE-008)
- **Out of scope** - Basemap tile download (TSD LIM-017)

---

## 🔄 Partial Implementation

### 1. Portal and Driver App UI (FSD-FR-054 to FR-089)
- **Status:** Partial
- **Implemented:** All core screens and functionality
- **Missing:** Some UI polish and advanced features (portal is template-derived, driver app covers shells)
- **Status:** Partial (portal is template-derived; driver app covers map, route, report, SOS and profile shells)

---

## 🎯 Scope Constraints (Out of Scope)

The following features are explicitly out of scope per the approved project scope (`AGENTS.md`, `BACKLOG.md`):

- Public App Store/Play Store releases (use emulator or tethered device)
- Civic Broadcasts table and features
- Evacuation Centers table and features
- Crew Profiles table and features
- Comms Streams table and features
- Native telephony/SMS in SOS
- Functional SQLite tile caching for offline maps
- Real CCTV integration
- Real rain-gauge integration (sensor readings are implemented, but real hardware integration is out of scope)

---

## 📊 Implementation Summary

| Category | Status | Count |
|----------|--------|-------|
| Fully Implemented | ✅ | 17 major feature groups |
| Partially Implemented | 🔄 | 1 feature group |
| Out of Scope | ❌ | 8 feature groups |

**Total FSD Requirements:** 93 (FSD-FR-001 to FSD-FR-093)
**Fully Implemented:** ~94% (17 of 18 in-scope feature groups)
**Partially Implemented:** ~6% (portal/driver-app polish)
