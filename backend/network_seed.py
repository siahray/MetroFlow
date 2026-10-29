"""Curated road network for the Pasig / Taguig pilot corridor (TSD LIM-014).

The first commit of this project seeded four nodes so that a fresh database
rendered *something*. Four nodes is enough to prove the routing algorithm but
too thin to demonstrate it: almost every flood scenario either has no detour or
has exactly one, and a map of four lines looks empty.

This module is the replacement: a small, deterministic network of ~35 nodes and
~60 edges laid over the real Pasig / Taguig arterials (EDSA, C5, Kalayaan, JP
Rizal, Pasig Blvd, Ortigas Ave, Sandoval, Caruncho, Amang Rodriguez). It is a
*synthetic* corridor grid, not surveyed road geometry -- the coordinates follow
real intersections closely enough to look right on a basemap, and the
elevations are calibrated so the low-lying C5 / Bagong Ilog belt floods first,
but it is not a replacement for an authoritative road import.

Two properties matter and are covered by ``tests/test_network_seed.py``:

* **Nodes 1-4 and edges 1-4 are byte-for-byte what they always were.** The
  routing tests, the algorithm demo in ``ALGORITHMS_DEMO.md`` and every saved
  screenshot depend on those ids, coordinates and speeds.
* **Applying the seed is idempotent and additive.** It upserts the documented
  columns and never deletes a row, so it can be run against the hosted database
  without disturbing hazards, dispatches or live flood state that reference the
  graph.

Run it against whatever ``DATABASE_URL`` resolves to::

    cd backend && ./venv/bin/python network_seed.py --dry-run
    cd backend && ./venv/bin/python network_seed.py

``--dry-run`` reports the planned changes and rolls back.
"""

from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass

import models

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SeedNode:
    node_id: int
    name: str
    latitude: float
    longitude: float
    elevation_m: float


@dataclass(frozen=True)
class SeedEdge:
    edge_id: int
    start_node_id: int
    end_node_id: int
    distance_m: float
    max_speed_kmh: float
    lanes: int = 2


# The original demo spine. These four nodes are the contract with the existing
# tests and documentation: do not renumber, move or re-speed them.
ORIGINAL_NODES: tuple[SeedNode, ...] = (
    SeedNode(1, "C5 - Market Market", 14.5491, 121.0553, 8.5),
    SeedNode(2, "C5 - Kalayaan Ave", 14.5583, 121.0581, 4.2),  # low: floods early
    SeedNode(3, "C5 - Bagong Ilog", 14.5672, 121.0631, 3.5),  # lowest
    SeedNode(4, "Pasig Blvd - Shaw", 14.5731, 121.0685, 9.0),
)

ORIGINAL_EDGES: tuple[SeedEdge, ...] = (
    SeedEdge(1, 1, 2, 1100.0, 60.0),
    SeedEdge(2, 2, 3, 1000.0, 50.0),
    SeedEdge(3, 3, 4, 850.0, 50.0),
    SeedEdge(4, 1, 4, 2800.0, 40.0),  # the long way round, kept as a bypass
)

# East-west arterials: (name, latitude, max speed km/h).
ROWS: tuple[tuple[str, float, float], ...] = (
    ("Lawton Ave", 14.5450, 40.0),
    ("Kalayaan Ave", 14.5530, 50.0),
    ("JP Rizal Ext", 14.5610, 45.0),
    ("Pasig Blvd", 14.5690, 50.0),
    ("Ortigas Ave", 14.5770, 60.0),
    ("Amang Rodriguez Ave", 14.5850, 40.0),
)

# North-south arterials: (name, longitude, max speed km/h).
COLS: tuple[tuple[str, float, float], ...] = (
    ("EDSA", 121.0480, 60.0),
    ("C5", 121.0560, 55.0),
    ("Meralco Ave", 121.0640, 45.0),
    ("Sandoval Ave", 121.0720, 40.0),
    ("Caruncho Ave", 121.0800, 35.0),
)

LATTICE_NODE_BASE = 100
LATTICE_EDGE_BASE = 100
CONNECTOR_EDGE_BASE = 5

# Longitude degrees are shorter than latitude degrees at this latitude; the
# haversine below is exact, this constant is only used for the elevation model.
_EARTH_RADIUS_M = 6_371_000.0


def _distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres, rounded to the nearest 10 m."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return round(_EARTH_RADIUS_M * 2 * math.asin(math.sqrt(a)) / 10.0) * 10.0


def _elevation_m(row: int, col: int) -> float:
    """Elevation surface tuned so the C5 / Bagong Ilog belt sits lowest.

    A single Gaussian basin centred south-west of Pasig centro: ~4.5 m at the
    bottom of the basin (matching the surveyed 3.5-4.2 m on the original spine)
    rising to ~9.4 m on the Ortigas ridge. Deliberately simple and documented as
    an approximation -- LIM-017 keeps a real DEM out of scope for the pilot.
    """
    basin = math.exp(-(((row - 2.4) ** 2) / 1.8 + ((col - 1.1) ** 2) / 1.5))
    return round(9.5 - 5.0 * basin, 2)


def _lattice_node_id(row: int, col: int) -> int:
    return LATTICE_NODE_BASE + row * len(COLS) + col


def build_network() -> tuple[list[SeedNode], list[SeedEdge]]:
    """Return the full seed graph: original spine + arterial lattice + links."""
    nodes: list[SeedNode] = list(ORIGINAL_NODES)
    edges: list[SeedEdge] = list(ORIGINAL_EDGES)

    lattice: dict[tuple[int, int], SeedNode] = {}
    for row_index, (row_name, latitude, _) in enumerate(ROWS):
        for col_index, (col_name, longitude, _) in enumerate(COLS):
            node = SeedNode(
                node_id=_lattice_node_id(row_index, col_index),
                name=f"{row_name} × {col_name}",
                latitude=latitude,
                longitude=longitude,
                elevation_m=_elevation_m(row_index, col_index),
            )
            lattice[(row_index, col_index)] = node
            nodes.append(node)

    edge_id = LATTICE_EDGE_BASE
    for row_index, (_, _, row_speed) in enumerate(ROWS):
        for col_index in range(len(COLS) - 1):
            west = lattice[(row_index, col_index)]
            east = lattice[(row_index, col_index + 1)]
            edges.append(
                SeedEdge(
                    edge_id=edge_id,
                    start_node_id=west.node_id,
                    end_node_id=east.node_id,
                    distance_m=_distance_m(
                        west.latitude, west.longitude, east.latitude, east.longitude
                    ),
                    max_speed_kmh=row_speed,
                )
            )
            edge_id += 1

    for col_index, (_, _, col_speed) in enumerate(COLS):
        for row_index in range(len(ROWS) - 1):
            south = lattice[(row_index, col_index)]
            north = lattice[(row_index + 1, col_index)]
            edges.append(
                SeedEdge(
                    edge_id=edge_id,
                    start_node_id=south.node_id,
                    end_node_id=north.node_id,
                    distance_m=_distance_m(
                        south.latitude, south.longitude, north.latitude, north.longitude
                    ),
                    max_speed_kmh=col_speed,
                )
            )
            edge_id += 1

    # Tie the original spine into the lattice so a route can enter or leave it.
    # Each spine node joins its two nearest lattice intersections.
    edge_id = CONNECTOR_EDGE_BASE
    for spine in ORIGINAL_NODES:
        nearest = sorted(
            lattice.values(),
            key=lambda candidate: _distance_m(
                spine.latitude, spine.longitude, candidate.latitude, candidate.longitude
            ),
        )[:2]
        for candidate in nearest:
            edges.append(
                SeedEdge(
                    edge_id=edge_id,
                    start_node_id=min(spine.node_id, candidate.node_id),
                    end_node_id=max(spine.node_id, candidate.node_id),
                    distance_m=_distance_m(
                        spine.latitude,
                        spine.longitude,
                        candidate.latitude,
                        candidate.longitude,
                    ),
                    max_speed_kmh=30.0,
                )
            )
            edge_id += 1

    return nodes, edges


def validate(nodes: list[SeedNode], edges: list[SeedEdge]) -> None:
    """Fail loudly on a malformed graph rather than writing it to the database."""
    node_ids = [node.node_id for node in nodes]
    if len(set(node_ids)) != len(node_ids):
        raise ValueError("duplicate node_id in seed")
    known = set(node_ids)

    edge_ids = [edge.edge_id for edge in edges]
    if len(set(edge_ids)) != len(edge_ids):
        raise ValueError("duplicate edge_id in seed")

    pairs: set[tuple[int, int]] = set()
    for edge in edges:
        if edge.start_node_id not in known or edge.end_node_id not in known:
            raise ValueError(f"edge {edge.edge_id} references an unknown node")
        if edge.start_node_id == edge.end_node_id:
            raise ValueError(f"edge {edge.edge_id} is a self-loop")
        if edge.distance_m <= 0:
            raise ValueError(f"edge {edge.edge_id} has a non-positive length")
        pair = (
            min(edge.start_node_id, edge.end_node_id),
            max(edge.start_node_id, edge.end_node_id),
        )
        if pair in pairs:
            raise ValueError(f"edge {edge.edge_id} duplicates the pair {pair}")
        pairs.add(pair)


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------


def apply(db, dry_run: bool = False) -> dict[str, int]:
    """Upsert the seed graph. Additive: no row is ever deleted.

    Only the documented columns are written. ``geom`` is left alone because
    ``geometry.backfill_geometry`` owns it and only fills NULLs, and
    ``live_edge_states`` rows are created when missing but never reset, so a
    re-run cannot silently clear the operator's current flood state.
    """
    nodes, edges = build_network()
    validate(nodes, edges)

    counts = {
        "nodes_created": 0,
        "nodes_updated": 0,
        "edges_created": 0,
        "edges_updated": 0,
        "states_created": 0,
    }

    for seed in nodes:
        existing = db.get(models.RoadNode, seed.node_id)
        if existing is None:
            db.add(
                models.RoadNode(
                    node_id=seed.node_id,
                    name=seed.name,
                    latitude=seed.latitude,
                    longitude=seed.longitude,
                    elevation_m=seed.elevation_m,
                )
            )
            counts["nodes_created"] += 1
            continue

        changed = (
            existing.name != seed.name
            or existing.latitude != seed.latitude
            or existing.longitude != seed.longitude
            or existing.elevation_m != seed.elevation_m
        )
        if changed:
            existing.name = seed.name
            existing.latitude = seed.latitude
            existing.longitude = seed.longitude
            existing.elevation_m = seed.elevation_m
            counts["nodes_updated"] += 1

    # Flush so the edge foreign keys resolve against the nodes added above.
    db.flush()

    for seed in edges:
        existing = db.get(models.RoadEdge, seed.edge_id)
        if existing is None:
            db.add(
                models.RoadEdge(
                    edge_id=seed.edge_id,
                    start_node_id=seed.start_node_id,
                    end_node_id=seed.end_node_id,
                    distance_meters=seed.distance_m,
                    max_speed_kmh=seed.max_speed_kmh,
                    lanes=seed.lanes,
                )
            )
            counts["edges_created"] += 1
        elif (
            existing.start_node_id != seed.start_node_id
            or existing.end_node_id != seed.end_node_id
            or existing.distance_meters != seed.distance_m
            or existing.max_speed_kmh != seed.max_speed_kmh
        ):
            existing.start_node_id = seed.start_node_id
            existing.end_node_id = seed.end_node_id
            existing.distance_meters = seed.distance_m
            existing.max_speed_kmh = seed.max_speed_kmh
            counts["edges_updated"] += 1

    db.flush()

    for seed in edges:
        state = db.query(models.LiveEdgeState).filter_by(edge_id=seed.edge_id).one_or_none()
        if state is None:
            db.add(
                models.LiveEdgeState(
                    edge_id=seed.edge_id,
                    water_depth_cm=0.0,
                    avg_speed_kmh=seed.max_speed_kmh,
                )
            )
            counts["states_created"] += 1

    if dry_run:
        db.rollback()
    else:
        db.commit()

    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Upsert the MetroFlow seed road network.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report the planned changes and roll back",
    )
    args = parser.parse_args(argv)

    from database import SessionLocal

    db = SessionLocal()
    try:
        counts = apply(db, dry_run=args.dry_run)
    finally:
        db.close()

    verb = "would apply" if args.dry_run else "applied"
    print(
        f"[network_seed] {verb}: "
        f"{counts['nodes_created']} nodes created, {counts['nodes_updated']} updated, "
        f"{counts['edges_created']} edges created, {counts['edges_updated']} updated, "
        f"{counts['states_created']} live states created"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
