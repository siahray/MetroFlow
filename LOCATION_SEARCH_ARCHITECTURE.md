# MetroFlow Location Search & Geocoding Architecture

*Last updated: November 2026 (Reflecting Driver App v1.0 / Expo SDK 52)*

---

## 1. Executive Summary

In emergency response and flood-adaptive navigation, location search must meet strict operational requirements:
1. **Sub-second latency** to ensure responsive field operation.
2. **Offline resilience** during typhoons when cellular networks fail or experience severe packet loss.
3. **Clean human-readable presentation** (e.g., displaying *"SM City North EDSA"* or *"Quezon City Hall"* instead of internal topological graph identifiers like *"Node 4125"* or raw street edge codes).
4. **Seamless snapping** from real-world landmark coordinates to navigable road graph nodes for vehicle routing.

This document details the multi-tiered search architecture implemented in the driver mobile application (`metroflow-mobile`).

---

## 2. End-to-End Architectural Flow

```
                     User Types in Search Input
                       ("SM North" / "QC Hall")
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│              Input Handling & Debounce (route.tsx)                │
│   • < 3 chars: Instant local curated matching (0 ms latency)     │
│   • ≥ 3 chars: 300 ms debounce timer with AbortController         │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│          Multi-Tiered Geocoding Engine (geocode.ts)               │
│                                                                   │
│   ┌───────────────────────────────────────────────────────────┐   │
│   │ Tier 1: Curated Directory (Local Memory / Offline)        │   │
│   │ ~50+ Major QC & Metro Manila landmarks with aliases       │   │
│   └─────────────────────────────┬─────────────────────────────┘   │
│                                 │ (Concurrent / Fallback)         │
│   ┌─────────────────────────────▼─────────────────────────────┐   │
│   │ Tier 2: Mapbox Geocoding API (Live Proximity Bias)        │   │
│   │ Forward geocoding biased to driver's GPS fix              │   │
│   └─────────────────────────────┬─────────────────────────────┘   │
│                                 │ (Soft-fail / Quota Fallback)    │
│   ┌─────────────────────────────▼─────────────────────────────┐   │
│   │ Tier 3: OSM Nominatim Geocoder (Keyless Open-Data)        │   │
│   │ Bounded to pilot corridor (countrycodes=ph)               │   │
│   └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│             Deduplication, Formatting & UI Presentation           │
│   • Spatial deduplication: Merges entries within 100 meters      │
│   • Clean Titles: Primary establishment name                      │
│   • Subtitles: Road name, Barangay, and City                      │
│   • Proximity Badge: Straight-line distance (e.g. "1.8 km away")  │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │ User taps a result
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│        Coordinate Snapping & Graph Alignment (route.tsx)          │
│   • Preserve placeName = "SM City North EDSA" in search bar       │
│   • destinationCoordinate = (14.6565, 121.0286) (Marker entrance) │
│   • nearestNode(...) = Snaps to nearest road node in OSM graph   │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                 Flood-Safe Route Execution                        │
│   • Plan route from origin node to snapped target road node       │
│   • Avoid road segments where water depth > clearance_cm          │
│   • Persist to on-device SQLite (recentDestinations)              │
└───────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Component Breakdown

### 3.1 Input Debouncing & Lifecycle (`src/app/route.tsx`)
- **Query State:** Managed via `destinationQuery` and `searchFocused`.
- **Immediate Feedback:** Queries under 3 characters trigger an instantaneous filter over the in-memory curated dataset.
- **Request Cancellation:** When the query reaches 3+ characters, a 300 ms debounce timer starts. If the driver continues typing, the active `AbortController` cancels previous in-flight HTTP requests, avoiding race conditions and saving mobile data.

```typescript
// Excerpt: Debounced search dispatch in route.tsx
const timer = setTimeout(() => {
  setGeocoding(true);
  searchPlaces(
    needle,
    { proximity: positionRef.current },
    controller.signal,
  )
    .then((results) => {
      if (!controller.signal.aborted) setAddressResults(results);
    })
    .finally(() => {
      if (!controller.signal.aborted) setGeocoding(false);
    });
}, 300);
```

---

### 3.2 The Three-Tiered Search Pipeline (`src/geocode.ts`)

#### Tier 1: In-Memory Curated Directory (Zero-Latency & Offline)
- Contains ~50+ key infrastructure landmarks across Quezon City and the Metro Manila pilot corridor:
  - **Malls & Commercial:** *SM City North EDSA, TriNoma, Ayala Malls Vertis North, Gateway Mall, Ali Mall, Fisher Mall, Robinsons Galleria, SM Megamall, etc.*
  - **Hospitals & Medical:** *Philippine Heart Center, East Avenue Medical Center, St. Luke's QC, National Kidney and Transplant Institute (NKTI), Lung Center of the Philippines, Capitol Medical Center, etc.*
  - **Government & Civic:** *Quezon City Hall, Batasang Pambansa Complex, SSS Main, LTO Central, PAGASA Central Office, etc.*
  - **Universities:** *UP Diliman, Ateneo de Manila University, Miriam College, TIP QC.*
  - **Transit Hubs:** *MRT-3 North Ave, MRT-3 Quezon Ave, MRT-3 Cubao, LRT-2 Cubao, LRT-2 Katipunan.*
- **Alias Token Matching:** Supports common abbreviations (e.g., `"qc hall"`, `"sm north"`, `"uptc"`, `"heart center"`, `"ateneo"`).

#### Tier 2: Mapbox Geocoding API (Live & Proximity-Ranked)
- When online and configured with a public access token, queries the Mapbox Geocoding API (`mapbox.places`).
- **GPS Proximity Bias:** Injects `proximity: positionRef.current` (the driver's current latitude and longitude), ensuring that a search for a common establishment returns branches nearest to the vehicle.

#### Tier 3: OpenStreetMap Nominatim (Keyless Fallback)
- If Mapbox is unconfigured, offline, or returns no results, the engine automatically falls back to OpenStreetMap Nominatim.
- Constrained with `countrycodes=ph` and `addressdetails=1` to isolate place names from administrative hierarchies.

---

### 3.3 Deduplication & Human-Readable Formatting
Search results from live and curated sources are normalized into `GeocodeResult` objects:

```typescript
export type GeocodeResult = {
  id?: string;
  name: string;        // Clean place name (e.g., "SM City North EDSA")
  label: string;       // Display label
  subtitle: string;    // Address context (e.g., "North Ave cor. EDSA, Quezon City")
  category?: PlaceCategory; // "mall" | "hospital" | "university" | "government" | "transit" | ...
  latitude: number;
  longitude: number;
};
```

**Deduplication Strategy:**
Results from live APIs are filtered against the curated list:
1. Exact lowercase name match.
2. Coordinate proximity check: Points within 100 meters of an existing curated entry ($\Delta lat + \Delta lon < 0.001^\circ$) are discarded as duplicates.

---

### 3.4 Coordinate Snapping to the Road Graph (`selectPointDestination`)
A destination coordinate (e.g., a mall building entrance) rarely lies directly on a centerline road graph node. To ensure reliable routing:

1. **Retain Human Context:**
   - The UI search bar retains the clean name: `setDestinationQuery(result.name)`.
   - The map destination marker is placed at the exact landmark coordinate `destinationCoordinate = { latitude, longitude }`.
2. **Topological Snapping:**
   - The algorithm snaps the coordinate to the nearest road network node using `nearestNode(network.nodes.features, point)`.
   - The snapped `targetNode.properties.node_id` is passed to the routing engine.

```typescript
function selectPointDestination(point: LatLng, name: string): number | null {
  if (started || !network) return null;
  const nearest = nearestNode(network.nodes.features, point);
  if (!nearest) {
    setError("That point is outside the mapped road network.");
    return null;
  }
  setSelected(nearest);
  setPlaceCoords(point);
  setPlaceName(name);
  setDestinationQuery(name);
  return generation;
}
```

---

### 3.5 On-Device Persistence & Quick Picks
When a route is confirmed:
1. The destination is stored in the local SQLite table (`recentDestinations`).
2. Tapping the search bar when empty displays:
   - **Quick Pick Chips:** Configurable shortcuts (Home, Station, Depot).
   - **Recent Destinations:** The 5 most recently selected destinations with instant re-plan capabilities.

---

## 4. Disaster Resilience & Failure Modes

| Failure Scenario | System Behavior | Driver Experience |
| :--- | :--- | :--- |
| **Complete Cellular Outage (Typhoon Disconnection)** | Live API requests fail; search falls back to Tier 1 in-memory directory. | Driver can still search and route to major hospitals, evacuation hubs, and city landmarks. |
| **Mapbox API Quota Exhaustion / Missing Token** | Tier 2 fails soft; engine delegates to Tier 3 (Nominatim). | Seamless failover with no error modals. |
| **Landmark Selected Outside Road Bounds** | `nearestNode` threshold check triggers. | Displays clear guidance: *"That point is outside the mapped road network."* |
| **Search Replaced by Dropped Pin (Long Press)** | `handleMapLongPress` drops a pin and resolves reverse geocoding asynchronously. | Map immediately plans a route to the point while resolving the street address in the background. |

---

## 5. Related Architecture Documents

- [TECHSTACK.md](file:///Users/siahray/Codes/Systems/MetroFlow/TECHSTACK.md) — System-wide technology stack and rationale.
- [ALGORITHMS.md](file:///Users/siahray/Codes/Systems/MetroFlow/ALGORITHMS.md) — Routing engine and dynamic water depth calculations.
- [docs/final document/TSD.md](file:///Users/siahray/Codes/Systems/MetroFlow/docs/final%20document/TSD.md) — Technical Specifications Document and Architectural Decision Records (ADR-018, ADR-024, ADR-026).
