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
as absent in §9.5. The generated `/openapi.json` is always authoritative for
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
| Mapbox         | Clients (planned, CR-001) | Raster basemap; OSM fallback when unset      |
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

The example is abbreviated: the pilot graph returns four edges and four nodes.

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
  "affected_edges": 4,
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

The example omits edges 2 and 4 and all node features for brevity. With these
inputs the full pilot graph reports: edge 1 `18.67 cm / LIGHT_FLOOD`, edge 2
`28.51 cm / LIGHT_FLOOD`, edge 3 `30.11 cm / SUBMERGED`, edge 4
`18.67 cm / LIGHT_FLOOD` at a 30 cm clearance.

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
| `POST` | `/api/v1/dispatch/{sos_id}/confirm` | `note?`               | `sos`    | BR-016 / FSD-FR-089      |

A new SOS is created with `status = "pending"`. Assignment sets the vehicle and
moves the status to `"assigned"`, returning `404` when either the SOS or the
vehicle does not exist. Confirmation appends the note to the existing one rather
than replacing it, so the original distress text survives.

### 9.3 Hazards

| Method  | Path                              | Body                                                        | Response | Reference               |
| ------- | --------------------------------- | ----------------------------------------------------------- | -------- | ----------------------- |
| `POST`  | `/api/v1/hazards`                 | `name`, `obstruction_level`, `avg_depth_cm`, `edge_id`, `notes?` | `hazard` | BR-016 / FSD-FR-082–085 |
| `PATCH` | `/api/v1/hazards/{hazard_id}`     | any of the above fields, plus `active`                      | `hazard` | BR-016 / FSD-FR-084–085 |
| `POST`  | `/api/v1/hazards/{hazard_id}/publish` | —                                                       | `hazard` | BR-016 / FSD-FR-085     |
| `GET`   | `/api/v1/hazards`                 | —                                                           | `hazard[]` | BR-013 / FSD-FR-059   |

A hazard is created active but unpublished; `publish` stamps `published_at` and
is the step the portal performs before dispatch. Depth is in centimetres.

### 9.4 Fleet

| Method  | Path                            | Body                                                       | Response    | Reference               |
| ------- | ------------------------------- | ---------------------------------------------------------- | ----------- | ----------------------- |
| `GET`   | `/api/v1/vehicles`              | —                                                          | `vehicle[]` | BR-016 / FSD-FR-075–076 |
| `POST`  | `/api/v1/vehicles`              | `call_sign`, `vehicle_type`, `clearance_cm`, `speed_kmh`   | `vehicle`   | BR-016 / FSD-FR-075     |
| `PATCH` | `/api/v1/vehicles/{vehicle_id}` | any of the above, plus `status`                            | `vehicle`   | BR-016 / FSD-FR-076     |

Clearance is in centimetres and speed in km/h, matching §2 and the driver UI.

### 9.5 Not yet implemented

The following remain specified but absent, and must not be assumed by a client:

- field report intake and moderation (`/api/v1/reports*`, `/api/v1/reports/{id}/approve`);
- server-sent event streams (`/hazards/stream`, `/vehicles/stream`);
- sensor ingestion and thresholds (`/api/v1/sensors*`);
- vehicle telemetry batches (`/vehicles/{id}/telemetry`);
- rescue route preview (`/dispatch/{id}/route`);
- hazard withdrawal (`DELETE /api/v1/hazards/{id}`).

### 9.6 Error additions in this slice

| Status | Condition                                   |
| ------ | ------------------------------------------- |
| `401`  | Missing, expired or invalid session token   |
| `403`  | Registration asked for an administrative role |
| `404`  | SOS, vehicle or hazard id not found         |
| `409`  | Email already registered                    |
| `422`  | Validation failure on a body field          |
| `429`  | Login, registration, SOS or simulation quota exhausted (§1.6) |
