import { describe, expect, test } from "bun:test";

import type { EdgeFeature, HazardInfo, NetworkState, NodeFeature } from "../api";
import { planRouteOffline } from "./offline-route";

/**
 * The offline planner (FSD-FR-071) is a port of the API's time-dependent A*, so
 * it must keep the same two rules: a road deeper than the vehicle's clearance is
 * unusable, and a blocking hazard (BRULE-008) removes its edge unless the caller
 * explicitly ignores hazards.
 */

type TestEdge = {
  id: number;
  from: number;
  to: number;
  distanceM: number;
  depthCm?: number;
};

/** Nodes are 1, 2 and 3; [lon, lat] places them far enough apart to be told apart. */
const positions: Record<number, [number, number]> = {
  1: [121.0, 14.6],
  2: [121.02, 14.6],
  3: [121.01, 14.62],
};

function graph(edges: TestEdge[]): NetworkState {
  const node = (id: number): NodeFeature => ({
    id,
    geometry: { type: "Point", coordinates: positions[id] },
    properties: { node_id: id, name: `Node ${id}`, elevation_m: 10 },
  });
  const edge = (spec: TestEdge): EdgeFeature => {
    const from = positions[spec.from];
    const to = positions[spec.to];
    return {
      id: spec.id,
      geometry: { type: "LineString", coordinates: [from, to] },
      properties: {
        edge_id: spec.id,
        start_node_id: spec.from,
        end_node_id: spec.to,
        start_name: `Node ${spec.from}`,
        end_name: `Node ${spec.to}`,
        road_name: `Road ${spec.id}`,
        distance_m: spec.distanceM,
        max_speed_kmh: 40,
        avg_speed_kmh: 30,
        water_depth_cm: spec.depthCm ?? 0,
        status: (spec.depthCm ?? 0) > 0 ? "LIGHT_FLOOD" : "PASSABLE",
        is_override: false,
      },
    };
  };
  return {
    clearance_cm: 40,
    generated_at: "2026-11-08T00:00:00Z",
    nodes: { type: "FeatureCollection", features: [node(1), node(2), node(3)] },
    edges: { type: "FeatureCollection", features: edges.map(edge) },
  };
}

function hazard(
  overrides: Partial<HazardInfo> & Pick<HazardInfo, "hazard_id" | "edge_id">,
): HazardInfo {
  return {
    name: `Hazard ${overrides.hazard_id}`,
    obstruction_level: "LEVEL_2",
    avg_depth_cm: 45,
    notes: null,
    geometry: null,
    warning_radius_m: 50,
    published_at: null,
    active: true,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

const direct = { id: 1, from: 1, to: 2, distanceM: 900 };
const outbound = { id: 2, from: 1, to: 3, distanceM: 2000 };
const inbound = { id: 3, from: 3, to: 2, distanceM: 2000 };

describe("planRouteOffline", () => {
  test("takes the short direct road when it is passable", () => {
    const plan = planRouteOffline(graph([direct, outbound, inbound]), [], 1, 2, 40);

    expect(plan?.optimal_path_nodes).toEqual([1, 2]);
  });

  test("detours when the direct road is as deep as the clearance", () => {
    const flooded = { ...direct, depthCm: 10 };

    const plan = planRouteOffline(graph([flooded, outbound, inbound]), [], 1, 2, 10);

    expect(plan?.optimal_path_nodes).toEqual([1, 3, 2]);
    expect(plan?.total_distance_m).toBe(4000);
  });

  test("uses the direct road when the clearance has room over the water", () => {
    const flooded = { ...direct, depthCm: 10 };

    const plan = planRouteOffline(graph([flooded, outbound, inbound]), [], 1, 2, 40);

    expect(plan?.optimal_path_nodes).toEqual([1, 2]);
  });

  test("routes around a blocking hazard (BRULE-008)", () => {
    const plan = planRouteOffline(
      graph([direct, outbound, inbound]),
      [hazard({ hazard_id: 1, edge_id: 1 })],
      1,
      2,
      40,
    );

    expect(plan?.optimal_path_nodes).toEqual([1, 3, 2]);
    expect(plan?.hazards).toEqual([]);
  });

  test("returns no route when the only road is blocked", () => {
    const plan = planRouteOffline(
      graph([direct]),
      [hazard({ hazard_id: 1, edge_id: 1, obstruction_level: "IMPASSABLE" })],
      1,
      2,
      40,
    );

    expect(plan).toBeNull();
  });

  test("ignore_hazards uses the blocked road again", () => {
    const plan = planRouteOffline(
      graph([direct, outbound, inbound]),
      [hazard({ hazard_id: 1, edge_id: 1 })],
      1,
      2,
      40,
      true,
    );

    expect(plan?.optimal_path_nodes).toEqual([1, 2]);
    expect(
      plan?.hazards.map((routeHazard) => [routeHazard.hazard_id, routeHazard.blocking]),
    ).toEqual([[1, true]]);
  });

  test("a warning-level hazard does not block, and is reported as non-blocking", () => {
    const plan = planRouteOffline(
      graph([direct, outbound, inbound]),
      [hazard({ hazard_id: 1, edge_id: 1, obstruction_level: "LEVEL_1" })],
      1,
      2,
      40,
    );

    expect(plan?.optimal_path_nodes).toEqual([1, 2]);
    expect(plan?.hazards.map((routeHazard) => routeHazard.blocking)).toEqual([false]);
  });

  test("an unknown start node is a missing route, not an error", () => {
    expect(planRouteOffline(graph([direct, outbound, inbound]), [], 99, 2, 40)).toBeNull();
  });
});
