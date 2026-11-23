# MetroFlow Technology Stack & Architectural Rationale

*Last updated: November 2026 (Reflecting Production Baseline & Pilot Deployment)*

---

## 1. System Overview

**MetroFlow** is an emergency-response and flood-adaptive logistics coordination system designed for the Local Government Unit (LGU) and disaster risk reduction management offices (DRRMO) in Metro Manila (piloted across the Quezon City corridor). 

The platform integrates real-time hydrological forecasting, community flood hazard reporting, dynamic water-depth vehicle routing, LGU dispatch coordination, and driver turn-by-turn guidance.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               External Telemetry Feeds                 │
                    │   Open-Meteo (Rain) · GloFAS (River) · NOAH (Advisories)│
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────┐          ┌─────────────────────┐          ┌─────────────────────────┐
│   Admin Dispatch Portal │          │     Backend API     │          │    Mobile Driver App    │
│  Next.js 14 App Router  │◄─────────┤ FastAPI / Python 3  ├─────────►│  React Native / Expo 52 │
│    MapLibre GL JS       │   SSE    │ In-House TD-A* & OSM│   SSE    │   @rnmapbox/maps Native │
│    Tailwind CSS         │  REST    │ Mapbox Directions   │  REST    │   Offline SQLite Cache  │
└─────────────────────────┘          └──────────┬──────────┘          └─────────────────────────┘
                                                │
                                                ▼
                                     ┌─────────────────────┐
                                     │ Supabase PostgreSQL │
                                     │  PostGIS Extension  │
                                     │  Durable event_log  │
                                     │  In-Row bytea Blobs │
                                     └─────────────────────┘
```

---

## 2. Technology Stack Inventory

### 2.1 Backend & Computational Core (`backend/`)
| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Language & Runtime** | Python | `3.12+` | Core algorithmic services, asynchronous I/O, routing, and data ingestion. |
| **Web Framework** | FastAPI | `0.110+` | High-performance ASGI REST API with automatic OpenAPI validation. |
| **ASGI Server** | Uvicorn | `0.28+` | Lightweight asynchronous server interface for local and containerized execution. |
| **Hosting & Execution** | Vercel Serverless | Python Runtime (`icn1` Seoul) | Automated production deployments linked to repository `main` branch. |
| **Database & GIS** | PostgreSQL + PostGIS | `15+` | Spatial database powering geospatial indexing, vector geometry, and edge states. |
| **Database Hosting** | Supabase | Managed Cloud | Managed Postgres with PostGIS, IPv4 Transaction Pooler (PgBouncer/Supavisor). |
| **ORM & Migrations** | SQLAlchemy (Async) & Alembic | SQLAlchemy `2.0+`, Alembic `1.13+` | Asynchronous relational mapping and strict, forward-only database schema versioning. |
| **Graph & Routing** | NetworkX | `3.2+` | In-memory graph analysis, time-dependent routing graph, Dijkstra & A* execution. |
| **Traffic Routing Fallback**| Mapbox Directions API | v5 | Real-time traffic routing when network conditions are dry (`FASTEST` mode). |
| **Event Bus & Streaming** | PostgreSQL `event_log` + SSE | Custom ASGI streaming | Brokerless event relay for real-time dispatch, hazard, and telemetry feeds. |
| **Authentication** | PyJWT & Passlib (Bcrypt) | PyJWT `2.8+`, Passlib `1.7+` | Independent HS256 signed session tokens and salted password hashing. |

### 2.2 LGU Dispatcher Web Portal (`metroflow-admin/`)
| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `14.2+` | Server-rendered React application for emergency operations center (EOC) dispatchers. |
| **Language** | TypeScript | `5.4+` | End-to-end type safety matching backend schemas. |
| **Styling** | Tailwind CSS | `3.4+` | High-density operational UI using utility classes with custom slate palette. |
| **Map Rendering** | MapLibre GL JS | `4.1+` | Open-source WebGL vector map rendering without mandatory commercial API keys. |
| **Map Basemap Style** | Carto Positron (Keyless) | Vector / Raster | High-contrast, desaturated basemap ensuring water depth overlays stand out. |
| **Icons & UI Primitives**| Lucide React | `0.360+` | Accessible iconography for emergency actions, weather statuses, and fleet telemetry. |
| **Hosting & CDN** | Vercel | Production Edge | Hosted at `metroflow-web-lgu.vercel.app` with zero-downtime atomic rollouts. |

### 2.3 Mobile Driver Navigation App (`metroflow-mobile/`)
| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | React Native & Expo | RN `0.88`, Expo SDK `52` | Native iOS and Android application for emergency drivers and field responders. |
| **Language** | TypeScript | `5.4+` | Strict typing shared across navigation routines and offline synchronization. |
| **Map Rendering** | `@rnmapbox/maps` | `10.1+` | Hardware-accelerated OpenGL/Metal vector map view with dynamic camera tilting. |
| **Navigation Voice** | `expo-speech` | SDK 52 | On-device text-to-speech for spoken turn-by-turn guidance and hazard alerts. |
| **Location Telemetry** | `expo-location` | SDK 52 | High-frequency GPS tracking, heading calculations, and velocity reporting. |
| **Offline Cache** | `expo-sqlite` & AsyncStorage | SDK 52 | On-device local persistence for road graph, active hazards, and last-planned route. |
| **Offline Routing** | TypeScript Dijkstra Engine | Custom (`offline-route.ts`) | On-device route calculation when cellular connectivity drops during typhoons. |
| **Geocoding & Search** | Curated POIs + Nominatim | Custom (`geocode.ts`) | Instant landmark matching + OpenStreetMap POI geocoding snapped to road nodes. |

### 2.4 Testing, Quality Assurance & DevOps
| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **JavaScript Test Runner**| Bun Test | `1.1+` | Ultra-fast unit testing across admin libraries and mobile offline algorithms. |
| **End-to-End Testing** | Playwright | `1.43+` | Headless browser integration tests validating dispatch flows and triage workflows. |
| **Python Test Runner** | Pytest & pytest-asyncio | `8.1+` | API contract validation, clearance routing logic, and PostGIS RLS tests. |
| **Linters & Formatters** | Ruff, ESLint, Prettier | Latest | Unified PEP-8 Python linting, TypeScript linting, and style formatting. |
| **CI/CD Automation** | GitHub Actions | Ubuntu-latest | Automated testing, linting, migration dry-runs, and OWASP ZAP security scans. |

---

## 3. Architectural Rationale: Why Each Technology Was Chosen

### 3.1 Python, FastAPI & NetworkX for Core Routing
- **Why chosen:** 
  Python is the industry benchmark for scientific computing, geographic information systems, and graph theory. FastAPI provides native asynchronous request processing (`async/await`) on top of Starlette and Pydantic, enabling high-concurrency throughput with automatic input validation.
- **Why NetworkX over external routing engines (OSRM / Valhalla):**
  Standard routing engines (like standard OSRM) assume static edge weights based solely on distance and legal road speed. MetroFlow requires **dynamic, depth-dependent edge penalization** where water levels continuously alter edge traversal costs or invalidate them entirely based on vehicle clearance ($clearance\_cm \le depth\_cm$). An in-memory NetworkX graph allows sub-50ms dynamic cost calculations without rebuilding C++ routing partitions on every flash-flood event.
- **Traceability:** Aligns with **ADR-004** (Time-dependent $A^*$ search) and **FSD-FR-056**.

### 3.2 Dual Routing Strategy: In-House Engine + Mapbox Directions API
- **Why chosen:**
  1. **In-House Solver (`FLOOD_SAFE` mode):** When flood hazards or heavy rain alerts are active, routing decisions can be life-critical. Only the in-house engine has verified knowledge of live water depths, river discharge thresholds, and vehicle clearances.
  2. **Mapbox Directions API (`FASTEST` mode):** When the road network is dry and confirmed safe, routing drivers through an imported static OSM lattice lacks real-time traffic congestion data. Calling Mapbox Directions during dry conditions gives drivers production-grade traffic-aware navigation without compromising safety.
- **Traceability:** Explicitly documented in **ADR-025** and **BRULE-015**.

### 3.3 Supabase (PostgreSQL + PostGIS) & Alembic
- **Why chosen:**
  - **PostGIS:** The standard for geospatial queries. Spatial functions (`ST_DWithin`, `ST_Contains`, `ST_Distance`) evaluate whether GPS coordinates fall within sensor impact radii or hazard zones directly at the database layer.
  - **Connection Pooling:** GitHub Actions CI runners and Vercel serverless functions connect over IPv4. Supabase provides transaction-mode pooling (Supavisor) on port 6543, avoiding ephemeral port exhaustion.
  - **Strict Database Security:** While hosted on Supabase, the application enforces Row-Level Security (RLS) on all public tables and connects via an unprivileged `metroflow_app` role rather than the superuser role.
  - **Alembic:** Enforces reproducible, programmatic database migrations checked into Git, avoiding schema drift.
- **Traceability:** Governed by **ADR-001** (Alembic ownership), **ADR-002** (Hosted Postgres), **ADR-003** (Session pooler), and **ADR-007** (RLS deny-by-default).

### 3.4 Brokerless Event Relays via Durable `event_log` & SSE (No Redis in Production)
- **Why chosen:**
  In early development iterations, Redis was considered for pub/sub messaging. However, hosting an external Redis cluster introduces operational complexity, added cloud costs for local government units, and cold-start synchronization issues in serverless architectures.
  Furthermore, transaction-mode database poolers cannot support PostgreSQL `LISTEN/NOTIFY`.
  
  **The Chosen Architecture:**
  MetroFlow uses an append-only, durable `event_log` table inside PostgreSQL. Asynchronous Server-Sent Events (SSE) endpoints poll `event_log` by sequential `event_id`.
  - **Advantages:**
    - Zero external broker dependencies.
    - True durability: disconnected drivers can reconnect with HTTP header `Last-Event-ID` and reliably replay all missed dispatches or hazard updates.
    - Rate limits are tracked atomically in PostgreSQL counters with automatic cleanup.
- **Traceability:** Formalized in **ADR-013** (Redis unprovisioned) and **ADR-015** (SSE over durable `event_log`).

### 3.5 Independent Auth (PyJWT + Bcrypt) over Supabase Auth
- **Why chosen:**
  Originally, Supabase Auth was considered (ADR-016). However, disaster response systems require complete autonomy over user sessions, role-based access control (RBAC), and offline capability:
  - Both dispatcher portal and driver apps communicate exclusively with the MetroFlow FastAPI backend.
  - Generating self-contained HS256 JWTs using `python-jose` and verifying salted passwords using `passlib[bcrypt]` decouples identity from third-party auth vendors.
  - Admin accounts can be managed programmatically without external proprietary identity dashboards.
- **Traceability:** Superseded ADR-016 via **ADR-021** (API-issued session tokens).

### 3.6 In-Row Binary `bytea` Blobs for Evidence Storage
- **Why chosen:**
  In standard web architectures, incident photos are uploaded to Amazon S3 or Google Cloud Storage. In MetroFlow's pilot architecture:
  - The API runs in a serverless environment (Vercel) with an ephemeral local filesystem.
  - Disaster evidence photos must remain tamper-resistant, auditable, and backed up in lockstep with the incident metadata row.
  - Evidence photos are compressed client-side, capped at 4 MB, type-sniffed (JPEG/PNG/WebP), EXIF-stripped (for PII protection), and stored directly as binary `bytea` blobs in the `incident_reports` table.
- **Traceability:** Documented in **ADR-023** (Evidence stored in report row).

### 3.7 Next.js 14 App Router & MapLibre GL JS for Admin Dispatch Portal
- **Why chosen:**
  - **Next.js 14:** Delivers server-side rendered speed, secure API route handling, and automatic bundling.
  - **MapLibre GL JS & Carto Positron:** Emergency dispatchers need an uncluttered, responsive tactical overview. MapLibre GL JS was selected over proprietary Mapbox GL JS because it requires no token or commercial tracking. Paired with the keyless Carto Positron basemap, the road network and water inundation polygons remain high-contrast and instantly readable.
- **Traceability:** Aligns with **ADR-019** (MapLibre GL JS) and **ADR-022** (Carto Positron style).

### 3.8 React Native (Expo SDK 52) & `@rnmapbox/maps` for Driver App
- **Why chosen:**
  - **Native Performance:** Driver navigation requires 60 FPS hardware-accelerated vector mapping, smooth heading rotation, and device location services.
  - **`@rnmapbox/maps` Native SDK:** Replaced raster webviews to provide true turn-by-turn camera following, perspective tilting, and automatic night mode switching during storm conditions.
  - **Local Resilience (Offline-First):** In severe typhoons, mobile cell towers frequently lose power. The mobile app stores the Quezon City road network graph and active hazard polygons locally in SQLite. If network connectivity drops to zero, the driver app continues routing using its local Dijkstra solver (`offline-route.ts`) and queues citizen hazard reports with idempotent `client_id`s for replay upon reconnection.
- **Traceability:** Documented in **ADR-014** (Native Expo), **ADR-018** (Offline graph routing), **ADR-024** (Offline SQLite state), and **ADR-026** (Mapbox SDK).

---

## 4. Architectural Decision Records (ADR) Summary

| ADR ID | Decision Title | Status | Impact on Technology Stack |
| :--- | :--- | :--- | :--- |
| **ADR-001** | Schema Management via Alembic | Accepted | Database schema strictly managed via migrations; no manual DDL. |
| **ADR-002** | Supabase as Hosted PostgreSQL | Accepted | PostGIS cloud database with automated daily backups. |
| **ADR-003** | IPv4 Transaction Pooler | Accepted | Port 6543 connection pooler for serverless & GitHub runner compatibility. |
| **ADR-004** | Time-Dependent A* Search | Accepted | NetworkX-based heuristic graph solver factoring depth and speed. |
| **ADR-007** | Supabase RLS Deny-By-Default | Accepted | All public tables secured with RLS policies, audited by CI tests. |
| **ADR-013** | Redis Omission in Production | Accepted | Removed Redis dependency; Postgres handles queue, rate limits, and event log. |
| **ADR-014** | Mobile Client on Expo / React Native | Accepted | Native iOS/Android app with background location and speech APIs. |
| **ADR-015** | SSE over Durable `event_log` Relay | Accepted | Server-Sent Events tailing Postgres log table; zero message broker. |
| **ADR-021** | Independent HS256 API Session Tokens | Accepted | Replaced Supabase Auth with custom FastAPI PyJWT + bcrypt implementation. |
| **ADR-022** | Portal Carto Positron Basemap | Accepted | Keyless vector style providing high-contrast disaster visualization. |
| **ADR-023** | In-Row Binary Evidence Storage | Accepted | Replaced S3 with `bytea` storage inside PostgreSQL rows (≤4 MB). |
| **ADR-024** | Offline SQLite & Idempotent Replays | Accepted | Mobile offline graph navigation and client-generated UUID deduplication. |
| **ADR-025** | Mapbox Directions for Dry Fastest Mode| Accepted | In-house engine handles floods; Mapbox handles live traffic when dry. |
| **ADR-026** | Mapbox Native SDK for Driver App | Accepted | Hardware-accelerated mobile maps with automatic dark storm styling. |
| **ADR-027** | Client-Neutral Dual-Mode Tracking | Accepted | Telemetry fix ages (live/stale/offline) + durable dispatch audit trail. |

---

## 5. Explicit Technology Exclusions & Boundaries

To ensure operational stability and budget compliance for municipal deployments, the following technologies were evaluated and **deliberately excluded**:

1. **No External Message Broker (RabbitMQ / Kafka / Redis):** Eliminated in favor of PostgreSQL `event_log` tailing via SSE. Eliminates server management and cold-start latency.
2. **No Proprietary Identity SaaS (Auth0 / Firebase Auth / Supabase Auth):** Replaced by standards-compliant JWT issuance directly from the FastAPI backend.
3. **No External Cloud Storage Bucket (AWS S3 / Google Cloud Storage):** Avoids multi-cloud credential fragmentation; evidence images are contained in relational database backups.
4. **No Raster Map Tile Caching for Mobile Offline:** Storing millions of PNG map tiles offline causes device storage bloat and licensing violations; MetroFlow caches the **topological road vector graph**, enabling full routing computation without tile downloads.
5. **No Direct Client Database Access:** Neither the web portal nor the mobile driver app possesses database credentials. All queries pass through the API gateway.
