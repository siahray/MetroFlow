# Handoff: real OSM road network → backend (for Claude Code)

Written by the front-end agent, 11 Nov 2026. Read `AGENTS.md` at the repo root
and `backend/` neighbours first; this file only covers the live state of the
real-road-network project.

## Mission

Replace the synthetic demo lattice in `road_nodes`/`road_edges` (41 nodes / 61
edges from `network_seed.py`) with real OpenStreetMap streets, so the driver
app navigates real roads when there is no flood — the user's words: "the map
will work normally as a navigation tool like google maps and waze … working
via real data not admin inputted data."

Scope decisions already locked with the user — do not re-litigate:

- **Pilot bbox only, major roads**: trunk/primary/secondary/tertiary and
  their `_link` ramps. No residential streets.
- **One-way streets modeled properly** (schema column + router + API field).
- **Nominatim geocoding is in scope but lives in the mobile app**, not the API.
- Internal APK only, no store release. Units are cm / km/h.

## Ownership

- `backend/` — you (Claude Code).
- `metroflow-mobile/` — the front-end agent (this session). **Do not edit it.**
- `metroflow-admin/` — ask the user; likely also front-end.

## What is already done — uncommitted in the working tree, NOT pushed

| File | What it does |
|---|---|
| `backend/osm_network.py` (new) | The whole import: Overpass fetch (User-Agent set, 4-attempt retry against its random 502s), pure converter `build_graph()` (junction splitting, OSM-id renumbering, `"A × B"` junction names, haversine lengths, maxspeed/lane parsing incl. mph, one-way + roundabout direction), `replace_network()` FK-safe swap, CLI with `--dry-run` / `--bbox` |
| `backend/main.py` | Routing adjacency extracted into `_routing_graph()` honoring `direction`; `pair_index` now keyed on **ordered** pairs (divided carriageways); `direction` in network-state `EdgeProperties`; `GZipMiddleware` (network state is now ~3 MB raw / ~400 KB gzipped) |
| `backend/models.py` | `RoadEdge.direction` — `String(10)`, NOT NULL, client default `"BOTH"` |
| `backend/migrations/versions/f6a9c3e2b7d1_add_road_edges_direction.py` | Adds the column (nullable → backfill `BOTH` → NOT NULL). Head is `f6a9c3e2b7d1`, revises `c2f8b3d1e9a7` |
| `backend/schemas.py` | `direction: Literal["BOTH","FORWARD","BACKWARD"]` on `EdgeProperties` |
| `backend/tests/test_osm_network.py` | 10 converter tests on canned Overpass JSON |
| `backend/tests/test_routing_graph.py` | 5 one-way tests on `_routing_graph` (in-memory model instances, no DB) |

Verified live against the real Overpass endpoint (bbox `14.52,121.00,14.68,121.14`):

- 10,053 ways fetched → **8,950 nodes, 10,876 edges, 0 self-loops dropped**
- Direction split: 7,072 FORWARD / 3,804 BOTH (65% one-way — Manila is a
  one-way city; this is why modeling them mattered)
- 91% of edges carry a road name; 97% of nodes are named
- ~56k coordinate pairs → ~3 MB GeoJSON, ~400 KB gzipped
- `venv/bin/python -m pytest -q` green (197 tests incl. the 15 new); `ruff
  check .` clean; `alembic heads` resolves to the new revision

**Not done:** everything below here.

## Your tasks, in order

1. **End-to-end route check on the real graph** (was interrupted mid-run):
   fetch via `fetch_overpass(BBOX)`, `build_graph()`, build directed adjacency
   exactly like `_routing_graph` does, then `td_a_star_search` across several
   far-apart node pairs, both directions. Expect a well-connected graph; a
   handful of unreachable tiny fragments (enclaves behind one-ways) is fine —
   check the largest reachable set covers ~all nodes.
2. **Sanity-check `alembic check`** against the new migration if CI runs it
   (local has no PostGIS). The migration was written to match the model
   (NOT NULL, no server_default); if drift is reported, align the migration,
   not the model.
3. **Commit and push** (`feat(api): ...` style; pre-commit runs ruff). Watch
   CI: the integration tests need PostGIS and only run there — their result is
   the real verdict. Pushes can bypass the two required checks (user has
   permission) but prefer green CI.
4. **Migration to the hosted DB happens automatically**: the
   `Supabase - Apply migrations` GitHub Action runs after Backend CI passes
   on `main`, and refuses to run on red CI (H-2 in `BACKLOG.md`). Do **not**
   run alembic against the hosted database by hand.
5. **Run the import against the hosted DB** (`backend/.env` has the hosted
   `DATABASE_URL`; conftest guards tests but not this script):
   ```bash
   cd backend
   ./venv/bin/python osm_network.py --dry-run
   ./venv/bin/python osm_network.py
   ```
6. **Verify against the hosted API** (https://metroflow-api-siahrays-projects.vercel.app):
   - `GET /api/v1/network/state` returns ~11k edges with real names, real
     geometry, `direction` present, and a gzipped response
   - `GET /api/v1/routing/navigate` plans a sensible real route between two
     named junctions, both directions (one-ways honored)
   - `GET /api/v1/flood-state` still covers edges and stays quiet
   - The admin portal's network map still performs with ~11k features
7. **Tell the user the import is live** so the front-end agent lands the
   mobile viewport culling (see gotcha below) before any APK build.

## Gotchas

- **Mobile rendering is the pairing constraint**: the current app draws one
  react-native-maps `Polyline` per edge. At 61 edges that was fine; at 10,876
  the route screen will jank/freeze until the front-end agent's culling lands.
  The import won't *break* the mobile app (it ignores `direction` and still
  routes — just as today, bidirectionally), but land the import and tell the
  user rather than treating it as fully shipped.
- **Overpass etiquette**: one run = one request, UA required (406 without),
  random 502s under load (retry is built in). Never loop the script.
- **Do not remove the demo seed gate**: `FASTAPI_ENV=development` startup
  still seeds the synthetic lattice; the whole test suite depends on it. The
  hosted production env does not re-seed, so the import survives restarts.
- **Rollback path**: `cd backend && ./venv/bin/python network_seed.py` re-applies
  the demo lattice additively; new inserts default to `BOTH` direction, and
  `replace_network` had already reset the dependents, so it is clean.
- **Rain coverage shrinks relative to the map**: the `OPEN-METRO-RAIN` virtual
  sensor covers a 5 km radius around 14.565/121.064; the real network is
  wider, so edges outside the radius will read "not covered" in flood-state.
  Expected. Widening `impact_radius_m` is an operator decision, not code.
- **Repo is public**: never commit secrets; `DATABASE_URL`/`JWT_SECRET` live
  in `backend/.env` (gitignored). No new API keys are needed anywhere.
- `zip(..., strict=True)` is enforced by ruff (B905) in this codebase.

## Commands

```bash
cd backend
venv/bin/python -m pytest -q          # unit suite (integration deselected by default)
venv/bin/python -m ruff check .
PYTHONPATH=. venv/bin/python -c "from osm_network import BBOX, fetch_overpass, build_graph; \
    n, e, _ = build_graph(fetch_overpass(BBOX)); print(len(n), len(e))"
```

## Acceptance criteria

Hosted DB holds real OSM streets; a real route plans end-to-end on the hosted
API in both directions with one-ways honored; flood-state and the portal still
behave; CI green; mobile app told about it (culling queued with the front-end
agent); nothing in this file left half-done.
