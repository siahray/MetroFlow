# Validation: Map-Based Navigation and Adaptive Routing Visualization

**Validated:** 14 Nov 2026
**Baseline:** `main` @ `f8bd103` — includes `c037421` (API: Mapbox dry-state routing) and `5220f85` (mobile: navigation polish)
**Method:** static code and deployment-config review. No build, no device run, no live API calls.
**Verdict:** **Partly in place** — 13 of 17 requirements met, 4 partial, 1 not met.

| | Count |
|---|---|
| Met | 13 |
| Partial | 4 |
| Not met | 1 |

---

## 1. Dry Mode

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1a | Use the Mapbox map interface for navigation | **NOT MET** | `metroflow-mobile/src/navigation/RouteMap.tsx:3` imports `react-native-maps` (Apple Maps / Google Maps basemap). No `@rnmapbox/maps` in `metroflow-mobile/package.json`; no Mapbox style URL anywhere. `metroflow-mobile/app.json:57-60` configures `react-native-maps` with an Android Google key placeholder. `docs/TSD.md:149` still lists the Mapbox basemap as "Planned". |
| 1b | Use Mapbox Directions as the primary routing provider | **PARTIAL** — code yes, production no | Implemented: `backend/main.py:845-857` (gate), `backend/mapbox_directions.py` (adapter, 5 s timeout, `None` on any failure). Dormant in production: the `metroflow-api` Vercel project has only `DATABASE_URL`, `METROFLOW_ADMIN_EMAIL`, `METROFLOW_ADMIN_PASSWORD`, `JWT_SECRET`, `METROFLOW_CORS_ORIGINS`, `FASTAPI_ENV` — **no `METROFLOW_MAPBOX_ACCESS_TOKEN`**, so every hosted route returns `source: "ENGINE"`. `backend/.env` locally does hold the token, which is why the end-to-end `source: "MAPBOX"` check in `BACKLOG.md` passed. |
| 1c | Display the calculated route as a continuous route line | **MET** | `RouteMap.tsx:310-328` — white casing `Polyline` + blue `Polyline` drawn from `route.geometry`. Provider-agnostic: both `ENGINE` and `MAPBOX` return the same GeoJSON LineString field. |
| 1d | Display current location, destination, ETA, distance, road names, navigation instructions | **MET** | Location puck and destination marker: `RouteMap.tsx:332-372`. Instruction text + road name + ETA: `metroflow-mobile/src/app/route.tsx:1043-1061`. Distance remaining, duration, ETA, clearance: `route.tsx:1431-1439`. |
| 1e | Do not expose or render the internal OSM graph/nodes/edges as the primary navigation interface | **PARTIAL** | The graph is not the map: `RouteMap.tsx:192-207` paints only non-`PASSABLE` edges, and `viewMode === "traffic"` paints none. But internal ids still surface in search text: `route.tsx:1239` renders `Road node {node_id}`, and `route.tsx:1275` says "No road node or address matches that search." |

## 2. Flood-Aware Mode

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 2a | Retain the existing OSM road graph and TD-A\* flood-aware routing | **MET** | `backend/main.py:272-292` (`_load_graph`), `main.py:663-710` (`_routing_graph`), `backend/routing.py:275-371` (`td_a_star_search`). |
| 2b | Use nodes and edges internally to calculate flood-safe routes | **MET** | Water depth, advisories and hazard closures are per-edge overlays on `road_edges` (`main.py:291, 353-367, 317-350`); they never become map layers on their own. |
| 2c | Convert the resulting graph path into map-compatible route geometry | **MET** | `main.py:879-907` assembles the LineString hop by hop via `_edge_coordinates`, reversing stored geometry when travel is against `start_node_id`. |
| 2d | Render the resulting route on the same map-based navigation interface | **MET** | Same `RouteMap` / same `Polyline`. The only difference is `route.routing_mode`. |
| 2e | Display flood-risk indicators, verified hazards, road-condition information | **MET** | Hazard `Polygon`s (`RouteMap.tsx:269-288`), flood status legend (`RouteMap.tsx:374-389`), MAX DEPTH / SAFETY MARGIN / CONGESTION metrics (`route.tsx:1463-1490`), hazard chip and "Flood-safe route" chip (`route.tsx:1442-1459`), current-segment status and speed-limit sign (`route.tsx:1063-1071`). |

## 3. Shared Navigation Interface

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 3a | Both routing providers produce a standardized route response | **MET** | One `RouteResponse` schema carrying `source: "ENGINE" \| "MAPBOX"`; the mobile mirror is `RoutePlan` (`metroflow-mobile/src/api.ts:349-360, 372`). `MAPBOX` responses deliberately carry empty `segments` and `hazards` (`main.py:757, 759`). |
| 3b | The navigation interface must not depend on which provider calculated the route | **PARTIAL** | The interface does not switch, but three provider-aware branches exist: alternate-route button hidden for `MAPBOX` (`route.tsx:1349`), summary chip label (`route.tsx:1453-1457`), `samePath()` compares `total_distance_m` instead of node lists (`route.tsx:150-155`). All are deliberate and documented; the consequence is that alternate routes are unavailable on Mapbox-sourced routes. |
| 3c | Switching providers must not require switching to a different map interface | **MET** | Single `RouteMap` instance regardless of `source` (`route.tsx:1024-1036`). |
| 3d | Preserve current location, destination and navigation context when recalculating | **MET** | Auto-reroute re-derives the origin from live GPS via `nearestNode`, then keeps `current.target_node`, `current.vehicle_clearance_cm` and `unsafeRef` (`route.tsx:593-610`). Manual refresh does the same (`route.tsx:646-657`). |

## 4. Routing Provider Separation

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 4a | Map renderer and routing provider must be independent components | **MET** | `RouteMap` takes only a `RoutePlan` and never reads `source`; provider selection is entirely backend-side. |
| 4b | Mapbox handles standard routing in confirmed dry conditions | **PARTIAL** — code yes, production no | Gate: `mode == FASTEST and not ignore_hazards and not avoid_edges and start != target and mapbox_directions_enabled and mapbox_access_token` (`main.py:845-852`). Mode is auto-resolved by `routing.routing_mode` (`routing.py:32-51`); the app forces `FASTEST` only while its map is in the normal/traffic view (`route.tsx:264`). Blocked in production by the missing token. |
| 4c | MetroFlow TD-A\* handles flood-aware route calculation | **MET** | `main.py:859-866` passes `flood_aware=mode == FLOOD_SAFE`; `FLOOD_SAFE` never reaches the provider path (BRULE-015, `main.py:846`). |
| 4d | OSM nodes and edges remain internal routing data, not the default visual representation | **PARTIAL** | Same finding as 1e: the graph is never the basemap layer, but `node_id` is still printed in the destination search list. |

---

## Gaps

1. **No Mapbox map interface exists** (1a). The renderer is the platform map provider. This is the single clean miss; everything else is a code or configuration gap.
2. **The routine dry handoff is dormant in production** (1b, 4b). Adding `METROFLOW_MAPBOX_ACCESS_TOKEN` to the Vercel `metroflow-api` project and redeploying activates it; `mapbox_directions_enabled` already defaults to `True` (`backend/config.py:120`).
3. **Internal node ids leak into the search UI** (1e, 4d) — cosmetic, but contradicts "remain internal".
4. **Alternate routes are unavailable on Mapbox-sourced routes** (3b). Structural: a provider route has no edge-level `segments`, so `avoid_edges` cannot be computed from it.

## Unverified / risks

- **Android basemap.** `app.json:59` sets `androidGoogleMapsApiKey` to the literal string `not-used-tiles-come-from-mapbox-or-carto`, which is not a valid key. On a real Android build this would likely leave the map without tiles unless a valid key is injected. Not confirmed — no device build was run.
- **Flood coverage.** The virtual rain gauge `OPEN-METRO-RAIN` sits at `14.565, 121.064` with `IMPACT_RADIUS_M = 5000` (`backend/weather.py:23-29`), a centre left from the old synthetic seed grid. The network is now the Quezon City bbox `14.5896-14.7764 N, 120.9897-121.1338 E`, so much of it falls outside every sensor radius, keeps `water_depth_cm = 0.0`, and reads `PASSABLE`. Flood awareness is real but geographically partial (`HANDOFF.md:106-109`).
- **Routing latency at real scale.** `docs/FSD.md:384` records that NFR-002 does not currently hold at the real Quezon City scale against the hosted database.

---

## How to re-verify

```bash
# Production token present?
cd backend && vercel env ls --scope siahrays-projects | grep -i mapbox

# Provider gate and mode resolution
grep -n "mapbox_access_token\|routing_mode(graph_edges" backend/main.py
grep -n "def routing_mode" -A 20 backend/routing.py

# Map renderer actually in use
grep -n "react-native-maps\|rnmapbox" metroflow-mobile/package.json metroflow-mobile/src/navigation/RouteMap.tsx

# Contract tests
cd backend && venv/bin/python -m pytest -q tests/test_routing.py tests/test_api_integration.py -k "mapbox or fastest or routing_mode"
```
