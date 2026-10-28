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
- **Migration Status:** Complete (as of 23 Oct 2026)
  - Base tables: `road_nodes`, `road_edges`, `users`, `audit_logs`, `live_edge_states`
  - New tables: `hazard_zones`, `vehicles`, `sos_requests`
  - RLS: Enabled on all tables
  - Privileges: Restricted to `postgres` and `service_role` roles

### Migration Scripts
Location: `supabase-migrations/`
- `add_new_tables.sql` - Main migration for new tables
- Verification scripts: `check_alembic.sql`, `check_rls.sql`, `check_indexes.sql`

## Implementation Status (23 Oct 2026)

### ✅ Completed
1. **Database Schema**
   - Created `hazard_zones` table with name field, depth in cm, geometry
   - Created `vehicles` table with clearance_cm, speed_kmh
   - Created `sos_requests` table with coordinates and optional note
   - Enabled RLS on all new tables
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

3. **Admin UI** (`metroflow-admin/`)
   - Replaced `navy-950` with `slate-900` in login button
   - Added `maskPhoneNumber()` function for PII protection
   - Updated dispatch-radar to mask phone numbers by default
   - Removed emergency phone field from profile screen
   - Disabled "Civic Broadcasts", "Evacuation Centers", "Air-Asset Escalation" in sidebar with tooltip "Out of scope for pilot"

4. **Driver App** (`metroflow-mobile/`)
   - Already uses email/password auth (no phone login to strip)
   - "Continue as Guest" button already implemented
   - Updated profile screen to display clearance as `28 cm` instead of `280 mm`
   - Removed emergency phone field from profile screen
   - Marked Offline Maps screen as visual placeholder (no SQLite/download logic)
   - Removed "Call 911" references from SOS and Report screens

### 🔄 Next Steps
1. Test backend API endpoints
2. Start and verify Admin UI
3. Start and verify Driver App
4. Integration testing between all components

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
