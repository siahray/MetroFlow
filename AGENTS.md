# MetroFlow - Agent Notes

## Project Setup

### Environment Configuration
- **Backend:** `backend/.env` - `DATABASE_URL` (Supabase Postgres), `JWT_SECRET`, optional `METROFLOW_ADMIN_EMAIL` / `METROFLOW_ADMIN_PASSWORD`
- **Admin UI:** `metroflow-admin/.env.local` - `NEXT_PUBLIC_API_BASE_URL` only; no Supabase key
- **Driver App:** `metroflow-mobile/.env` - `EXPO_PUBLIC_API_BASE_URL` only; no Supabase key

Neither client talks to Supabase directly. The API owns the database connection and
issues its own HS256 session tokens; see `docs/TSD.md` ADR-021.

### Hosted deployment
- **API:** https://metroflow-api-siahrays-projects.vercel.app (Vercel project
  `metroflow-api`, team `siahrays-projects`, region `icn1`, Python function built
  from `backend/`). The project is connected to this repository with production
  branch `main` and root directory `backend`, so **merging to `main` deploys
  production** and a branch push produces a preview. `cd backend && vercel deploy
  --prod --scope siahrays-projects --project metroflow-api` remains available for
  an out-of-band release.
- **Portal:** https://metroflow-web-lgu.vercel.app (Vercel Git integration, root
  `metroflow-admin`); it reads `NEXT_PUBLIC_API_BASE_URL` at build time.
- **Runtime env vars** live in the Vercel projects, not in the repository. The
  hosted dispatcher password was rotated away from the demo default and is in
  `backend/.env` as `METROFLOW_ADMIN_PASSWORD` (git-ignored).

### Database
- **Provider:** Supabase (PostgreSQL + PostGIS)
- **Project:** https://supabase.com/dashboard/project/rswlxrriqwndohibwizb
- **Migration Status:** Complete (as of 2 Nov 2026)
  - Base tables: `road_nodes`, `road_edges`, `users`, `audit_logs`, `live_edge_states`
  - New tables: `hazard_zones`, `vehicles`, `sos_requests`, `sensors`, `sensor_readings`
  - RLS: Enabled on all tables
  - Privileges: Restricted to `postgres` and `service_role` roles

### Migration Scripts
Location: `supabase-migrations/`
- `add_new_tables.sql` - Main migration for new tables
- Verification scripts: `check_alembic.sql`, `check_rls.sql`, `check_indexes.sql`

## Implementation Status (2 Nov 2026)

### ✅ Completed
1. **Database Schema**
   - Created `hazard_zones` table with name field, depth in cm, geometry
   - Created `vehicles` table with clearance_cm, speed_kmh
   - Created `sos_requests` table with coordinates and optional note
   - Created `sensors` table with threshold, impact radius, location
   - Created `sensor_readings` table with breach detection
   - Enabled RLS on all tables
   - Revoked privileges from anon/authenticated roles

2. **Backend API** (`backend/`)
   - Implemented `POST /api/v1/sos` - SOS creation with coordinates
   - Implemented `POST /api/v1/hazards` - Hazard creation with name field
   - Implemented `PATCH /api/v1/hazards/{id}` - Hazard update
   - Implemented `POST /api/v1/hazards/{id}/publish` - Step 1 of dispatch flow
   - Implemented `POST /api/v1/sos/{id}/assign` - Step 2 of dispatch flow
   - Implemented `POST /api/v1/dispatch/{id}/confirm` - Step 3 of dispatch flow
   - Implemented `GET /api/v1/vehicles` - List vehicles
   - Implemented `POST /api/v1/vehicles` - Create vehicle
   - Implemented `PATCH /api/v1/vehicles/{id}` - Update vehicle
   - **User Management (FSD-FR-048):**
     - `GET /api/v1/users` - List users
     - `POST /api/v1/users` - Create user (admin only, audited)
     - `PATCH /api/v1/users/{id}` - Update user (admin only, audited)
     - `DELETE /api/v1/users/{id}` - Delete user (admin only, audited)
   - **Export (FSD-FR-049):**
     - `GET /api/v1/audit/export` - Export audit logs as CSV (admin only)
     - `GET /api/v1/incidents/export` - Export SOS incidents as CSV (admin only)
   - **Sensors (FSD-FR-090, FR-091):**
     - `POST /api/v1/sensors/readings` - Gateway submits readings with threshold breach detection
     - `GET /api/v1/sensors` - List sensor registry (admin only)
     - `POST /api/v1/sensors` - Create sensor (admin only, audited)
     - `PATCH /api/v1/sensors/{id}` - Update sensor (admin only, audited)
     - `DELETE /api/v1/sensors/{id}` - Delete sensor (admin only, audited)
     - Impact radius edge marking using PostGIS ST_DWithin on threshold breach
   - **Dispatch Action Log Persistence (FSD-FR-039 to 046):**
     - Per-incident log endpoints (`GET /api/v1/sos/{sos_id}/log`, `GET /api/v1/reports/{report_id}/log`)
     - Removed in-memory log state from radar, triage, and dashboard
   - **Rescue Route Preview (FSD-FR-089):**
     - Added optional `vehicle_id` query parameter to dispatch preview endpoint
     - Returns 409 for missing vehicle position, 422 for no safe route

3. **Admin UI** (`metroflow-admin/`)
   - Replaced `navy-950` with `slate-900` in login button
   - Added `maskPhoneNumber()` function for PII protection
   - Updated dispatch-radar to mask phone numbers by default
   - Removed emergency phone field from profile screen
   - Disabled "Civic Broadcasts", "Evacuation Centers", "Air-Asset Escalation" in sidebar with tooltip "Out of scope for pilot"
   - **User Management UI (FSD-FR-048):**
     - User list with search
     - Create/Edit modals
     - Delete with confirmation
     - Role badges
     - Navigation menu integration
   - **Export UI (FSD-FR-049):**
     - Export panel with CSV export buttons
     - Loading states and toast notifications
     - Data privacy warning message
     - Navigation menu integration

4. **Driver App** (`metroflow-mobile/`)
   - Already uses email/password auth (no phone login to strip)
   - "Continue as Guest" button already implemented
   - Updated profile screen to display clearance as `28 cm` instead of `280 mm`
   - Removed emergency phone field from profile screen
   - Marked Offline Maps screen as visual placeholder (no SQLite/download logic)
   - Removed "Call 911" references from SOS and Report screens
   - **iOS Parser Error Fix:**
     - Updated Expo SDK packages to fix React Native EventEmitter parsing error

5. **Bug Fixes**
   - **CCTV Removal:** Remove out-of-scope CCTV references from portal code and documentation
   - **Geometry Type:** Fix Alembic migration for CI compatibility with SQLAlchemy/GeoAlchemy2

### 🔄 In Progress
- None

### 📋 Backlog Items Not Yet Started
- Offline operation (FR-068-071) - Conflicts with scope resolution (would require re-evaluating scope)

## Scope Constraints (per UI/UX Design Audit)

### Out of Scope
- Public App Store/Play Store releases (use emulator or tethered device)
- Civic Broadcasts table and features
- Evacuation Centers table and features
- Crew Profiles table and features
- Comms Streams table and features
- Native telephony/SMS in SOS
- Functional SQLite tile caching for offline maps
- Real CCTV integration
- Real rain-gauge integration

### Units
- All depths: centimeters (cm)
- All speeds: km/h
- Vehicle clearance: centimeters (cm)

### Colors
- Primary: `slate-900` (not `navy-950`)
- Success: `emerald-500` (not teal)

### PII Protection
- Phone numbers masked by default: `+63 9** *** ****`
- No vulnerable person counts
- No specific crew names

## Build Commands

### Backend
```bash
cd backend
source venv/bin/activate
alembic upgrade head
uvicorn main:app --reload
```

### Admin UI
```bash
cd metroflow-admin
npm run dev
```

### Driver App
```bash
cd metroflow-mobile
npm start
```
