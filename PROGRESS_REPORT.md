# MetroFlow - Progress Report

**Project:** MetroFlow - Intelligent Urban Mobility & Flood Simulation System
**Date:** November 8, 2026
**Branch:** `main`
**Status:** Deployed — portal on Vercel, API as a Vercel Python function, Supabase hosted

---

## Executive Summary

MetroFlow is a dual-interface flood-aware urban mobility system consisting of a FastAPI backend, an LGU web dashboard (`metroflow-admin/`) and an Expo driver app. The system covers flood simulation, clearance-aware routing, SOS/emergency dispatch and flood-hazard publishing. All application data flows through the backend API into Supabase Postgres. Accounts are real: the API issues its own session tokens and checks bcrypt credentials against the `users` table.

This is a working pilot, not a production service. Every route except the four
auth entry points requires a session token, and writes require a portal role
(TSD SEC-001 closed). The API and portal are hosted, so the stack is reachable:
the routes worth abusing — sign-in, registration, SOS creation and the rainfall
simulation — now carry per-address request ceilings answered with `429` and
`Retry-After` (TSD LIM-006 closed for application limits; an edge WAF needs a
paid Vercel plan, LIM-025). The hosted API still connects with the project's
`postgres` role (LIM-023).

---

## 1. Infrastructure & Database

### Database Setup
- **Platform:** Supabase (PostgreSQL 15 + PostGIS extension)
- **Project:** `rswlxrriqwndohibwizb`
- **Connection:** Session Pooler (ap-northeast-2, port 6543) with SSL required
- **Status:** Fully connected and operational

### Schema
| Component | Status | Details |
|---|---|---|
| Core tables | Complete | `road_nodes`, `road_edges`, `live_edge_states`, `users`, `audit_logs` |
| New tables | Complete | `hazard_zones`, `vehicles`, `sos_requests`, `sensors`, `sensor_readings` |
| PostGIS geometry | Complete | Geospatial support for road network and hazard zones |
| RLS | Enabled | Row Level Security enabled on all tables |
| Privileges | Restricted | Restricted to `postgres` and `service_role` roles |

### Accounts
- **Bootstrap dispatcher:** `dispatcher@metroflow.local`, role `SUPER_ADMIN`
- **Provisioning:** created once at startup from `METROFLOW_ADMIN_EMAIL` / `METROFLOW_ADMIN_PASSWORD` when the `users` table is empty
- **Driver accounts:** created by `POST /api/v1/auth/register`, always `EMERGENCY_DRIVER`
- **Escalation:** registration refuses `LGU_DISPATCHER` and `SUPER_ADMIN` with `403`
- **Rotated:** the hosted dispatcher password was changed from the demo default before the API became reachable; the value lives in `backend/.env` on the operator's machine

### Hosting
| Component | Status | Details |
|---|---|---|
| API | Deployed | Vercel project `metroflow-api`, Python 3.12 function, region `icn1`, `https://metroflow-api-siahrays-projects.vercel.app` |
| Portal | Deployed | Vercel Git deployment, root `metroflow-admin`, `https://metroflow-web-lgu.vercel.app` |
| Database | Hosted | Supabase Seoul; the API reaches it through the session pooler |
| Verification | Passing | health `200`; unauthenticated read `401`; sign-in `200` as `SUPER_ADMIN`; network state, vehicles, hazards and SOS `200` with the token; portal origin allowed by CORS and other origins refused |

---

## 2. Backend API (FastAPI)

### Authentication
- **JWT tokens** issued by the API (`PyJWT`, HS256) and returned by `/api/v1/auth/login`
- **Passwords** bcrypt-hashed on the `users` row
- **Login** accepts `LGU_DISPATCHER`, `SUPER_ADMIN` and `EMERGENCY_DRIVER`
- **Registration** creates driver accounts only
- **`GET /api/v1/auth/me`** returns the caller from the token
- **Route enforcement** — every route except the four auth entry points requires a bearer token (`401`); routes that change shared state or read incident data require a portal role (`403` for drivers)
- **Email verification** uses an in-process store (dev mode returns the code); it does not survive a restart
- **Request limits** — `login` (15/min), `register`/`send-verification`/`verify` (10/min), `POST /sos` (20/min) and `simulation/rain` (12/min) per client address, counted in Postgres so the ceiling holds across serverless instances; `429` carries `Retry-After`, and the limiter fails open if the counter table is unreachable
- **Open gap:** a WAF / edge rule is a paid Vercel feature (TSD LIM-025)

### Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/login` | POST | Credential check, returns a session token |
| `/api/v1/auth/register` | POST | Create a driver account |
| `/api/v1/auth/me` | GET | Current user; requires a bearer token |
| `/api/v1/auth/send-verification` | POST | Send verification code |
| `/api/v1/auth/verify` | POST | Verify code |
| `/api/v1/sos` | POST | Create SOS request |
| `/api/v1/sos` | GET | List SOS requests |
| `/api/v1/sos/{id}` | GET | Get single SOS request status (FSD-FR-074) |
| `/api/v1/sos/{id}/reject` | POST | Reject SOS as false alarm with required reason (FSD-FR-039, 044) |
| `/api/v1/sos/{id}/hold` | POST | Hold SOS pending sensor update with reason (FSD-FR-041, 044) |
| `/api/v1/sos/{id}/escalate` | POST | Escalate SOS to BFP / Coast Guard (FSD-FR-040, 044) |
| `/api/v1/sos/{id}/notes` | POST | Append operational note to SOS log (FSD-FR-037, 043) |
| `/api/v1/sos/{id}/log` | GET | Chronological persistent operations log (FSD-FR-036, 043) |
| `/api/v1/dispatch/{id}/undo` | POST | Revert a `confirmed` dispatch and release the unit (FSD-FR-045) |
| `/api/v1/hazards` | POST | Create hazard zone (cm) |
| `/api/v1/hazards` | GET | List hazard zones |
| `/api/v1/hazards/{id}` | PATCH | Update hazard zone |
| `/api/v1/hazards/{id}/publish` | POST | Publish hazard (dispatch step 1) |
| `/api/v1/sos/{id}/assign` | POST | Assign vehicle (dispatch step 2, FSD-FR-046) |
| `/api/v1/dispatch/{id}/confirm` | POST | Confirm dispatch (dispatch step 3, FSD-FR-046) |
| `/api/v1/vehicles` | GET/POST | List/create vehicles |
| `/api/v1/vehicles/{id}` | PATCH | Update vehicle |
| `/api/v1/vehicles/{id}/telemetry` | POST | Telemetry ping with 5s throttle (FSD-FR-072, VAL-020) |
| `/api/v1/network/state` | GET | Road graph with live depths |
| `/api/v1/simulation/rain` | POST | Apply a rainfall event |
| `/api/v1/routing/navigate` | GET | Clearance-aware route |
| `/api/v1/dispatch/{id}/preview` | GET | Rescue route preview with optional vehicle_id (FSD-FR-089) |
| `/api/v1/users` | GET/POST | List/create users (FSD-FR-048) |
| `/api/v1/users/{id}` | PATCH/DELETE | Update/delete users (FSD-FR-048) |
| `/api/v1/sensors/readings` | POST | Submit sensor reading with threshold breach detection (FSD-FR-090) |
| `/api/v1/sensors` | GET/POST | List/create sensors (FSD-FR-091) |
| `/api/v1/sensors/{id}` | PATCH/DELETE | Update/delete sensors (FSD-FR-091) |
| `/api/v1/audit/export` | GET | Export audit logs as CSV (FSD-FR-049) |
| `/api/v1/incidents/export` | GET | Export SOS incidents as CSV (FSD-FR-049) |

---

## 3. LGU Web Dashboard (`metroflow-admin/`, Next.js)

- **Separate pages:** `/login` and the operational screens (`/triage`, `/dashboard`, `/radar`, `/fleet`, `/hazards`, `/users`, `/export`)
- **Real sign-in** against the API; the token is kept in `sessionStorage` and sent on every request, and a `401` returns the operator to `/login`
- **Live data & evidence** — SOS requests, field reports, vehicles and hazards load live from the API. The incident detail drawer links authentic evidence photos with EXIF metadata, estimated submersion ranges, live nearest-unit ETA ranking, water dynamics indicators, and full-resolution evidence file viewing (FSD-FR-032 to 038)
- **Dispatch** assigns the selected fleet unit by its backend `vehicle_id` instead of a hardcoded id
- **User Management (FSD-FR-048)** — `/users` page with user list, search, role badges, create/edit modals, delete confirmation
- **Export (FSD-FR-049)** — `/export` page with CSV export buttons for audit logs and incidents
- **PII protection** — phone numbers masked by default
- **Units:** cm for depths/clearance, km/h for speed
- **Colors:** `slate-900` primary, `emerald-500` success
- **Out of scope disabled:** Civic Broadcasts, Evacuation Centers, Air-Asset Escalation

---

## 4. Driver Mobile App (Expo / React Native)

- **Expo Router tab layout** — Map, Report, SOS and Profile tabs, plus active Navigation screen
- **Driver Navigation (`route.tsx`)** — Destination search with road node selection, clearance-aware route queries, turn-by-turn instructions with road names and manoeuvres, GPS advance, 200m proximity alerts, and SSE hazard stream rerouting (FSD-FR-054 to 064)
- **Field Reporting (`report.tsx`)** — Native camera/photo picker with EXIF metadata retention, high-accuracy GPS fix with last-known position fallback, depth selection (Ankle/Knee/Waist), duplicate warning alerts, and offline-safe draft preservation with retry (FSD-FR-065 to 067)
- **Email/password auth** with a registration path for driver accounts; registration signs in automatically and the token is held for the app session
- **Guest mode** still browses the app, but sending an SOS or a report asks the driver to sign in
- **Profile:** displays clearance in cm
- **Telemetry:** sends throttled (>= 5s) position, speed and heading updates during active navigation (`route.tsx`) to `/api/v1/vehicles/{id}/telemetry` (FSD-FR-072)
- **SOS:** submits to the backend `/api/v1/sos` with real GPS fix (<60s freshness required, VAL-021) and displays post-submission status tracking and refresh (FSD-FR-073 to 074)
- **Offline operation:** the app queues unsent reports with a pending banner and drains them oldest-first on reconnect; each report carries a device-generated `client_id`, so a replay after a lost response returns the original report instead of creating a duplicate. The road graph, active hazards and last route are cached in on-device SQLite (`expo-sqlite`) and rendered offline, and `navigation/offline-route.ts` plans a new route over that cached graph with the same hazard-blocking rule. Basemap tile download stays out of scope (TSD LIM-017)
- **`AuthProvider`** mounted in the root layout

---

## 5. Sensor Service (FSD-FR-090, FSD-FR-091)

- **Sensor Registry** — CRUD endpoints for managing river and rain gauges with threshold configuration and impact radius
- **Sensor Readings** — Gateway submissions with sensor validation, timestamp checks, and threshold breach detection
- **Impact Radius Edge Marking** — PostGIS ST_DWithin query identifies edges within sensor's impact radius on threshold breach (BRULE-012: advisory until dispatcher confirms)
- **Audit Trail** — All sensor operations (create, update, delete, breach) are audited
- **Test Coverage** — Integration tests for sensor reading rejection and CRUD operations

---

## 6. CI and Deployment

| Pipeline | State |
|---|---|
| Backend CI | pytest against the unit and contract suites |
| Web CI | Bun install, ESLint, `next build` |
| Mobile CI | Bun install (`bun.lock`), `tsc --noEmit` |
| Deploy Web | Vercel Git integration, root `metroflow-admin/` (branch previews, production from `main`; no Actions job) |
| Deploy Backend | Vercel Git integration, root `backend/` (previews on branch pushes, production from `main`; manual `vercel deploy --prod` only for an out-of-band release); container image to GHCR |

The mobile app has no `package-lock.json`; Bun is its package manager (TSD LIM-021).

---

## 7. Scope Constraints

- **Out of scope:** Public app store releases, Civic Broadcasts, Evacuation Centers, Crew Profiles, Comms Streams, native telephony/SMS, functional SQLite tile caching, real CCTV/rain-gauge
- **Units:** All depths/clearance in cm, speeds in km/h
- **PII:** Phone numbers masked by default, no vulnerable person counts, no specific crew names
- **Single source:** Supabase via backend API only

---

## 8. Update — 8 November 2026

Since the 2 November report:

| Area | Change |
|---|---|
| Offline (FR-068 to 071) | Ordered report queue with a visible pending banner and sync on reconnect; SQLite cache of the road graph, hazards and last route; client-side time-dependent A* plans a new route offline. Basemap tiles remain out of scope (LIM-017) |
| Report replay safety | `POST /api/v1/reports` accepts a device-generated `client_id`; a replay after a lost response returns the original report instead of duplicating it. Column is unique and the lookup is scoped to the reporter hash |
| Evidence cross-reference (FR-079) | `GET /api/v1/reports/{id}/nearest-sensor` returns the closest active rain gauge, latest reading, distance and breach state; the moderation desk shows it beside the evidence |
| Moderation and dispatch actions | Report hold, escalate, notes, log, dismiss and restore; SOS reject, hold, escalate, resolve, notes, log, dismiss, restore and dispatch undo; driver report history (`/reports/mine`) and unit mission poll (`/vehicles/{id}/mission`) |
| Database security | RLS on every public table is now a CI gate (`test_every_public_table_has_row_level_security`); the hosted database is at head (`e9b4c2d7a106`) |
| Tests | 80 backend unit/contract tests, 52 Bun unit tests over `metroflow-admin/lib`, and a Playwright portal smoke (sign-in gate, rejected password, triage queue, stored session) in Web CI |
| Accessibility | axe scan of `/login` and `/triage` in CI, contrast fixes, and a shared dialog focus trap (`use-dialog-focus.ts`) |
| Design tokens | Every portal hex now lives in `MAP_COLORS` (`lib/network.ts`), guarded by a source-scanning test; the driver app has `fontSize` and `space` scales in `theme.ts` |
| CI | Backend CI, Web CI (lint, unit, build, portal smoke), Mobile CI and CodeQL are green on `main` |

The remaining gap is test depth, not features: no React component tests, no driver-app tests, no offline browser run, and no measured offline/latency acceptance run (BACKLOG Q-1, Q-2, Q-4).
