# MetroFlow - Progress Report

**Project:** MetroFlow - Intelligent Urban Mobility & Flood Simulation System  
**Date:** October 27, 2026  
**Branch:** `feat/scope-resolution-slice`  
**Status:** Piloted locally — sign-in, SOS, hazards, fleet and dispatch persist through the API

---

## Executive Summary

MetroFlow is a dual-interface flood-aware urban mobility system consisting of a FastAPI backend, an LGU web dashboard (`metroflow-admin/`) and an Expo driver app. The system covers flood simulation, clearance-aware routing, SOS/emergency dispatch and flood-hazard publishing. All application data flows through the backend API into Supabase Postgres. Accounts are real: the API issues its own session tokens and checks bcrypt credentials against the `users` table.

This is a working pilot, not a production service. Most endpoints still accept unauthenticated calls (TSD LIM-022), so the stack must stay off the public internet until route-level enforcement lands.

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
| New tables | Complete | `hazard_zones`, `vehicles`, `sos_requests` |
| PostGIS geometry | Complete | Geospatial support for road network and hazard zones |
| RLS | Enabled | Row Level Security enabled on all tables |
| Privileges | Restricted | Restricted to `postgres` and `service_role` roles |

### Accounts
- **Bootstrap dispatcher:** `dispatcher@metroflow.local`, role `SUPER_ADMIN`
- **Provisioning:** created once at startup from `METROFLOW_ADMIN_EMAIL` / `METROFLOW_ADMIN_PASSWORD` when the `users` table is empty
- **Driver accounts:** created by `POST /api/v1/auth/register`, always `EMERGENCY_DRIVER`
- **Escalation:** registration refuses `LGU_DISPATCHER` and `SUPER_ADMIN` with `403`

---

## 2. Backend API (FastAPI)

### Authentication
- **JWT tokens** issued by the API (`PyJWT`, HS256) and returned by `/api/v1/auth/login`
- **Passwords** bcrypt-hashed on the `users` row
- **Login** accepts `LGU_DISPATCHER`, `SUPER_ADMIN` and `EMERGENCY_DRIVER`
- **Registration** creates driver accounts only
- **`GET /api/v1/auth/me`** is the only route that currently validates the token
- **Email verification** uses an in-process store (dev mode returns the code); it does not survive a restart
- **Open gap:** the remaining routes do not require a token yet (TSD LIM-022)

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
| `/api/v1/hazards` | POST | Create hazard zone (cm) |
| `/api/v1/hazards` | GET | List hazard zones |
| `/api/v1/hazards/{id}` | PATCH | Update hazard zone |
| `/api/v1/hazards/{id}/publish` | POST | Publish hazard (dispatch step 1) |
| `/api/v1/sos/{id}/assign` | POST | Assign vehicle (dispatch step 2) |
| `/api/v1/dispatch/{id}/confirm` | POST | Confirm dispatch (dispatch step 3) |
| `/api/v1/vehicles` | GET/POST | List/create vehicles |
| `/api/v1/vehicles/{id}` | PATCH | Update vehicle |
| `/api/v1/network/state` | GET | Road graph with live depths |
| `/api/v1/simulation/rain` | POST | Apply a rainfall event |
| `/api/v1/routing/navigate` | GET | Clearance-aware route |

---

## 3. LGU Web Dashboard (`metroflow-admin/`, Next.js)

- **Separate pages:** `/login` and the operational screens (`/triage`, `/dashboard`, `/radar`, `/fleet`, `/hazards`)
- **Real sign-in** against the API; the token is kept in `sessionStorage`
- **Live data** — SOS requests, vehicles and hazards load from the API
- **Mixed data** — the SOS live panel is API-backed; the remaining queue entries are still seed/demo records
- **Dispatch** assigns the selected fleet unit by its backend `vehicle_id` instead of a hardcoded id
- **PII protection** — phone numbers masked by default
- **Units:** cm for depths/clearance, km/h for speed
- **Colors:** `slate-900` primary, `emerald-500` success
- **Out of scope disabled:** Civic Broadcasts, Evacuation Centers, Air-Asset Escalation

---

## 4. Driver Mobile App (Expo / React Native)

- **Expo Router tab layout** — Map, Report, SOS and Profile tabs
- **Email/password auth** with a registration path for driver accounts
- **Profile:** displays clearance in cm
- **SOS/Report:** submits to the backend
- **Offline Maps:** visual placeholder only (no SQLite/download)
- **No emergency phone/911 references**
- **`AuthProvider`** mounted in the root layout

---

## 5. CI and Deployment

| Pipeline | State |
|---|---|
| Backend CI | pytest against the unit and contract suites |
| Web CI | Bun install, ESLint, `next build`, Playwright E2E |
| Mobile CI | Bun install (`bun.lock`), `tsc --noEmit` |
| Deploy Web | Vercel project rooted at `metroflow-admin/` |
| Deploy Backend | Container image to GHCR |

The mobile app has no `package-lock.json`; Bun is its package manager (TSD LIM-021).

---

## Scope Constraints

- **Out of scope:** Public app store releases, Civic Broadcasts, Evacuation Centers, Crew Profiles, Comms Streams, native telephony/SMS, functional SQLite tile caching, real CCTV/rain-gauge
- **Units:** All depths/clearance in cm, speeds in km/h
- **PII:** Phone numbers masked by default, no vulnerable person counts, no specific crew names
- **Single source:** Supabase via backend API only
