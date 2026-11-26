# MetroFlow Algorithm Presentation — Code & UI Map

Reference for the algorithm/hydrology/routing video presentation. Shows exact code locations to display per segment, plus UI/visuals to demonstrate each algorithm.

> **Note:** Line numbers reflect the current workspace state. If they shift, search by function/class name.

---

## Part 2 — Algorithm Overview / Feature-to-Algorithm Mapping (Lapating)

**Talking points:** Different algorithms for different features: TD-A* routing, SCS-CN runoff, elevation-weighted ponding + speed degradation, PostGIS spatial analysis, nearest-unit ranking, sensor threshold/impact-radius detection, SSE/event streaming, offline queue + idempotent sync.

| What to show | File / lines | Why |
|---|---|---|
| Feature-to-algorithm mapping table/slide | Presentation slide (this script) | High-level map before deep dive |
| Routing engine entry | `backend/routing.py:338+` (`td_a_star_search`) | Main flood-aware pathfinding |
| Hydrology model | `backend/hydrology.py:1-80` | SCS-CN runoff + ponding depth |
| Spatial/event/offline modules | `backend/main.py`, `backend/events.py`, `metroflow-mobile/src/offline.ts` | Shows where each processing method lives |

**UI / visual:** Feature-to-Algorithm Mapping slide; optionally repo/module overview.

---

## Part 3 — Hydrology and Flood Simulation (Lapating)

**Talking points:** Rainfall intensity → SCS-CN direct runoff → street ponding depth; upstream node elevation affects ponding; affected edges updated; degraded avg speed computed; manual overrides preserved; result feeds TD-A*.

| What to show | File / lines | Why |
|---|---|---|
| SCS-CN config | `backend/config.py:38-50` (search `curve_number`, `ponding_amplification`) | Curve number and ponding amplification are configurable |
| SCS-CN runoff calculation | `backend/hydrology.py:8-43` (`calculate_scs_cn_runoff`) | `P = rainfall*duration`, `S`, `Ia`, `Q` runoff formula |
| Elevation-weighted ponding | `backend/hydrology.py:46-80` (`compute_node_water_depth`) | Runoff → street ponding cm; lower elevation gets deeper ponding; amplification factor |
| Simulation endpoint | `backend/main.py:555-640` (`POST /api/v1/simulation/rain`) | Runs runoff over graph, computes water depth per edge, updates `LiveEdgeState`, preserves overrides, batches DB updates, records audit |
| Manual override preservation | `backend/main.py` simulation loop: `if state is None or state.is_override: continue` | Simulations do not overwrite manually overridden road values |
| Speed degradation in simulation | `backend/main.py` simulation update: `avg_speed_kmh = max(10.0, edge.max_speed_kmh - (water_depth * 0.8))` | Flooded edges get degraded average speed |
| Hydrology tests | `backend/tests/test_hydrology.py` | Monotonic runoff/ponding, zero rainfall, elevation effect |

**UI / visual:**
- Admin dashboard/simulation controls: `metroflow-admin/app/dashboard/page.tsx` or triage/dashboard simulation UI (show rainfall control and map update).
- Map before/after simulation: road colors/status change on network map.

---

## Part 4 — Time-Dependent A* Routing (Siah)

**Talking points:** A* finds path by cost; time-dependent means edge cost changes with road conditions; graph = nodes/intersections + edges/roads; vehicle clearance gates submerged roads; returns path, geometry, segment statuses, ETA; no-safe-route error unless explicit least-submerged fallback; dry-state FASTEST can use Mapbox Directions, flood-safe stays in-house.

| What to show | File / lines | Why |
|---|---|---|
| Passability contract | `backend/routing.py:13-90` (`PASSABLE/LIGHT_FLOOD/SUBMERGED`, `classify_passability`, `routing_mode`) | Single source for map/routing status labels |
| Hazard blocking rule | `backend/routing.py:90-120` (`BLOCKING_OBSTRUCTION_LEVELS`, `hazard_blocks`) | Verified LEVEL_2/3/IMPASSABLE close roads |
| Advisory penalty / max speed | `backend/routing.py:250-290` (`ADVISORY_PENALTY`, `_max_graph_speed_kmh`) | Soft penalty for sensor advisory; admissible heuristic bound |
| TD-A* main search | `backend/routing.py:338-460` (`td_a_star_search`) | Haversine heuristic, `distance/max_speed` admissible bound, min-heap, settled set, clearance gate, water penalty, advisory penalty, traversal time |
| Least-submerged fallback | `backend/routing.py:300-360` (`_least_submerged_search`, called when `allow_submerged=True`) | Opt-in fallback ranks submerged metres, peak depth, then time |
| Route endpoint / mode selection | `backend/main.py:784-1065` (search `get_optimal_route`, `td_a_star_search`, `routing_mode`, Mapbox handoff) | Builds graph, chooses FASTEST/FLOOD_SAFE, dry-state Mapbox handoff, in-house TD-A* for flood-safe |
| Turn-by-turn/instructions | `backend/routing.py:120-250` (turn classification/constants) | FSD-FR-057 instruction generation support |
| Routing tests | `backend/tests/test_routing.py` | A* matches Dijkstra, admissible heuristic, clearance gate, fallback behavior |

**UI / visual:**
- Mobile route/map screen: `metroflow-mobile/src/app/(tabs)/map.tsx`, `metroflow-mobile/src/app/route.tsx`
- Admin route preview/dispatch radar: `metroflow-admin/app/radar/page.tsx`, triage/dashboard map components.
- Show route result with geometry, ETA, segment statuses; show blocked/submerged alternative and opt-in fallback messaging if available.

---

## Part 5A — Road Passability Classification (Gab)

**Talking points:** Edge classified by water depth vs vehicle clearance: PASSABLE, LIGHT_FLOOD, SUBMERGED; same state used by map and routing engine.

| What to show | File / lines | Why |
|---|---|---|
| Classification function | `backend/routing.py:60-90` (`classify_passability`) | `water >= clearance` submerged; `water >= caution` light flood; else passable |
| Status constants/contract | `backend/routing.py:13-30` | Shared contract between renderer and A* |
| Route segment status assignment | `backend/main.py` route building (search `classify_passability(`) | Route response includes per-segment status |
| Network state payload | `backend/main.py` `_build_network_state` / network endpoint | Map consumes same road-state vocabulary |

**UI / visual:**
- Admin/mobile map legend and colored road segments.
- Route details showing passable/light flood/submerged segments.

---

## Part 5B — PostGIS Spatial Operations (Gab)

**Talking points:** PostGIS handles points/lines/polygons; hazard polygon intersects roads; spatial proximity and sensor impact-radius calculations.

| What to show | File / lines | Why |
|---|---|---|
| Hazard geometry / spatial queries | `backend/main.py` hazard endpoints and spatial filters (search `ST_Intersects`, `ST_DWithin`, `ST_Distance`, `ST_SetSRID`) | Geographic relationships in DB, not plain numeric comparisons |
| Sensor impact radius query | `backend/main.py:3098-3165` (`_record_sensor_reading`, `ST_DWithin` on road edge geom vs sensor geom, geography cast) | Finds road edges within sensor impact radius in metres |
| Nearest sensor distance | `backend/main.py:3600-3700` (`get_nearest_sensor_reading`, `ST_Distance`) | Proximity check for report cross-reference |
| Point construction | `backend/main.py` `_point()` helper (search `ST_MakePoint`) | WGS84 lon/lat point creation |

**UI / visual:**
- Hazard polygon on admin map: `metroflow-admin/app/hazards/page.tsx`, radar/triage map.
- Sensor coverage/impact radius and affected roads on admin sensor/triage views.

---

## Part 5C — Nearest-Unit Ranking for Rescue Dispatch (Gab)

**Talking points:** SOS received → available units ranked by flood-aware travel time; not straight-line nearest; considers availability and flood-safe route.

| What to show | File / lines | Why |
|---|---|---|
| Dispatch preview/ranking | `backend/main.py:1680-1775` (`dispatch preview` / SOS assign preview area) | Filters AVAILABLE units, finds nearest graph node, computes route per unit, sorts by ETA; handles missing position/no safe route |
| Route used for rescue ETA | `backend/main.py` `get_optimal_route(...)` call inside dispatch ranking | Flood-aware routing, not straight-line distance |
| Availability constraint | `backend/main.py` SOS assign: `BRULE-011` / status AVAILABLE check | Unavailable units not assignable |

**UI / visual:**
- Admin Dispatch Radar / SOS triage: `metroflow-admin/app/radar/page.tsx`, `metroflow-admin/app/triage/page.tsx`
- Show ranked units, ETA, no-safe-route/missing-position detail.

---

## Part 5D — Sensor Threshold and Impact-Radius Detection (Aa)

**Talking points:** Receives readings, validates values, checks threshold breach; evaluates impact radius and identifies nearby road segments; advisory status; dispatcher confirmation required before operational closure.

| What to show | File / lines | Why |
|---|---|---|
| Sensor reading ingestion endpoint | `backend/main.py:3055-3097` (`POST /api/v1/sensors/readings`) | Gateway post, unit validation, breach audit, commit |
| Threshold + impact radius processing | `backend/main.py:3098-3165` (`_record_sensor_reading`) | `is_breach = value >= threshold`; `ST_DWithin` finds edges in impact radius; writes reading; upserts advisories |
| Advisory vs closure behavior | `backend/main.py` `_upsert_advisories` / flood-state logic (search `_upsert_advisories`, `advisory`) | Breach marks advisory; not automatic official closure |
| Sensor models/schemas | `backend/models.py` (`Sensor`, `SensorReading`), `backend/schemas.py` sensor schemas | Threshold, impact radius, reading fields |

**UI / visual:**
- Admin sensor/triage active sensors: `metroflow-admin/app/triage/page.tsx` (Active sensors section).
- Sensor readings/advisory effects on map/road state; dispatcher confirmation flow shown separately from sensor breach.

---

## Part 5E — Real-Time Event Streaming (Aa)

**Talking points:** SSE sends backend updates to connected clients; hazard publish saved + event recorded; relay checks event log and sends updates; ~40ms poll, supports Last-Event-ID reconnection.

| What to show | File / lines | Why |
|---|---|---|
| Event model/bus design | `backend/events.py:1-120` | Durable event_log bus, no gap/no phantom, replay via monotonic IDs, poll latency tradeoff |
| Emit/replay/cursor/stream | `backend/events.py:120-220` (`emit`, `latest_id`, `replay`, `parse_cursor`, `stream`) | Append event in same tx, Last-Event-ID resume, snapshot, heartbeat, poll loop |
| SSE endpoint wiring | `backend/main.py:2755-2845` (`_event_stream`, `/hazards/stream`, `/vehicles/stream`, `/sos/stream`) | Auth, snapshot+cursor, `text/event-stream`, no-store/no-buffer headers |
| Event emission on mutation | Search `events.emit(` in `backend/main.py` | Mutations append hazard/vehicle/SOS events |

**UI / visual:**
- Admin live updates in radar/triage/dashboard (hazards/vehicles/SOS update without manual refresh).
- Browser DevTools Network tab showing `text/event-stream` connection and `id/event/data` frames.

---

## Part 5F — Offline Queue and Idempotent Synchronization (Aa)

**Talking points:** Driver caches road graph, verified hazards, last route; queues reports/SOS while offline; retries on reconnect with idempotent client identifier; repeating same request should not create duplicates.

| What to show | File / lines | Why |
|---|---|---|
| Mobile offline cache/queue | `metroflow-mobile/src/offline.ts:1-80,150-210` | SQLite cache + `report_queue`, enqueue, ordered flush, stop on first network failure, drop non-retryable 4xx |
| Mobile connectivity/flush triggers | `metroflow-mobile/src/offline.ts` (`isOffline`, `useOnline`, flush hooks; search `NetInfo`, `AppState`) | Detects offline/online and retries queued work |
| Offline route planning | `metroflow-mobile/src/navigation/offline-route.ts` | Plans route over cached graph when offline |
| Client ID in report submit | `metroflow-mobile/src/api.ts` `submitReport` includes `client_id`; `metroflow-mobile/src/app/(tabs)/report.tsx` creates `newClientId()` | Same submission carries stable id |
| Backend idempotent replay | `backend/main.py:3854-3935` (`submit_report`, `client_id` check) | Existing report with same `client_id` + reporter hash returns existing report instead of duplicating |

**UI / visual:**
- Mobile Offline Data screen: `metroflow-mobile/src/app/offline.tsx` (cache stats, clear cache).
- Mobile report flow: offline save/pending banner/retry behavior.
- Mobile route/map using cached data when offline.

---

## Part 6 — Feature-to-Algorithm Checklist (Lapating)

| Feature | Algorithms / methods | Code to show |
|---|---|---|
| Flood simulation | SCS-CN runoff, elevation-weighted ponding, speed degradation | `backend/hydrology.py`, `backend/main.py:555-640` |
| Flood-aware navigation | Time-Dependent A*, vehicle-clearance checks | `backend/routing.py:338-460`, `backend/main.py` route endpoint |
| Road passability | Water-depth classification | `backend/routing.py:60-90` |
| Hazard/road analysis | PostGIS spatial operations | `ST_DWithin`/`ST_Intersects`/`ST_Distance` in `backend/main.py` |
| Rescue dispatch | Nearest-unit ranking, availability, flood-safe routing | `backend/main.py:1680-1775` |
| Sensor monitoring | Threshold validation, impact-radius detection | `backend/main.py:3055-3165` |
| Real-time updates | Event-log relay + SSE | `backend/events.py`, `backend/main.py:2755-2845` |
| Offline submission | Queued requests + idempotent sync | `metroflow-mobile/src/offline.ts`, `backend/main.py` report `client_id` |

**UI / visual:** The checklist slide; click through corresponding screens while narrating.

---

## Part 7 — Benchmarking Analysis (Siah/Lapating/Gab/Aa)

**Talking points:** Reported times are API-level p95/median measurements, not isolated algorithm microbenchmarks; include request handling, DB access, serialization, hosted infra effects.

| What to show | File / visual | Why |
|---|---|---|
| Performance/test dashboard | `docs/` performance/test dashboard or final doc artifacts (search `Test Dashboard`, `p95`, `NFR-001` in `docs/`) | Official reported results and targets |
| Network state endpoint | `backend/main.py` `/api/v1/network/state`, `_build_network_state` | Large GeoJSON serialization and DB load path |
| Routing endpoint | `backend/main.py` route endpoint, `backend/routing.py` | Pathfinding + DB/geometry load; optimized to load needed edge IDs |
| SSE publication | `backend/events.py` poll interval `event_stream_poll_ms`, emit/stream flow | Server-side event publication latency |
| Telemetry throttling | `backend/main.py:2635-2705` telemetry rate limit | 1 batch / 5s per device behavior |
| Mobile startup/offline cache | `metroflow-mobile/src/offline.ts`, app startup screens | Cold-start and offline behavior context |

**UI / visual:**
- Performance Test Results slide / Test Dashboard from docs.
- Network tab timings for `/network/state`, `/route`, SSE stream.
- Be explicit: “API p95 on hosted setup”, not “TD-A* took X ms”.

---

## Part 8 — Limitations and Conclusion (Siah/Lapating)

**Talking points:** NOAH import/rain-gated routing penalty not implemented; Open-Meteo + GloFAS advisory used, some sources unimplemented; full offline basemap tiles not cached; hosted API performance needs improvement; don’t present estimated/incomplete data as fully verified.

| What to show | File / visual | Why |
|---|---|---|
| Limitations/backlog/docs | `BACKLOG.md`, `AGENTS.md`, `docs/final document/BRD.md`, `docs/final document/TSD.md` | Scope and known limitations are documented |
| Offline scope | `metroflow-mobile/src/offline.ts`, `metroflow-mobile/src/app/offline.tsx` | Caches graph/hazards/last route, not basemap tiles |
| Weather/flood sources | `backend/weather.py`, `backend/main.py` ingest paths | Open-Meteo/GloFAS live sources; NOAH/manual sources limited as documented |
| Performance gaps | Test dashboard/performance docs | Hosted network/routing/SSE targets missed |

**UI / visual:** Limitations slide + final system overview/architecture diagram.

---

## Presentation Risks / Honesty Checks

- **Do not present API p95 as pure algorithm runtime.** It includes HTTP, DB, serialization, and hosted infra overhead.
- **Do not claim full offline maps.** Only road graph, verified hazards, and last route are cached; basemap tiles are out of scope.
- **Do not claim NOAH/rain-gated penalty/manual river gauge/NASA IMERG are fully implemented** unless you verify current status.
- **Least-submerged fallback is opt-in** and must be described as not a safe route.
- **Sensor breach is advisory** until dispatcher confirmation/operational decision, per design. 
