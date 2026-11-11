"""One-shot OpenStreetMap import for the pilot corridor (TSD §4.1).

Replaces network_seed's synthetic lattice with the real major-road graph:
Overpass ways (trunk/primary/secondary/tertiary and their links) are split at
shared junctions into road_edges with real geometry, length, speed limit,
lanes and one-way direction, then swapped in for the existing road tables in
one transaction. Unlike network_seed.apply (additive, demo-safe), this
REPLACES the network, so it is a deliberate operator action against a target
database, never part of startup::

    cd backend && ./venv/bin/python osm_network.py --dry-run
    cd backend && ./venv/bin/python osm_network.py
    cd backend && ./venv/bin/python osm_network.py --bbox 14.54,121.02,14.60,121.08

OSM node ids overflow the 32-bit road_nodes.node_id column, so nodes are
renumbered from 1 in OSM id order and edges follow; every dependent row (live
states, advisories, closure hazards) is reset by the same import, so the shift
is safe. Elevations are flat 10 m: the lattice's calibrated flood-prone belt
was demo scaffolding, and real depth now comes from sensors and reports.

Usage policy: Overpass is a shared free service. One run is one request; do
not loop this script.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import models

# Pilot corridor: south, west, north, east (TSD LIM-014 area, slightly wider
# than the demo lattice so Ortigas/Marikina arterials connect).
BBOX = (14.52, 121.00, 14.68, 121.14)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "MetroFlow-pilot/1.0 (road network import; contact via GitHub siahray/MetroFlow)"

# Fallback speed per class when the way carries no maxspeed tag (PH-typical).
HIGHWAY_SPEED_KMH = {
    "trunk": 60.0,
    "trunk_link": 40.0,
    "primary": 60.0,
    "primary_link": 40.0,
    "secondary": 50.0,
    "secondary_link": 35.0,
    "tertiary": 40.0,
    "tertiary_link": 30.0,
}

MPH_TO_KMH = 1.60934


@dataclass(frozen=True)
class ImportNode:
    node_id: int
    name: str | None
    latitude: float
    longitude: float
    elevation_m: float


@dataclass(frozen=True)
class ImportEdge:
    edge_id: int
    start_node_id: int
    end_node_id: int
    distance_m: float
    max_speed_kmh: float
    lanes: int
    road_name: str | None
    direction: str
    coordinates: tuple[tuple[float, float], ...]  # (lon, lat), GeoJSON order


def _haversine_m(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    radius = 6_371_000.0
    phi_a, phi_b = math.radians(a_lat), math.radians(b_lat)
    d_phi = phi_b - phi_a
    d_lambda = math.radians(b_lon - a_lon)
    h = math.sin(d_phi / 2) ** 2 + math.cos(phi_a) * math.cos(phi_b) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(h)))


def parse_maxspeed(tags: dict) -> float | None:
    """km/h from a maxspeed tag: "60", "60 kph", "50 km/h", "40 mph"."""
    raw = (tags.get("maxspeed") or "").strip().lower()
    if not raw:
        return None
    parts = raw.split()
    try:
        value = float(parts[0])
    except ValueError:
        return None
    if len(parts) > 1 and parts[1] in {"mph", "miles/hour"}:
        value *= MPH_TO_KMH
    return round(value, 1)


def way_direction(tags: dict) -> str:
    """FORWARD/BACKWARD for one-ways, roundabouts included; BOTH otherwise."""
    oneway = (tags.get("oneway") or "").strip().lower()
    if oneway in {"yes", "1", "true"}:
        return "FORWARD"
    if oneway in {"-1", "reverse"}:
        return "BACKWARD"
    if tags.get("junction") in {"roundabout", "circular"}:
        # OSM convention: roundabouts are one-way even without an oneway tag.
        return "FORWARD"
    return "BOTH"


def build_graph(elements: list[dict]) -> tuple[list[ImportNode], list[ImportEdge], int]:
    """Convert Overpass `out geom` elements into the road graph.

    Junctions are nodes shared by two ways, at a way end, or revisited inside
    one way; every other node is geometry shape only. Returns the nodes, the
    edges and the count of self-loop segments dropped (a loop that starts and
    ends at the same junction with no interior junction cannot be an edge).
    """
    ways: list[tuple[int, dict, list[int], list[tuple[float, float]]]] = []
    for element in elements:
        if element.get("type") != "way":
            continue
        tags = element.get("tags", {})
        if "highway" not in tags:
            continue
        refs = element.get("nodes", [])
        geometry = [(point["lon"], point["lat"]) for point in element.get("geometry", [])]
        if len(refs) < 2 or len(refs) != len(geometry):
            continue
        ways.append((element["id"], tags, refs, geometry))

    junctions: set[int] = set()
    way_names: dict[int, set[str]] = defaultdict(set)
    use_count: Counter[int] = Counter()
    for _, tags, refs, _ in ways:
        name = tags.get("name")
        for ref in refs:
            use_count[ref] += 1
            if name:
                way_names[ref].add(name)
    for _, _, refs, _ in ways:
        junctions.add(refs[0])
        junctions.add(refs[-1])
        seen: set[int] = set()
        for ref in refs:  # a way crossing itself makes the revisit a junction
            if ref in seen:
                junctions.add(ref)
            seen.add(ref)
    junctions |= {ref for ref, count in use_count.items() if count > 1}

    # OSM ids overflow the 32-bit column, so renumber from 1 in OSM id order.
    assign = {osm_id: index + 1 for index, osm_id in enumerate(sorted(junctions))}

    def junction_name(osm_id: int) -> str | None:
        names = sorted(way_names.get(osm_id, ()))
        if not names:
            return None
        return " × ".join(names[:3]) + (" × …" if len(names) > 3 else "")

    nodes = [
        ImportNode(
            node_id=assign[osm_id],
            name=junction_name(osm_id),
            latitude=coords[1],
            longitude=coords[0],
            elevation_m=10.0,
        )
        for osm_id, coords in sorted(_junction_coordinates(ways).items())
        if osm_id in assign
    ]

    edges: list[ImportEdge] = []
    dropped_loops = 0
    edge_id = 0
    for _, tags, refs, geometry in ways:
        speed = parse_maxspeed(tags) or HIGHWAY_SPEED_KMH.get(tags["highway"], 40.0)
        try:
            lanes = max(1, int(tags.get("lanes", "2")))
        except ValueError:
            lanes = 2
        road_name = tags.get("name")
        direction = way_direction(tags)

        segment_start: int | None = None
        segment: list[tuple[float, float]] = []
        for ref, point in zip(refs, geometry, strict=True):
            if segment_start is None:
                segment_start, segment = ref, [point]
                continue
            segment.append(point)
            if ref in junctions:
                if ref == segment_start:
                    dropped_loops += 1
                else:
                    distance = sum(
                        _haversine_m(a[1], a[0], b[1], b[0])
                        for a, b in zip(segment, segment[1:], strict=False)
                    )
                    if distance > 1.0:  # sub-metre segments are mapping noise
                        edge_id += 1
                        edges.append(
                            ImportEdge(
                                edge_id=edge_id,
                                start_node_id=assign[segment_start],
                                end_node_id=assign[ref],
                                distance_m=round(distance, 2),
                                max_speed_kmh=speed,
                                lanes=lanes,
                                road_name=road_name,
                                direction=direction,
                                coordinates=tuple(segment),
                            )
                        )
                segment_start, segment = ref, [point]

    return nodes, edges, dropped_loops


def _junction_coordinates(
    ways: list[tuple[int, dict, list[int], list[tuple[float, float]]]],
) -> dict[int, tuple[float, float]]:
    """OSM id -> (lon, lat) for every referenced node."""
    coordinates: dict[int, tuple[float, float]] = {}
    for _, _, refs, geometry in ways:
        for ref, point in zip(refs, geometry, strict=True):
            coordinates.setdefault(ref, point)
    return coordinates


def fetch_overpass(
    bbox: tuple[float, float, float, float],
    timeout_s: int = 240,
    attempts: int = 4,
    retry_delay_s: float = 10.0,
) -> list[dict]:
    """Major-road ways with inline geometry for a bbox, as Overpass elements.

    The main instance intermittently answers 502 under load, which says
    nothing about the request, so a short retry with a pause beats failing an
    operator run.
    """
    import time
    from urllib.error import HTTPError, URLError

    south, west, north, east = bbox
    query = (
        "[out:json][timeout:180];"
        'way["highway"~"^(trunk|primary|secondary|tertiary)(_link)?$"]'
        f"({south},{west},{north},{east});"
        "out geom;"
    )
    last_error: Exception | None = None
    for attempt in range(attempts):
        request = Request(
            OVERPASS_URL,
            data=urlencode({"data": query}).encode(),
            headers={"User-Agent": USER_AGENT},
        )
        try:
            with urlopen(request, timeout=timeout_s) as response:
                payload = json.load(response)
            return payload.get("elements", [])
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
            if attempt + 1 < attempts:
                print(f"[osm_network] Overpass failed ({error}); retrying in {retry_delay_s:.0f}s")
                time.sleep(retry_delay_s)
    raise RuntimeError(f"Overpass did not answer after {attempts} attempts") from last_error


def replace_network(
    db, nodes: list[ImportNode], edges: list[ImportEdge], dry_run: bool = False
) -> dict[str, int]:
    """Swap the whole road graph in one transaction.

    Real street ids replace the synthetic lattice, so dependents are reset or
    detached rather than left pointing at dead rows: edge advisories and live
    states are deleted, and a hazard's closure link is nulled while the hazard
    itself survives as an area hazard.
    """
    from geoalchemy2.shape import from_shape
    from shapely.geometry import LineString, Point

    detached = db.execute(
        models.HazardZone.__table__.update()
        .where(models.HazardZone.edge_id.isnot(None))
        .values(edge_id=None)
    )

    db.query(models.EdgeAdvisory).delete()
    db.query(models.LiveEdgeState).delete()
    db.query(models.RoadEdge).delete()
    db.query(models.RoadNode).delete()

    db.add_all(
        models.RoadNode(
            node_id=node.node_id,
            name=node.name,
            latitude=node.latitude,
            longitude=node.longitude,
            elevation_m=node.elevation_m,
            geom=from_shape(Point(node.longitude, node.latitude), srid=4326),
        )
        for node in nodes
    )
    # Flushed separately: with ~9k rows, the node inserts batch into several
    # INSERTs, and a single combined flush let at least one edge batch reach
    # Postgres before every node batch had (observed as a live FK violation
    # against the hosted DB, node present in `nodes` and still rejected).
    db.flush()
    db.add_all(
        models.RoadEdge(
            edge_id=edge.edge_id,
            start_node_id=edge.start_node_id,
            end_node_id=edge.end_node_id,
            distance_meters=edge.distance_m,
            max_speed_kmh=edge.max_speed_kmh,
            lanes=edge.lanes,
            road_name=edge.road_name,
            direction=edge.direction,
            geom=from_shape(LineString(list(edge.coordinates)), srid=4326),
        )
        for edge in edges
    )
    db.flush()

    # Live states keep the rainfall simulation and speed display coherent.
    db.add_all(
        models.LiveEdgeState(
            edge_id=edge.edge_id,
            water_depth_cm=0.0,
            avg_speed_kmh=edge.max_speed_kmh,
        )
        for edge in edges
    )

    counts = {
        "nodes": len(nodes),
        "edges": len(edges),
        "hazards_detached": detached.rowcount or 0,
    }
    if dry_run:
        db.rollback()
    else:
        db.commit()
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import the real OSM road network.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report the planned changes and roll back",
    )
    parser.add_argument(
        "--bbox",
        default=",".join(str(value) for value in BBOX),
        help="south,west,north,east to import instead of the pilot corridor",
    )
    args = parser.parse_args(argv)

    bbox = tuple(float(part) for part in args.bbox.split(","))
    if len(bbox) != 4:
        parser.error("--bbox needs four numbers: south,west,north,east")

    print(f"[osm_network] fetching Overpass ways for bbox {bbox} ...")
    elements = fetch_overpass(bbox)
    nodes, edges, dropped_loops = build_graph(elements)
    named = sum(1 for node in nodes if node.name)
    print(
        f"[osm_network] built {len(nodes)} junction nodes ({named} named), "
        f"{len(edges)} edges, {dropped_loops} self-loops dropped"
    )
    if not edges:
        print("[osm_network] no edges built; refusing to touch the database")
        return 1

    from database import SessionLocal

    db = SessionLocal()
    try:
        counts = replace_network(db, nodes, edges, dry_run=args.dry_run)
    finally:
        db.close()

    verb = "would replace the network with" if args.dry_run else "replaced the network with"
    print(
        f"[osm_network] {verb}: {counts['nodes']} nodes, {counts['edges']} edges, "
        f"{counts['hazards_detached']} hazards detached from closed edges"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
