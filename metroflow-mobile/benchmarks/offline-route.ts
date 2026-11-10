// Offline route-planning latency benchmark (BACKLOG Q-4 / NFR-024-adjacent).
//
// planRouteOffline is pure TypeScript, so this measures the same code path the
// app runs on-device; absolute numbers on a mid-range phone will be higher,
// but the scaling behaviour (and whether the O(n^2) open-list scan in aStarSearch
// stays inside budget) is what matters. Run: bun benchmarks/offline-route.ts
import type { EdgeFeature, HazardInfo, NetworkState, NodeFeature } from "../src/api";
import { planRouteOffline } from "../src/navigation/offline-route";

/** Grid graph: `side` x `side` nodes, 4-connected, ~111 m per grid step. */
function gridGraph(side: number): NetworkState {
  const nodes: NodeFeature[] = [];
  const edges: EdgeFeature[] = [];
  const id = (r: number, c: number) => r * side + c;
  const dLat = 0.001; // ~111 m
  const dLon = 0.001 / Math.cos((14.6 * Math.PI) / 180); // ~111 m at 14.6 N
  for (let r = 0; r < side; r += 1) {
    for (let c = 0; c < side; c += 1) {
      nodes.push({
        id: id(r, c),
        geometry: { type: "Point", coordinates: [121.0 + c * dLon, 14.6 + r * dLat] },
        properties: { node_id: id(r, c), name: `N${id(r, c)}`, elevation_m: 10 },
      });
      if (c + 1 < side) {
        const a = id(r, c);
        const b = id(r, c + 1);
        edges.push({
          id: edges.length + 1,
          geometry: {
            type: "LineString",
            coordinates: [
              [121.0 + c * dLon, 14.6 + r * dLat],
              [121.0 + (c + 1) * dLon, 14.6 + r * dLat],
            ],
          },
          properties: {
            edge_id: edges.length + 1,
            start_node_id: a,
            end_node_id: b,
            start_name: `N${a}`,
            end_name: `N${b}`,
            road_name: `R${edges.length + 1}`,
            distance_m: 111,
            max_speed_kmh: 40,
            avg_speed_kmh: 30,
            water_depth_cm: 0,
            status: "PASSABLE",
            is_override: false,
          },
        });
      }
      if (r + 1 < side) {
        const a = id(r, c);
        const b = id(r + 1, c);
        edges.push({
          id: edges.length + 1,
          geometry: {
            type: "LineString",
            coordinates: [
              [121.0 + c * dLon, 14.6 + r * dLat],
              [121.0 + c * dLon, 14.6 + (r + 1) * dLat],
            ],
          },
          properties: {
            edge_id: edges.length + 1,
            start_node_id: a,
            end_node_id: b,
            start_name: `N${a}`,
            end_name: `N${b}`,
            road_name: `R${edges.length + 1}`,
            distance_m: 111,
            max_speed_kmh: 40,
            avg_speed_kmh: 30,
            water_depth_cm: 0,
            status: "PASSABLE",
            is_override: false,
          },
        });
      }
    }
  }
  return {
    clearance_cm: 40,
    generated_at: "2026-11-10T00:00:00Z",
    nodes: { type: "FeatureCollection", features: nodes },
    edges: { type: "FeatureCollection", features: edges },
  };
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function measure(label: string, network: NetworkState, start: number, target: number, runs: number) {
  const hazards: HazardInfo[] = [];
  const samples: number[] = [];
  // Warm-up.
  for (let i = 0; i < 3; i += 1) planRouteOffline(network, hazards, start, target, 40);
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now();
    planRouteOffline(network, hazards, start, target, 40);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const nodes = network.nodes.features.length;
  const edges = network.edges.features.length;
  console.log(
    `${label}: ${nodes} nodes / ${edges} edges, corner-to-corner route, ${runs} runs — ` +
      `p50 ${percentile(samples, 50).toFixed(1)} ms, p95 ${percentile(samples, 95).toFixed(1)} ms, ` +
      `max ${samples[samples.length - 1].toFixed(1)} ms`,
  );
}

// Pilot-scale graph (the seeded 34-node network) and a city-scale grid to see
// how the open-list scan scales before the graph grows beyond the pilot.
const pilot = gridGraph(6); // 36 nodes / 60 edges ≈ the seeded pilot graph
const mid = gridGraph(20); // 400 nodes / 760 edges
const city = gridGraph(40); // 1600 nodes / 3120 edges

measure("pilot-scale ", pilot, 0, 35, 200);
measure("mid-scale   ", mid, 0, 399, 50);
measure("city-scale  ", city, 0, 1599, 20);
