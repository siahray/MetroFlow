# API Reference — MetroFlow Core API

| Field                     | Value                              |
| ------------------------- | ---------------------------------- |
| Document ID               | MF-API-001                         |
| Version                   | 1.0 (Draft)                        |
| Status                    | Matches `main` @ `9605e38`         |
| Date                      | 21 October 2026                    |
| Base URL (local)          | `http://localhost:8000`            |
| Machine-readable contract | `GET /openapi.json`                |
| Related documents         | [FSD.md](FSD.md), [TSD.md](TSD.md) |

## 1. Overview

The API computes flood depth over a road graph and returns clearance-aware
routes. Responses are JSON; geometry is GeoJSON.

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
| Parameters       | All query parameters; no request bodies                              |
| Versioning       | Path prefix `/api/v1`; breaking changes move to `/api/v2`            |

### 1.2 Authentication

**None.** Every endpoint is currently public. The pilot must not be exposed to
the internet or given real personal data until authentication is implemented
(FSD FR-21, TSD LIM-01). This is a stated limitation, not an oversight.

### 1.3 Response headers

Every response carries:

| Header                         | Value                             |
| ------------------------------ | --------------------------------- |
| `X-Content-Type-Options`       | `nosniff`                         |
| `Cross-Origin-Resource-Policy` | `cross-origin`                    |
| `Referrer-Policy`              | `strict-origin-when-cross-origin` |
| `X-Frame-Options`              | `DENY`                            |

CORS allows any origin, including credentialed requests (TSD SEC-02).

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
| `404`  | Unknown node, or no route survives the clearance check | `{"detail": "<message>"}`             |
| `422`  | Parameter fails validation                             | FastAPI validation object (see §6)    |
| `500`  | Unhandled server or database error                     | `{"detail": "Internal Server Error"}` |

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
curl -s "http://localhost:8000/api/v1/network/state?clearance_cm=30"
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
curl -s -X POST "http://localhost:8000/api/v1/simulation/rain?rainfall_mm_hr=80&clearance_cm=30"
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
curl -s "http://localhost:8000/api/v1/routing/navigate?start_node=1&target_node=4&clearance_cm=30"
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
