# API Reference — MetroFlow Core API

| Field                     | Value                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| Document ID               | MF-API-001                                                               |
| Version                   | 1.3                                                                      |
| Status                    | Matches `main` after route enforcement; §9 is the approved CR-001 contract |
| Date                      | 27 October 2026                                                          |
| Base URL (local)          | `http://localhost:8000`                                                  |
| Base URL (hosted)         | `https://metroflow-api-siahrays-projects.vercel.app`                     |
| Machine-readable contract | `GET /openapi.json`                                                      |
| Related documents         | [FSD.md](FSD.md), [TSD.md](TSD.md)                                       |

## 1. Overview

The API computes flood depth over a road graph and returns clearance-aware
routes. Responses are JSON; geometry is GeoJSON.

Sections 2–8 document the core API. Section 9 documents the endpoints added by
[CR-001](CR-001.md), which is approved and implemented in this branch for auth,
SOS, hazards, vehicles and dispatch; the remaining CR-001 endpoints are listed
as absent in §9.7. The generated `/openapi.json` is always authoritative for
what is running.

| Method | Path                       | Purpose                                                  |
| ------ | -------------------------- | -------------------------------------------------------- |
| `GET`  | `/`                        | Health and identity                                      |
| `GET`  | `/api/v1/network/state`    | Every node and edge with live depth and passability      |
| `POST` | `/api/v1/simulation/rain`  | Run a rainfall simulation and return the updated network |
| `GET`  | `/api/v1/routing/navigate` | Fastest route that respects vehicle clearance            |

### 1.1 Conventions

| Convention       | Rule                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| Coordinate order | `[longitude, latitude]` (GeoJSON), SRID 4326                         |
| Units            | Distance metres, speed km/h, water depth centimetres, rainfall mm/hr |
| Timestamps       | ISO 8601, UTC (`2026-10-21T12:00:00Z`)                               |
| Content type     | `application/json`                                                   |
| Authentication   | `Authorization: Bearer <token>` on every route except the auth entry points |
| Parameters       | Query parameters on `GET` routes; JSON bodies on `POST`/`PATCH` routes |
| Versioning       | Path prefix `/api/v1`; breaking changes move to `/api/v2`            |

### 1.2 Authentication

The API issues its own session tokens. Clients post credentials to
`POST /api/v1/auth/login`; the API verifies the bcrypt hash stored on the
`users` row and returns a signed HS256 JWT. `GET /api/v1/auth/me` requires that
token and returns the caller's identity and role.

Two role families exist. `LGU_DISPATCHER` and `SUPER_ADMIN` are portal roles and
are provisioned by the operator, never self-registered. `EMERGENCY_DRIVER` is
the field role and is created by `POST /api/v1/auth/register`; the endpoint
refuses to mint an administrative role.

Every route requires that token except the four auth entry points — `login`,
`register`, `send-verification` and `verify` — and the health check at `/`. A
missing, malformed or expired token returns `401`.

Authorisation is separate from authentication. Portal roles (`LGU_DISPATCHER`,
`SUPER_ADMIN`) may change shared state and read incident data; a driver account
(`EMERGENCY_DRIVER`) may read the network, hazards, routes and fleet, and create
SOS requests. A denied action returns `403`.

| Route                                                                      | Driver | Portal |
| -------------------------------------------------------------------------- | ------ | ------ |
| `GET /network/state`, `GET /routing/navigate`, `GET /hazards`, `GET /vehicles` | yes    | yes    |
| `POST /sos`, `GET /auth/me`                                                | yes    | yes    |
| `GET /sos`                                                                 | no     | yes    |
| `POST /sos/{id}/assign`, `POST /dispatch/{id}/confirm`                     | no     | yes    |
| `POST /simulation/rain`                                                    | no     | yes    |
| `POST`/`PATCH` `/hazards*` and `/vehicles*`                                | no     | yes    |

Both clients attach `Authorization: Bearer <token>`. The portal keeps the token
in `sessionStorage` for the browser session and returns to the login screen when
the API answers `401`; the driver app keeps it in memory for the app session and
tells the user to sign in if a request is rejected.

The examples below send `-H "Authorization: Bearer $TOKEN"`. Get `TOKEN` from
the login response:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dispatcher@metroflow.local","password":"metroflow-dev"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
```

Two operational notes. `METROFLOW_ADMIN_EMAIL` and `METROFLOW_ADMIN_PASSWORD`
seed the first dispatcher when the user table is empty, because registration
cannot create one. Email verification codes are held in process memory by the
current `verification_store` module, so they do not survive a restart or a
second instance; requiring a code is therefore not enabled by default.

### 1.3 Response headers

Every response carries:

| Header                         | Value                             |
| ------------------------------ | --------------------------------- |
| `X-Content-Type-Options`       | `nosniff`                         |
| `Cross-Origin-Resource-Policy` | `cross-origin`                    |
| `Referrer-Policy`              | `strict-origin-when-cross-origin` |
| `X-Frame-Options`              | `DENY`                            |

CORS allows any origin by default; set `METROFLOW_CORS_ORIGINS` to a
comma-separated portal allowlist before exposure (TSD SEC-002 / LIM-005).
Credentialed requests are only advertised when that list is explicit, because a
wildcard and credentials cannot be combined safely. The native app sends no
`Origin` header and uses bearer tokens, so this setting does not affect it.

### 1.4 Passability status

| Value         | Meaning                                  | Rule                                       |
| ------------- | ---------------------------------------- | ------------------------------------------ |
| `PASSABLE`    | Vehicle can drive normally               | `depth < caution_depth_cm` (default 10 cm) |
| `LIGHT_FLOOD` | Drivable with caution; speed is degraded | `caution_depth_cm <= depth < clearance_cm` |
| `SUBMERGED`   | Impassable for the requested clearance   | `depth >= clearance_cm`                    |

Both comparisons are inclusive. `clearance_cm` defaults to 30 cm and must be
`> 0` and `<= 200`.

### 1.5 Error model

| Status | When                                                   | Body                                  |
| ------ | ------------------------------------------------------ | ------------------------------------- |
| `401`  | Missing, malformed or expired token                    | `{"detail": "<message>"}`             |
| `403`  | The caller's role may not perform this action          | `{"detail": "<message>"}`             |
| `404`  | Unknown node, or no route survives the clearance check | `{"detail": "<message>"}`             |
| `422`  | Parameter fails validation                             | FastAPI validation object (see §6)    |
| `429`  | The caller exceeded a request ceiling (§1.6)           | `{"detail": "<message>"}` + `Retry-After` |
| `500`  | Unhandled server or database error                     | `{"detail": "Internal Server Error"}` |

### 1.6 Request limits

The routes worth abusing are limited per client address in fixed one-minute
windows (TSD LIM-006). The counter lives in Postgres, not in the process, because
a serverless instance may be replaced between two requests. Limits are set in
`config.py` and can be disabled with `0` (the test suite does).

| Route                              | Bucket             | Default | Setting |
| ---------------------------------- | ------------------ | ------- | ------- |
| `POST /api/v1/auth/login`          | `login`            | 15/min  | `METROFLOW_RATE_LIMIT_LOGIN_PER_MIN` |
| `POST /api/v1/auth/register`       | `register`         | 10/min  | `METROFLOW_RATE_LIMIT_REGISTER_PER_MIN` |
| `POST /api/v1/auth/send-verification` | `send-verification` | 10/min | `METROFLOW_RATE_LIMIT_REGISTER_PER_MIN` |
| `POST /api/v1/auth/verify`         | `verify`           | 10/min  | `METROFLOW_RATE_LIMIT_REGISTER_PER_MIN` |
| `POST /api/v1/sos`                 | `sos`              | 20/min  | `METROFLOW_RATE_LIMIT_SOS_PER_MIN` |
| `POST /api/v1/reports`             | `reports`          | 12/min  | `METROFLOW_RATE_LIMIT_REPORTS_PER_MIN` |
| `POST /api/v1/simulation/rain`     | `simulation`       | 12/min  | `METROFLOW_RATE_LIMIT_SIMULATION_PER_MIN` |

A refused request returns `429` with `Retry-After` in seconds; the waiting time
is the remainder of the current window, never more than 60 seconds. A failed
attempt counts: fifteen wrong passwords still exhaust the login quota. If the
counter database cannot be reached the request is **allowed** and a warning is
logged — an outage must not turn into a blanket `429`.

The limit is keyed on the first `X-Forwarded-For` entry, which the host
overwrites, falling back to the socket address. It is per address, not per
account, so a shared office NAT shares one quota.

### 1.7 External services

| Service        | Consumed by    | Role                                         |
| -------------- | -------------- | -------------------------------------------- |
| Carto          | Portal (basemap) | Keyless Positron vector style fetched by URL; no token, no runtime key |
| Mapbox         | Optional swap     | A licensed raster style can replace the Carto style URL     |
| OpenWeather    | Backend (planned, CR-001) | Optional rainfall; manual entry fallback     |
| OpenTopography | Preprocessing  | Terrain model; cached, not called at runtime |
| Copernicus     | Preprocessing  | Imagery and land cover; cached               |

No provider key is accepted from a client request. Provider failures degrade the
affected feature and never block routing, reporting or SOS.

---

## 2. `GET /api/v1/network/state`

Returns the full renderable road network for one clearance profile.

### 2.1 Parameters

| Name           | In    | Type   | Required | Default | Constraints     |
| -------------- | ----- | ------ | -------- | ------- | --------------- |
| `clearance_cm` | query | number | no       | `30`    | `> 0`, `<= 200` |

### 2.2 Response `200`

| Field          | Type   | Description                                          |
| -------------- | ------ | ---------------------------------------------------- |
| `clearance_cm` | number | Echo of the profile used for classification          |
| `generated_at` | string | UTC timestamp of the response                        |
| `edges`        | object | GeoJSON `FeatureCollection` of `LineString` features |
| `nodes`        | object | GeoJSON `FeatureCollection` of `Point` features      |

**Edge feature**

| Field                       | Type           | Description                                |
| --------------------------- | -------------- | ------------------------------------------ |
| `id`                        | integer        | `edge_id`                                  |
| `geometry.type`             | string         | `LineString`                               |
| `geometry.coordinates`      | array          | `[[lon, lat], ...]`                        |
| `properties.edge_id`        | integer        | Edge identifier                            |
| `properties.start_node_id`  | integer        | Origin node                                |
| `properties.end_node_id`    | integer        | Destination node                           |
| `properties.start_name`     | string \| null | Human label of the origin                  |
| `properties.end_name`       | string \| null | Human label of the destination             |
| `properties.distance_m`     | number         | Segment length in metres                   |
| `properties.max_speed_kmh`  | number         | Posted speed                               |
| `properties.avg_speed_kmh`  | number         | Current speed after flood degradation      |
| `properties.water_depth_cm` | number         | Current depth, 2 decimal places            |
| `properties.status`         | string         | `PASSABLE` \| `LIGHT_FLOOD` \| `SUBMERGED` |
| `properties.is_override`    | boolean        | True when an operator override is active   |

**Node feature**

| Field                    | Type           | Description                           |
| ------------------------ | -------------- | ------------------------------------- |
| `id`                     | integer        | `node_id`                             |
| `geometry.type`          | string         | `Point`                               |
| `geometry.coordinates`   | array          | `[lon, lat]`                          |
| `properties.node_id`     | integer        | Node identifier                       |
| `properties.name`        | string \| null | Human label                           |
| `properties.elevation_m` | number         | Elevation used by the hydrology model |

### 2.3 Example

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/network/state?clearance_cm=30"
```

```json
{
  "clearance_cm": 30.0,
  "generated_at": "2026-10-21T12:00:00Z",
  "edges": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "id": 1,
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [121.0553, 14.5491],
            [121.0581, 14.5583]
          ]
        },
        "properties": {
          "edge_id": 1,
          "start_node_id": 1,
          "end_node_id": 2,
          "start_name": "C5 - Market Market",
          "end_name": "C5 - Kalayaan Ave",
          "distance_m": 1100.0,
          "max_speed_kmh": 60.0,
          "avg_speed_kmh": 60.0,
          "water_depth_cm": 0.0,
          "status": "PASSABLE",
          "is_override": false
        }
      }
    ]
  },
  "nodes": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "id": 1,
        "geometry": { "type": "Point", "coordinates": [121.0553, 14.5491] },
        "properties": {
          "node_id": 1,
          "name": "C5 - Market Market",
          "elevation_m": 8.5
        }
      }
    ]
  }
}
```

The example is abbreviated: the pilot graph returns 34 nodes and 61 edges. Nodes
1-4 are the original C5 spine used by the routing tests; the rest of the lattice
covers the Pasig / Taguig arterials (TSD LIM-014).

### 2.4 Errors

| Status | Condition                                                     |
| ------ | ------------------------------------------------------------- |
| `422`  | `clearance_cm` is `0`, negative, above `200`, or not a number |

---

## 3. `POST /api/v1/simulation/rain`

Runs the SCS-CN runoff model over the graph, persists the resulting depth on
every edge that is not manually overridden, and returns the updated network in
the same response.

`POST` is used although all inputs are query parameters, because the call
mutates server state and must not be triggered by a prefetch or crawler.

### 3.1 Parameters

| Name             | In    | Type   | Required | Default | Constraints      |
| ---------------- | ----- | ------ | -------- | ------- | ---------------- |
| `rainfall_mm_hr` | query | number | **yes**  | —       | `>= 0`, `<= 250` |
| `clearance_cm`   | query | number | no       | `30`    | `> 0`, `<= 200`  |

### 3.2 Behaviour

1. Runoff `Q` is computed with the SCS Curve Number model (`CN = 85`,
   duration `1 h`): `S = 25400/CN - 254`, `Ia = 0.2S`, `Q = (P - Ia)^2 / (P - Ia + S)`.
2. For each non-overridden edge, ponding depth is derived from the elevation of
   its **start node**: `depth_cm = (Q/10) x (1 + (10 - min(elev,10)) x 0.15) x 3.5`.
3. `avg_speed_kmh` becomes `max(10, max_speed_kmh - depth_cm x 0.8)`.
4. The transaction commits once, then the network is rebuilt and returned.

`affected_edges` counts only edges that were actually written. Edges with
`is_override = true` are skipped and are not counted.

### 3.3 Response `200`

All fields of §2.2, plus:

| Field            | Type    | Description                             |
| ---------------- | ------- | --------------------------------------- |
| `rainfall_mm_hr` | number  | Echo of the supplied intensity          |
| `runoff_mm`      | number  | Direct surface runoff, 4 decimal places |
| `affected_edges` | integer | Edges written by this simulation        |
| `message`        | string  | Human-readable confirmation             |

### 3.4 Example

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/simulation/rain?rainfall_mm_hr=80&clearance_cm=30"
```

```json
{
  "clearance_cm": 30.0,
  "generated_at": "2026-10-21T12:00:00Z",
  "rainfall_mm_hr": 80.0,
  "runoff_mm": 43.5531,
  "affected_edges": 61,
  "message": "Simulated 80.0 mm/hr rainfall",
  "edges": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "id": 1,
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [121.0553, 14.5491],
            [121.0581, 14.5583]
          ]
        },
        "properties": {
          "edge_id": 1,
          "start_node_id": 1,
          "end_node_id": 2,
          "start_name": "C5 - Market Market",
          "end_name": "C5 - Kalayaan Ave",
          "distance_m": 1100.0,
          "max_speed_kmh": 60.0,
          "avg_speed_kmh": 45.06,
          "water_depth_cm": 18.67,
          "status": "LIGHT_FLOOD",
          "is_override": false
        }
      },
      {
        "type": "Feature",
        "id": 3,
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [121.0581, 14.5583],
            [121.0631, 14.5672]
          ]
        },
        "properties": {
          "edge_id": 3,
          "start_node_id": 3,
          "end_node_id": 4,
          "start_name": "C5 - Bagong Ilog",
          "end_name": "Pasig Blvd - Shaw",
          "distance_m": 850.0,
          "max_speed_kmh": 50.0,
          "avg_speed_kmh": 25.91,
          "water_depth_cm": 30.11,
          "status": "SUBMERGED",
          "is_override": false
        }
      }
    ]
  },
  "nodes": { "type": "FeatureCollection", "features": [] }
}
```

The example omits the other 57 edges and all node features for brevity. The four
spine edges these inputs produce are: edge 1 `18.67 cm / LIGHT_FLOOD`, edge 2
`28.51 cm / LIGHT_FLOOD`, edge 3 `30.11 cm / SUBMERGED`, edge 4
`18.67 cm / LIGHT_FLOOD` at a 30 cm clearance. The run writes all 61 edges: 58
`LIGHT_FLOOD` and 3 `SUBMERGED`.

### 3.5 Errors

| Status | Condition                                                       |
| ------ | --------------------------------------------------------------- |
| `422`  | `rainfall_mm_hr` missing, negative, above `250`, or not numeric |
| `422`  | `clearance_cm` outside `(0, 200]`                               |
| `429`  | More than 12 simulations a minute from one address (§1.6)       |

### 3.6 Side effect warning

The simulation is **not idempotent in the database sense**: it overwrites live
state. Two calls with the same intensity produce the same depths (the model is a
pure function of rainfall and elevation), but the intermediate state is visible
to other readers between commits. There is no history table; a previous state
cannot be recovered through the API.

---

## 4. `GET /api/v1/routing/navigate`

Returns the fastest path that avoids every edge whose depth is at or above the
requested clearance.

### 4.1 Parameters

| Name           | In    | Type    | Required | Default | Constraints     |
| -------------- | ----- | ------- | -------- | ------- | --------------- |
| `start_node`   | query | integer | **yes**  | —       | Must exist      |
| `target_node`  | query | integer | **yes**  | —       | Must exist      |
| `clearance_cm` | query | number  | no       | `30`    | `> 0`, `<= 200` |

### 4.2 Response `200`

| Field                           | Type      | Description                                                 |
| ------------------------------- | --------- | ----------------------------------------------------------- |
| `start_node`                    | integer   | Echo of the origin                                          |
| `target_node`                   | integer   | Echo of the destination                                     |
| `vehicle_clearance_cm`          | number    | Clearance used for blocking                                 |
| `optimal_path_nodes`            | integer[] | Ordered node ids, origin first                              |
| `geometry`                      | object    | GeoJSON `LineString`, oriented along travel                 |
| `segments`                      | object[]  | One entry per traversed edge                                |
| `estimated_travel_time_minutes` | number    | Travel time under current depth penalties, 2 decimal places |

**Segment**

| Field            | Type    | Description                        |
| ---------------- | ------- | ---------------------------------- |
| `edge_id`        | integer | Edge traversed                     |
| `start_node_id`  | integer | Hop origin (direction of travel)   |
| `end_node_id`    | integer | Hop destination                    |
| `water_depth_cm` | number  | Depth at request time              |
| `status`         | string  | Status for the requested clearance |

`segments` is empty when origin equals destination. `optimal_path_nodes` then
contains a single id and `geometry` is a degenerate two-point line at that node.

### 4.3 Cost function

```
penalty   = 1 + (depth_cm / 10)^1.8
speed_m_s = max((max_speed_kmh / 3.6) / penalty, 0.5)
cost      = distance_m / speed_m_s          (seconds)
```

An edge is skipped entirely when `depth_cm >= clearance_cm`. The heuristic is
`haversine(node, target) / fastest_graph_speed`, which never overestimates, so
the returned path is optimal for this cost function (TSD §6.4).

### 4.4 Example — dry network

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/routing/navigate?start_node=1&target_node=4&clearance_cm=30"
```

```json
{
  "start_node": 1,
  "target_node": 4,
  "vehicle_clearance_cm": 30.0,
  "optimal_path_nodes": [1, 2, 3, 4],
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [121.0553, 14.5491],
      [121.0581, 14.5583],
      [121.0631, 14.5672],
      [121.0685, 14.5731]
    ]
  },
  "segments": [
    {
      "edge_id": 1,
      "start_node_id": 1,
      "end_node_id": 2,
      "water_depth_cm": 0.0,
      "status": "PASSABLE"
    },
    {
      "edge_id": 2,
      "start_node_id": 2,
      "end_node_id": 3,
      "water_depth_cm": 0.0,
      "status": "PASSABLE"
    },
    {
      "edge_id": 3,
      "start_node_id": 3,
      "end_node_id": 4,
      "water_depth_cm": 0.0,
      "status": "PASSABLE"
    }
  ],
  "estimated_travel_time_minutes": 3.32
}
```

The three-hop corridor (1100 m at 60 km/h, 1000 m at 50, 850 m at 50) takes
199.2 s, faster than the direct 2800 m edge at 40 km/h (252 s).

### 4.5 Example — after the §3.4 simulation

With `clearance_cm=30` and edge 3 at `30.11 cm`, the three-hop path is blocked.
The direct edge 1 → 4 survives at `18.67 cm`, so the response becomes:

```json
{
  "start_node": 1,
  "target_node": 4,
  "vehicle_clearance_cm": 30.0,
  "optimal_path_nodes": [1, 4],
  "segments": [
    {
      "edge_id": 4,
      "start_node_id": 1,
      "end_node_id": 4,
      "water_depth_cm": 18.67,
      "status": "LIGHT_FLOOD"
    }
  ],
  "estimated_travel_time_minutes": 17.12
}
```

### 4.6 Errors

| Status | Condition                             | `detail`                                                  |
| ------ | ------------------------------------- | --------------------------------------------------------- |
| `404`  | Origin does not exist                 | `Unknown start_node 99. Available nodes: [1, 2, 3, 4]`    |
| `404`  | Destination does not exist            | `Unknown target_node 99. Available nodes: [1, 2, 3, 4]`   |
| `404`  | Every path is blocked                 | `No safe route available under current flood conditions.` |
| `422`  | Missing `start_node` or `target_node` | Validation object                                         |
| `422`  | `clearance_cm` outside `(0, 200]`     | Validation object                                         |

A blocked route is a `404`, never a `200` with an empty path. Clients should
treat the two node errors and the blocked-route error differently: the first
two indicate a client bug, the third is a legitimate operational answer.

---

## 5. `GET /`

Health and identity probe. Also used by the container `HEALTHCHECK`.

```bash
curl -s http://localhost:8000/
```

```json
{
  "status": "online",
  "system": "MetroFlow API Core Engine",
  "architecture": "Dual-Interface (LGU + Driver)"
}
```

This endpoint does **not** verify database connectivity. A `200` means the
process is serving requests, not that queries will succeed.

---

## 6. Validation error shape

FastAPI returns `422` with the failing location and reason.

```json
{
  "detail": [
    {
      "type": "less_than_equal",
      "loc": ["query", "clearance_cm"],
      "msg": "Input should be less than or equal to 200",
      "input": "250",
      "ctx": { "le": 200 }
    }
  ]
}
```

| Symptom                      | Likely cause                                              |
| ---------------------------- | --------------------------------------------------------- |
| `422` on every call          | Parameter sent in a JSON body instead of the query string |
| `404` naming available nodes | `start_node`/`target_node` not seeded                     |
| Empty `segments`             | Origin equals destination                                 |
| All edges `SUBMERGED`        | Clearance lower than simulated depth                      |

---

## 7. Client guidance

1. Call `GET /api/v1/network/state` on load and after any simulation.
2. Send the **same** `clearance_cm` to the network and routing endpoints; a
   route computed for a different clearance is not valid for the vehicle.
3. Treat `SUBMERGED` as a hard block, `LIGHT_FLOOD` as a warning that should be
   surfaced to the driver, and `PASSABLE` as no warning.
4. Do not cache network state across a simulation.
5. Handle `404` from routing as an operational outcome and show the message to
   the dispatcher; do not retry blindly.
6. On `429`, wait for the `Retry-After` seconds before retrying and show that
   wait to the user. Do not retry immediately: a burst of retries extends the
   block instead of recovering from it.

---

## 8. Versioning and change policy

| Change                                                                     | Version impact                                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Additive field                                                             | Same version; clients must ignore unknown fields                      |
| New optional parameter                                                     | Same version                                                          |
| New required parameter, removed field, changed status value, changed units | New path version `/api/v2`                                            |
| Threshold default change                                                   | Configuration change; documented in release notes, not a version bump |

The generated OpenAPI document is the authoritative machine-readable contract.
This file explains it; if the two disagree, `/openapi.json` is correct and this
document has a defect.

---

## 9. CR-001 endpoints

These routes exist and are called by the portal and the driver app. Request and
response models live in `backend/schemas.py`. All of them, and the rest of the
API, require a bearer token except the four auth entry points in §9.1.

### 9.1 Authentication

| Method | Path                           | Body / query                          | Response                    | Reference               |
| ------ | ------------------------------ | ------------------------------------- | --------------------------- | ----------------------- |
| `POST` | `/api/v1/auth/login`           | `email`, `password`                   | `access_token`, `user`      | BR-009 / FSD-FR-018–023 |
| `POST` | `/api/v1/auth/register`        | `name`, `email`, `password`, `role`   | `user` (`201`)              | BR-009 / FSD-FR-018–023 |
| `GET`  | `/api/v1/auth/me`              | Bearer token                          | `user`                      | BR-009 / FSD-FR-020     |
| `POST` | `/api/v1/auth/send-verification` | `email`                             | `message`, dev-only `code`  | BR-009 / FSD-FR-022     |
| `POST` | `/api/v1/auth/verify`          | `email`, `code`                       | `verified`                  | BR-009 / FSD-FR-022     |

Registration accepts `DRIVER`, `COMMUTER` or `EMERGENCY_DRIVER` and stores
`EMERGENCY_DRIVER`. It returns `403` for `LGU_DISPATCHER` and `SUPER_ADMIN`,
`409` for a duplicate email, and `422` for a missing name, malformed email or a
password shorter than eight characters. `GET /api/v1/auth/me` returns the
caller's identity from the token and `401` without a valid `Authorization`
header.

`send-verification` returns the code in the response body unless
`FASTAPI_ENV=production`. The code store is in-process, so a restart clears it.

### 9.2 SOS and dispatch

| Method | Path                               | Body                   | Response | Reference                |
| ------ | ---------------------------------- | ---------------------- | -------- | ------------------------ |
| `POST` | `/api/v1/sos`                      | `latitude`, `longitude`, `note?` | `sos`    | BR-015 / FSD-FR-073      |
| `GET`  | `/api/v1/sos`                      | —                      | `sos[]`  | BR-015 / FSD-FR-074, 087 |
| `POST` | `/api/v1/sos/{sos_id}/assign`      | `vehicle_id`           | `sos`    | BR-016 / FSD-FR-088–089  |
| `GET`  | `/api/v1/dispatch/{sos_id}/preview` | —                    | `{ sos_id, units[] }` | BR-016 / FSD-FR-088–089 |
| `POST` | `/api/v1/dispatch/{sos_id}/confirm` | `note?`               | `sos`    | BR-016 / FSD-FR-089      |

A new SOS is created with `status = "pending"`. Assignment sets the vehicle and
moves the status to `"assigned"`, returning `404` when either the SOS or the
vehicle does not exist. Confirmation appends the note to the existing one rather
than replacing it, so the original distress text survives.

The preview lists only `AVAILABLE` units, snaps each unit and the incident onto
the nearest road node, and ranks them by flood-safe travel time (BRULE-008
hazards excluded). A unit with no reported position or no passable route comes
back with a `detail` message and no ETA; it is still assignable. Assignment
enforces BRULE-011: a unit that is not `AVAILABLE` is refused with `409`, an
accepted assignment sets it to `DISPATCHED`, and undo or reject returns it to
`AVAILABLE`.

### 9.3 Hazards

| Method  | Path                              | Body                                                        | Response | Reference               |
| ------- | --------------------------------- | ----------------------------------------------------------- | -------- | ----------------------- |
| `POST`  | `/api/v1/hazards`                 | `name`, `obstruction_level`, `avg_depth_cm`, `edge_id`, `notes?` | `hazard` | BR-016 / FSD-FR-082–085 |
| `PATCH` | `/api/v1/hazards/{hazard_id}`     | any of the above fields, plus `active`                      | `hazard` | BR-016 / FSD-FR-084–085 |
| `POST`  | `/api/v1/hazards/{hazard_id}/publish` | —                                                       | `hazard` | BR-016 / FSD-FR-085     |
| `GET`   | `/api/v1/hazards`                 | —                                                           | `hazard[]` | BR-013 / FSD-FR-059   |
| `GET`   | `/api/v1/hazards/active`          | —                                                           | `hazard[]` | BR-013 / FSD-FR-059   |

A hazard is created active but unpublished; `publish` stamps `published_at` and
is the step the portal performs before dispatch. Depth is in centimetres.
`GET /api/v1/hazards/active` is the driver map's hazard layer; it returns the same
rows as `GET /api/v1/hazards?active=true`.

### 9.4 Fleet

| Method  | Path                            | Body                                                       | Response    | Reference               |
| ------- | ------------------------------- | ---------------------------------------------------------- | ----------- | ----------------------- |
| `GET`   | `/api/v1/vehicles`              | —                                                          | `vehicle[]` | BR-016 / FSD-FR-075–076 |
| `POST`  | `/api/v1/vehicles`              | `call_sign`, `vehicle_type`, `clearance_cm`, `speed_kmh`   | `vehicle`   | BR-016 / FSD-FR-075     |
| `PATCH` | `/api/v1/vehicles/{vehicle_id}` | any of the above, plus `status`                            | `vehicle`   | BR-016 / FSD-FR-076     |

Clearance is in centimetres and speed in km/h, matching §2 and the driver UI.

### 9.5 Field reports and moderation

| Method | Path                                 | Body / query                                                  | Response   | Reference               |
| ------ | ------------------------------------ | ------------------------------------------------------------- | ---------- | ----------------------- |
| `POST` | `/api/v1/reports`                    | multipart: `depth_level`, `latitude`, `longitude`, `narrative?`, `barangay?`, `captured_at?`, `source?`, `photo?` | `report` `201` | BR-014 / FSD-FR-065–067 |
| `GET`  | `/api/v1/reports`                    | `status?` (default `PENDING`), `limit?` (1–200, default 50)   | `report[]` | BR-014 / FSD-FR-077     |
| `GET`  | `/api/v1/reports/{id}`               | —                                                             | `report`   | BR-014 / FSD-FR-078–079 |
| `GET`  | `/api/v1/reports/{id}/photo`         | —                                                             | image      | BR-014 / FSD-FR-078     |
| `POST` | `/api/v1/reports/{id}/approve`       | `notes?`                                                      | `report`   | BR-014 / FSD-FR-080     |
| `POST` | `/api/v1/reports/{id}/reject`        | `reason`, `duplicate_of?`                                     | `report`   | BR-014 / FSD-FR-081     |

Submission is multipart because the evidence is a file; send the fields as form
parts and `photo` as the file part. Any authenticated account may report — a
driver is the witness — while the queue and the decisions are portal roles only.
The reporter is stored as a salted hash of the account, never as an id (BR-011),
so the desk can see that two reports came from one device without learning whose.

`depth_level` is `ANKLE`, `KNEE` or `IMPASSABLE`, and `source` is `PHOTO`,
`SENSOR` or `CALL` (default `PHOTO` with evidence, otherwise `CALL`).
Photos must be JPEG, PNG or WebP, decided from the bytes rather than the declared
`Content-Type`, and are capped at 4 MB (`413` above it, `415` for anything else).
The ceiling sits below the hosting platform's request-body limit, so an oversized
upload is refused by the API with a useful message rather than by the platform.
EXIF is read when present: camera make and model, capture time and GPS, with
`gps_in_pilot_area` flagging a photo taken outside Metro Manila.

`GET /api/v1/reports/{id}/photo` is the only way to read evidence bytes. It needs
the same bearer token as every other management route and answers
`Cache-Control: private, no-store`, so an `<img src>` pointed at it arrives
unsigned and is refused — a client fetches it with its token and renders the
response as a blob. The `report` body carries only the metadata (`mime`,
`sha256`, `bytes`), never the bytes themselves.

```json
{
  "report_id": "6a1d0f38-3d19-4b5e-9d6a-0f0d9c2f7a41",
  "reporter_hash": "b0e1…",
  "source": "PHOTO",
  "depth_level": "KNEE",
  "depth_label": "Knee-Deep",
  "status": "PENDING",
  "latitude": 14.5764,
  "longitude": 121.0851,
  "location_plausible": true,
  "barangay": "San Antonio",
  "narrative": "Knee-deep outside the barangay hall",
  "urgency_score": 2.61,
  "nearby_reports": 1,
  "possible_duplicate_of": null,
  "photo": { "mime": "image/jpeg", "sha256": "9f2c…", "bytes": 184320 },
  "exif": { "camera_make": "Apple", "captured_at": "2026:10:29 13:00:00", "gps_latitude": 14.5764, "gps_longitude": 121.0851, "gps_in_pilot_area": true },
  "captured_at": "2026-10-29T13:00:00",
  "submitted_at": "2026-10-29T13:04:12",
  "duplicate_of": null,
  "moderated_by": null,
  "moderated_at": null,
  "decision_reason": null,
  "hazard_id": null
}
```

`urgency_score` is the stored submission-time score multiplied by the recency
decay for the report's age (TSD §2.8), so the queue sorts by what still matters
rather than by intake order. `nearby_reports` counts pending reports inside 150 m
and 15 minutes; `possible_duplicate_of` names the nearest of them. Both are hints
for the decision, never a reason to drop a report.

Approval (`FSD-FR-080`) verifies the report and creates **and publishes** a hazard
in one action: `depth_level` maps to `CAUTION`/`20 cm`, `LEVEL_2`/`50 cm` or
`IMPASSABLE`/`80 cm`, the reported point becomes a 30 m polygon, and the new
`hazard_id` is returned on the report. The hazard is immediately active, so it
appears in `/api/v1/hazards/active` on the driver's next refresh.

Rejection (`FSD-FR-081`) requires a `reason` of at least three characters.
Supplying `duplicate_of` records `status = "DUPLICATE"` instead of `"REJECTED"`;
both keep the evidence and the reason. A report that has already been decided
returns `409`, so a decision cannot be silently overwritten.

### 9.6 Audit trail

| Method | Path                    | Body / query                                        | Response   | Reference               |
| ------ | ----------------------- | --------------------------------------------------- | ---------- | ----------------------- |
| `GET`  | `/api/v1/audit`         | `action_type?`, `user_id?`, `limit?` (1–200, default 50) | `audit[]` | BR-008 / FSD-FR-047–049 |
| `GET`  | `/api/v1/audit/verify`  | —                                                   | `valid`, `checked`, `broken_at` | BR-008 / FSD-FR-047 |

One row is written by every privileged action: hazard create, update and publish,
report approval and rejection, SOS assignment, dispatch confirmation, vehicle
create and update, and the rainfall simulation. A row is written in the same
transaction as the change it describes, so a change cannot commit without its
record.

```json
{
  "log_id": 41,
  "user_id": 1,
  "action_type": "HAZARD_PUBLISH",
  "payload": { "hazard_id": 7, "obstruction_level": "CAUTION", "edge_id": 12 },
  "hash_signature": "9f2c…",
  "created_at": "2026-10-29T06:32:25.127535"
}
```

`hash_signature` is the SHA-256 of a canonical JSON document covering the actor,
the action, the payload, the timestamp and the previous row's digest. Verification
walks the table in `log_id` order and returns the first row that no longer matches,
which is the row an edit or a deletion disturbed. It reports `valid: false` with
`checked` set to the number of links that still verified.

Actor identity is a `user_id`; join it against `/api/v1/auth/me` or the users
table for a name. `payload` is returned as an object, not as the stored string.

### 9.7 Sensors, telemetry and streams

| Method   | Path                                     | Body / query                                                                                   | Role       | Reference           |
| -------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- | ------------------- |
| `POST`   | `/api/v1/sensors/readings`               | `sensor_id`, `value` (≥ 0), `unit` (must equal the sensor's unit), `recorded_at` → `201` reading with `breach` | admin | BR-017 / FSD-FR-090 |
| `GET`    | `/api/v1/sensors`                        | —                                                                                              | admin      | BR-017 / FSD-FR-091 |
| `POST`   | `/api/v1/sensors`                        | `sensor_id`, `sensor_type`, `name`, `latitude`, `longitude`, `threshold_value`, `threshold_unit`, `impact_radius_m`, `simulated` | admin | BR-017 / FSD-FR-091 |
| `PATCH`  | `/api/v1/sensors/{sensor_id}`            | any of `name`, `latitude` + `longitude`, thresholds, `impact_radius_m`, `active`, `simulated`                            | admin      | BR-017 / FSD-FR-091 |
| `DELETE` | `/api/v1/sensors/{sensor_id}`            | — → `204`; the sensor's readings are deleted with it                                           | admin      | BR-017 / FSD-FR-091 |
| `GET`    | `/api/v1/reports/{report_id}/nearest-sensor` | — → nearest active rain gauge, its latest reading, `distance_km`, `is_breach` (empty when none) | admin  | BR-014 / FSD-FR-079 |
| `POST`   | `/api/v1/vehicles/{vehicle_id}/telemetry` | position/speed batch → `204`                                                                  | any user   | FSD-FR-072          |
| `GET`    | `/api/v1/hazards/stream`, `/vehicles/stream`, `/sos/stream` | SSE; `after` resumes from an event id                                    | any user   | FSD-FR-082–086      |

Every accepted reading is written to the road edges within `impact_radius_m` metres of
the sensor (`edge_advisories`, one row per edge and source; an older reading never
overwrites a newer one). A breach (`value >= threshold_value`) flags those edges and also
writes a `SENSOR_BREACH` audit entry listing their ids. A flag is an **advisory** that
never closes a road (BRULE-012, BRULE-016): routing does not read it. Read the result
with `GET /api/v1/flood-state` (§9.7b). Deleting a sensor deletes its advisories.
Other sensor changes are audited too. Rescue
route preview is `GET /api/v1/dispatch/{sos_id}/preview` (§9.2).

### 9.7b `GET /api/v1/flood-state` (CR-004)

Resolved flood state per road segment, with the source and the time it applies to. Any
signed-in account may read it. Query: `only_flagged` (default `false`) leaves out segments
with nothing to report.

```json
{
  "generated_at": "2026-11-03T12:00:00",
  "raining": false,
  "fresh_window_minutes": 30,
  "edges": [
    {
      "edge_id": 7,
      "basis": "LIVE_ADVISORY",
      "source": "SENSOR:RIVER-01",
      "kind": "OBSERVED",
      "as_of": "2026-11-03T11:55:00",
      "has_live_data": true,
      "stale": false,
      "advisory": true,
      "closes_road": false,
      "route_penalty": 1.0,
      "notes": ["Advisory until a dispatcher confirms it"]
    }
  ]
}
```

`basis` is the first rule that applies: `VERIFIED_HAZARD` (a published hazard; the only
basis that can have `closes_road: true`), `LIVE_ADVISORY` (a **fresh** reading over its
threshold; observed beats modelled beats simulated, newest wins), `NOAH_CAUTION` or
`NOAH_LAYER` (Project NOAH fallback; not populated yet), or `NONE`. A reading older than
`fresh_window_minutes` is ignored and marked `stale`. `NONE` with `has_live_data: false`
means **nothing covers the segment**, not that it is safe. `kind` says whether a value is
`OBSERVED`, `MODELLED`, `SIMULATED` or `STATIC`; a client must not present a modelled value
as a measurement. `raining` is true while an active rain gauge is over its threshold; it
gates the NOAH fallback.

### 9.7a Not yet implemented

The following remain specified but absent, and must not be assumed by a client:

- hazard withdrawal (`DELETE /api/v1/hazards/{id}`).

### 9.8 Error additions in this slice

| Status | Condition                                   |
| ------ | ------------------------------------------- |
| `401`  | Missing, expired or invalid session token   |
| `403`  | Registration asked for an administrative role |
| `404`  | SOS, vehicle, hazard or report id not found |
| `409`  | Email already registered, or the report has already been moderated |
| `413`  | Report photo larger than 4 MB               |
| `415`  | Report photo is not a JPEG, PNG or WebP     |
| `422`  | Validation failure on a body field, including an unknown depth level or a missing rejection reason |
| `429`  | Login, registration, SOS, report or simulation quota exhausted (§1.6) |
