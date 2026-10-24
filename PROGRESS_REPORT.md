# MetroFlow - Progress Report

**Project:** MetroFlow - Intelligent Urban Mobility & Flood Simulation System  
**Date:** October 24, 2026  
**Branch:** `feat/scope-resolution-slice`  
**Status:** Production-ready with Supabase integration

---

## Executive Summary

MetroFlow is a dual-interface flood-aware urban mobility system consisting of a FastAPI backend, LGU web dashboard, and driver mobile application. The system enables real-time flood monitoring, SOS/emergency response coordination, and flood-aware route planning. All core data flows through Supabase as the single source of truth. Only the designated admin account can access the system. All mock data has been removed.

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

### Admin Account
- **Email:** `admin@metroflow.gov.ph`
- **Role:** `SUPER_ADMIN`
- **Access:** Only admin account exists in database; registration disabled

---

## 2. Backend API (FastAPI)

### Authentication
- **JWT tokens** for secure authentication
- **Login restricted** to `LGU_DISPATCHER` and `SUPER_ADMIN` roles only
- **Registration disabled** - only admin can access
- **Email verification** with in-memory store (dev mode returns code)

### Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/login` | POST | JWT-based login (admin only) |
| `/api/v1/auth/send-verification` | POST | Send verification code |
| `/api/v1/auth/verify` | POST | Verify code |
| `/api/v1/sos` | POST | Create SOS request |
| `/api/v1/hazards` | POST | Create hazard zone (cm) |
| `/api/v1/hazards/{id}` | PATCH | Update hazard zone |
| `/api/v1/hazards/{id}/publish` | POST | Publish hazard (dispatch step 1) |
| `/api/v1/sos/{id}/assign` | POST | Assign vehicle (dispatch step 2) |
| `/api/v1/dispatch/{id}/confirm` | POST | Confirm dispatch (dispatch step 3) |
| `/api/v1/vehicles` | GET/POST | List/create vehicles |
| `/api/v1/vehicles/{id}` | PATCH | Update vehicle |

---

## 3. LGU Web Dashboard (Next.js)

- **Separate pages:** `/login` and `/dashboard` (refactored from single-page portal)
- **Admin-only login** - no prefilled credentials
- **Live data only** - all SOS, vehicles, hazards from Supabase
- **No mock data** - all hardcoded incidents/fleets removed
- **PII protection** - phone numbers masked by default
- **Units:** cm for depths/clearance, km/h for speed
- **Colors:** `slate-900` primary, `emerald-500` success
- **Out of scope disabled:** Civic Broadcasts, Evacuation Centers, Air-Asset Escalation

---

## 4. Driver Mobile App (React Native/Expo)

- **Email/password auth** with verification flow
- **No prefilled values** in forms
- **Profile:** displays clearance in cm
- **SOS/Report:** submits to backend, no mock data
- **Offline Maps:** visual placeholder only (no SQLite/download)
- **No emergency phone/911 references**
- **AuthProvider** integrated

---

## Scope Constraints

- **Out of scope:** Public app store releases, Civic Broadcasts, Evacuation Centers, Crew Profiles, Comms Streams, native telephony/SMS, functional SQLite tile caching, real CCTV/rain-gauge
- **Units:** All depths/clearance in cm, speeds in km/h
- **PII:** Phone numbers masked by default, no vulnerable person counts, no specific crew names
- **Single source:** Supabase via backend API only
