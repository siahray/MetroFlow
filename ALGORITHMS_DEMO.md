# MetroFlow - Algorithms Demonstration Document
**For Professor Review | Current Implementation State**  
**Date:** November 9, 2026  
**Project:** MetroFlow - Intelligent Urban Mobility & Flood Simulation System

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Currently Implemented Algorithms](#currently-implemented-algorithms)
3. [Test Results & Verification](#test-results--verification)
4. [How to Demonstrate](#how-to-demonstrate)
5. [Algorithm Details & Formulas](#algorithm-details--formulas)
6. [Planned vs Implemented](#planned-vs-implemented)
7. [Technical References](#technical-references)

---

## Executive Summary

MetroFlow currently implements **two core algorithmic components** for flood-aware urban mobility:

1. **Hydrology Modeling** - USDA SCS Curve Number method for runoff estimation + empirical ponding model
2. **Flood-Aware Pathfinding** - Water-aware A* (Time-Dependent A*) with clearance-based gating and exponential flood penalties

All implemented algorithms have **57/57 tests passing** (43 routing + 14 hydrology) with verified optimality against Dijkstra's algorithm.

---

## Currently Implemented Algorithms

| Algorithm | Type | Status | Location | Purpose |
|-----------|------|--------|----------|---------|
| **Passability Classification** | Rule-based threshold | ✅ **Active** | `backend/routing.py:18-35` | Classifies road edges as PASSABLE/LIGHT_FLOOD/SUBMERGED based on water depth vs vehicle clearance |
| **Water-Aware A* Pathfinding (td_a_star_search)** | Heuristic search (A*) | ✅ **Active** | `backend/routing.py:51-134` | Finds optimal safe route considering flood depth, vehicle clearance, and travel time penalties |
| **SCS Curve Number Runoff** | Empirical hydrology (USDA) | ✅ **Active** | `backend/hydrology.py:8-37` | Estimates surface runoff depth from rainfall intensity |
| **Street Ponding Model** | Empirical heuristic | ✅ **Active** | `backend/hydrology.py:40-62` | Converts catchment runoff to localized street-level water depth accounting for elevation |

---

## Test Results & Verification

### Test Suite Summary
```bash
cd backend && source venv/bin/activate && pytest tests/test_routing.py tests/test_hydrology.py -v
```

**Result:** `57 passed` (43 routing + 14 hydrology) in the two files above

### Routing Tests (43 tests)
| Test | What it verifies |
|------|-----------------|
| `test_a_star_matches_dijkstra_under_flooding` | **Optimality guarantee** - Compares against Dijkstra over 2000 random flood scenarios (24,000 route queries). All results match exactly. |
| `test_heuristic_is_admissible_when_graph_is_faster_than_50_kmh` | **Admissibility** - Uses graph max speed (60 km/h) for heuristic, not hardcoded value. Ensures A* never prunes optimal paths. |
| `test_undirected_routing_supports_reverse_trip` | **Bidirectional roads** - Handles reverse traversal correctly. |
| `test_clearance_gates_route_availability` | **Clearance-based blocking** - Different vehicles get different routes based on wading limits. |
| `test_submerged_edge_is_never_traversed` | **Safety guarantee** - Water depth ≥ clearance means edge is never used. |
| `test_unreachable_returns_empty_path` | **Graceful failure** - Returns `([], inf)` when no safe route exists. |
| `test_classify_passability_boundaries` | **Correct classification** - Inclusive boundaries at caution (10cm default) and clearance. |

### Hydrology Tests (14 tests)
| Test | What it verifies |
|------|-----------------|
| `test_peak_depth_exceeds_smallest_clearance` | **Calibration critical** - At 120 mm/hr, peak depth exceeds 20cm so SUBMERGED state is reachable. |
| `test_heavy_rain_submerges_low_lying_corridor_for_sedan` | **Realistic flooding** - Low-elevation nodes flood first. |
| `test_heavy_rain_still_passable_for_high_clearance_vehicle` | **Vehicle differentiation** - Higher clearance vehicles can traverse deeper water. |
| `test_lower_elevation_ponds_deeper` | **Topographic effect** - Elevation matters in ponding calculation. |
| `test_full_matrix_exercises_all_three_states` | **Complete coverage** - All states (PASSABLE/LIGHT_FLOOD/SUBMERGED) are reachable across test scenarios. |

---

## How to Demonstrate

### Demo 1: Quick Interactive Test (REPL) - 2-3 minutes
Best for showing the algorithm logic directly.

```bash
cd /Users/siahray/Codes/Systems/MetroFlow/backend
source venv/bin/activate
python
```

```python
from routing import td_a_star_search, classify_passability
from hydrology import calculate_scs_cn_runoff, compute_node_water_depth

# MetroFlow seed graph (Taguig/Pasig corridor)
NODES = {1:(14.5491,121.0553),2:(14.5583,121.0581),3:(14.5672,121.0631),4:(14.5731,121.0685)}
EDGES = [(1,2,1100,60),(2,3,1000,50),(3,4,850,50),(1,4,2800,40)]

def build_graph(depths, bidir=True):
    g={}
    for (u,v,l,s),d in zip(EDGES, depths):
        g.setdefault(u,[]).append((v,l,s,d,False))
        if bidir: g.setdefault(v,[]).append((u,l,s,d,False))
    return g

# SCENARIO 1: Normal conditions - shortest route
path,cost = td_a_star_search(NODES, build_graph([0,0,0,0]), 1,4, clearance_cm=30)
print(f"Scenario 1 (Dry): Route {path} | Time: {cost:.1f}s | Uses corridor")

# SCENARIO 2: Flooded corridor - algorithm finds detour
path,cost = td_a_star_search(NODES, build_graph([40,40,40,0]), 1,4, clearance_cm=30)
print(f"Scenario 2 (Flooded): Route {path} | Time: {cost:.1f}s | Detours to direct road")

# SCENARIO 3: Vehicle clearance matters
print(f"Sedan (20cm): {td_a_star_search(NODES, build_graph([40,40,40,40]), 1,4, clearance_cm=20)[0]}")
print(f"Truck (60cm): {td_a_star_search(NODES, build_graph([40,40,40,40]), 1,4, clearance_cm=60)[0]}")

# HYDROLOGY DEMO
runoff = calculate_scs_cn_runoff(120)  # 120 mm/hr rainfall
print(f"\nHydrology: {runoff:.2f}mm runoff at 120mm/hr")
print(f"Low elevation (3.5m): {compute_node_water_depth(runoff, elevation_m=3.5)}cm")
print(f"High elevation (9.0m): {compute_node_water_depth(runoff, elevation_m=9.0)}cm")
```

### Demo 2: Run Tests Live - 1 minute
Shows scientific rigor and correctness verification.

```bash
cd /Users/siahray/Codes/Systems/MetroFlow/backend
source venv/bin/activate
pytest tests/test_routing.py tests/test_hydrology.py -v
```

### Demo 3: API Demonstration - 3-5 minutes (Full Stack)
Shows integration with database and real application.

```bash
# Terminal 1: Start backend
cd /Users/siahray/Codes/Systems/MetroFlow/backend
source venv/bin/activate
uvicorn main:app --reload
```

```bash
# Terminal 2: Test API
# Get token (use credentials from backend/.env)
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@metroflow.lgu","password":"YOUR_PASSWORD"}' | jq -r .access_token)

# View network state
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/network/state?clearance_cm=30" | jq '.edges.features[] | {edge: .properties.edge_id, depth: .properties.water_depth_cm, status: .properties.status}'

# Get flood-aware route
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/routing/navigate?start_node=1&target_node=4&clearance_cm=30" | jq '{path: .optimal_path_nodes, time_minutes: .estimated_travel_time_minutes, segments: .segments}'

# Simulate heavy rainfall
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/simulation/rain?rainfall_mm_hr=120&clearance_cm=30" | jq '{rainfall_mm_hr, runoff_mm, affected_edges}'

# See how routes change
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/routing/navigate?start_node=1&target_node=4&clearance_cm=30" | jq '{path: .optimal_path_nodes, time_minutes: .estimated_travel_time_minutes}'
```

---

## Algorithm Details & Formulas

### 1. Passability Classification
**File:** `backend/routing.py:18-35`

```python
if water_depth_cm >= clearance_cm: return SUBMERGED  # Blocked
if water_depth_cm >= caution_depth_cm: return LIGHT_FLOOD  # Drivable with penalty
return PASSABLE
```

- **Caution threshold:** 10 cm (configurable via `settings.caution_depth_cm`)
- **Inclusive boundaries** for safety
- **Single source of truth** used by both routing engine and map renderer

### 2. Water-Aware A* Pathfinding
**File:** `backend/routing.py:51-134`

**Heuristic (Admissible):**
```python
h(n) = haversine(n, target) / max_speed_m_s
```
*Never overestimates* - divides by maximum speed in graph for guaranteed optimality.

**Edge Cost Function:**
```python
# Block if submerged
if water_depth_cm >= vehicle_clearance_cm: skip

# Exponential penalty for flood depth
water_penalty = 1.0 + (water_depth_cm / 10.0)^1.8
effective_speed = max((speed_kmh / 3.6) / water_penalty, 0.5)  # min 0.5 m/s
traversal_time = length_m / effective_speed
```

**Properties:**
- **Time Complexity:** O(E log V) with binary heap
- **Optimality:** Guaranteed optimal among safe routes (admissible heuristic)
- **Safety:** Hard clearance threshold prevents routing through impassable water
- **Realism:** Exponential penalty makes deeper water increasingly costly

### 3. SCS Curve Number Runoff
**File:** `backend/hydrology.py:8-37`  
**Standard:** USDA Soil Conservation Service Method

```python
P = rainfall_mm_hr * duration_hrs
S = (25400 / CN) - 254  # Potential retention (mm)
Ia = 0.2 * S            # Initial abstraction (mm)
if Ia >= P: Q = 0
else: Q = ((P - Ia)^2) / (P - Ia + S)  # Runoff depth (mm)
```

- **Default CN:** 85 (urban areas - concrete/asphalt)
- **Default Duration:** 1 hour
- **Industry standard** for urban runoff estimation

### 4. Street Ponding Model
**File:** `backend/hydrology.py:40-62`

```python
amp = settings.ponding_amplification  # configurable scaling factor
depression_factor = 1.0 + (10.0 - min(elevation_m, 10.0)) * 0.15
base_depth_cm = (runoff_mm / 10.0) * depression_factor * amp
return round(max(0.0, base_depth_cm), 2)
```

**Factors:**
- **Unit conversion:** mm → cm
- **Elevation effect:** Lower elevations pond deeper (up to 10m reference)
- **Amplification:** Bridges catchment-scale runoff to street-level ponding (calibrated for demo)

---

## Planned vs Implemented

Based on the original project specification vs current state:

| Feature | Specified | Status | Notes |
|---------|-----------|--------|-------|
| **Bcrypt/Argon2 password hashing** | Yes | ✅ **Active** | bcrypt hashes on `users`; the API verifies them and issues its own HS256 tokens |
| **Crowdsourced flood verification** | Yes | ✅ **Active (manual)** | Report intake with photo evidence, EXIF, duplicate and sensor-mismatch hints, and a human moderation desk; no ML verification |
| **CNN/ViT water depth estimation from photos** | Yes | ❌ Not Active | No ML/CV libraries or inference code |
| **RL/Genetic Algorithm for VRP dispatch** | Yes | ❌ Not Active | Dispatch is manual (human selects vehicle) via `POST /api/v1/sos/{id}/assign` |
| **Flood-aware pathfinding** | Yes | ✅ **Active** | Core algorithm implemented and tested |
| **Hydrology modeling** | Yes | ✅ **Active** | SCS-CN + ponding implemented |
| **Clearance-based routing** | Yes | ✅ **Active** | Different vehicles can use different routes |
| **Multi-criteria routing** | Partial | ⚠️ **Partial** | Has clearance + flood penalties, but missing urgency/crew capacity from VRP spec |

**Key Point:** The building blocks for advanced features exist (e.g., vehicle clearance is used in routing), but the ML/CV/optimization features described in the spec are not yet implemented. The current implementation focuses on the **core flood-aware routing and hydrology algorithms**.

---

## Technical References

### Source Files
- `backend/routing.py` - Pathfinding and passability classification
- `backend/hydrology.py` - Runoff and ponding models
- `backend/main.py` - API endpoints (`/api/v1/routing/navigate`, `/api/v1/simulation/rain`)
- `backend/tests/test_routing.py` - Routing algorithm tests
- `backend/tests/test_hydrology.py` - Hydrology algorithm tests

### Documentation
- `ALGORITHMS.md` - Detailed algorithm documentation
- `AGENTS.md` - Project setup and implementation status
- `PROGRESS_REPORT.md` - Overall project progress

### Dependencies
```
numpy>=2.5.4
scipy>=1.18.1
fastapi>=0.143.5
sqlalchemy>=2.1.5
```

