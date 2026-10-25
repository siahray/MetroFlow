# MetroFlow Algorithms

This document explains all algorithms currently implemented in the backend, along with their exact file locations.

## 1) Flood-Aware Pathfinding (`backend/routing.py`)

### 1.1 `classify_passability(water_depth_cm, clearance_cm, caution_depth_cm=None)`
**Type:** Rule-based threshold classifier  
**Purpose:** Determines whether a road edge is drivable for a given vehicle based on floodwater depth vs vehicle clearance.

**Logic:**
```text
1. If water_depth_cm >= clearance_cm  -> SUBMERGED (blocked)
2. If water_depth_cm >= caution_depth_cm -> LIGHT_FLOOD (drivable, slower)
3. Else -> PASSABLE
```

**Notes:**
- `SUBMERGED`, `LIGHT_FLOOD`, `PASSABLE` are constants exported from `routing.py`
- The `>=` on the submerged check is inclusive (at exactly clearance, it's treated as blocked for safety)
- `caution_depth_cm` defaults to `settings.caution_depth_cm` if not provided

### 1.2 `td_a_star_search(graph_nodes, graph_edges, start_node, target_node, vehicle_clearance_cm=30.0)`
**Type:** Water-Aware A* (referred to as "Time-Dependent A*" in code/comments)  
**Purpose:** Finds the shortest safe route between two nodes, considering vehicle clearance and water depth penalties.

**Inputs:**
- `graph_nodes`: `dict[int, tuple[float, float]]` - node_id -> (lat, lon)
- `graph_edges`: `dict[int, list[tuple[int, float, float, float]]]` - u -> [(v, length_m, speed_kmh, water_depth_cm)]

**Algorithm Steps:**
| Step | Description | Details |
|---|---|---|
| 1 | Validation | Returns `([], inf)` if nodes missing or invalid |
| 2 | Heuristic prep | Builds target coordinate, computes `max_speed_m_s = max(graph speeds)/3.6` (floor 0.1 m/s) |
| 3 | Haversine | `haversine(coord1, coord2)` computes great-circle distance in meters |
| 4 | Admissible heuristic | `h(node) = haversine(node, target) / max_speed_m_s` - never overestimates travel time since max speed is the upper bound |
| 5 | Search initialization | `g_score` all inf, `g_score[start]=0`, push `(f = h(start), g=0, start)` to min-heap |
| 6 | Expansion | Pop from heap, skip if stale (`current_g > g_score`) or already settled. Add to settled set. |
| 7 | Goal test | If `current == target_node`, reconstruct path via `came_from` and return |
| 8 | Edge relaxation | For each neighbor: if `water_depth_cm >= vehicle_clearance_cm` skip (hard block). Compute water penalty `1.0 + (water_depth_cm/10.0)^1.8`, effective speed = `max((speed_kmh/3.6)/water_penalty, 0.5)`. `traversal_time_s = length_m / effective_speed_m_s`. Update if better path found. |

**Properties:**
- **Time Complexity:** `O(E log V)` due to binary heap
- **Optimality:** Guaranteed optimal among safe routes (admissible heuristic)
- **Safety:** Hard clearance threshold prevents routing through submerged roads
- **Realism:** Exponential penalty makes deeper water increasingly costly to traverse

**Notes:** Despite the "Time-Dependent" naming, this is state-dependent (current water depths from `live_edge_states`), not time-of-day dependent. A more accurate name would be "Water-Aware A*".

### 1.3 Helper: `_max_graph_speed_kmh(graph_edges)`
**Type:** Utility  
**Purpose:** Finds maximum speed limit in the graph for admissible heuristic calculation.

## 2) Hydrology (`backend/hydrology.py`)

### 2.1 `calculate_scs_cn_runoff(rainfall_mm_hr, curve_number=None, duration_hrs=None)`
**Type:** USDA SCS Curve Number (Soil Conservation Service) method  
**Purpose:** Estimates direct surface runoff depth from rainfall.

**Formula:**
```text
P = rainfall_mm_hr * duration_hrs
S = (25400 / CN) - 254  (potential maximum retention, mm)
Ia = 0.2 * S           (initial abstraction, mm)
if Ia >= P: Q = 0
else: Q = ((P - Ia)^2) / (P - Ia + S)
```

**Parameters:**
- `CN` (Curve Number): Higher = more impermeable (urban concrete/asphalt ~85-95, natural soil lower). Defaults to `settings.curve_number`
- `duration_hrs`: Defaults to `settings.rainfall_duration_hrs`

**Returns:** Direct runoff depth `Q` in mm

**Notes:** Industry-standard method for urban runoff estimation.

### 2.2 `compute_node_water_depth(runoff_mm, slope_percent=1.0, elevation_m=5.0, amplification=None)`
**Type:** Empirical ponding heuristic  
**Purpose:** Converts catchment runoff to localized street ponding depth in cm.

**Formula:**
```text
amp = settings.ponding_amplification or amplification
depression_factor = 1.0 + (10.0 - min(elevation_m, 10.0)) * 0.15
base_depth_cm = (runoff_mm / 10.0) * depression_factor * amp
return round(max(0.0, base_depth_cm), 2)
```

**Factors:**
- **Unit conversion:** `runoff_mm / 10.0` converts mm to cm
- **Elevation effect:** Lower elevations (closer to 0) get higher depression factor. Uses 10m as reference datum.
- **Amplification:** Scales catchment-wide runoff to street-level ponding (configurable via `settings.ponding_amplification`)

**Notes:** This is a simplified empirical model, not a full 2D overland flow simulation. Sufficient for demo/prototype flood-aware routing.

## 3) Supporting Modules

### `backend/geometry.py`
**Purpose:** PostGIS geometry utilities. Handles backfilling geometry data for road nodes/edges using coordinates.

### `backend/config.py`
**Purpose:** Central configuration via environment variables/settings (curve numbers, thresholds like `caution_depth_cm`, amplification factors, etc.)

### `backend/database.py`
**Purpose:** SQLAlchemy setup, engine/session factory, `get_db()` dependency.

## Data Flow Summary

```text
Rainfall/Input -> calculate_scs_cn_runoff() -> compute_node_water_depth()
                                                    ↓
                                            live_edge_states.water_depth_cm
                                                    ↓
                                    classify_passability() + td_a_star_search()
                                                    ↓
                                              Safe route (or none)
```

## Implementation Status

| Algorithm | File | Status | Notes |
|---|---|---|---|
| Passability Classification | `routing.py` | ✅ Complete | Shared gatekeeper for routing |
| Water-Aware A* Pathfinding | `routing.py` | ✅ Complete | Heap-based, admissible heuristic, clearance blocking, exponential penalty |
| SCS-CN Runoff | `hydrology.py` | ✅ Complete | Standard USDA formula |
| Street Ponding Model | `hydrology.py` | ✅ Complete | Empirical heuristic, configurable |
| Haversine Distance | `routing.py` | ✅ Complete | Used in admissible heuristic |
