from sqlalchemy import text
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Idempotent PostGIS geometry backfill
# ---------------------------------------------------------------------------
# ``RoadNode.geom`` / ``RoadEdge.geom`` are declared with SRID 4326 but are
# never populated by the seeder, which leaves the API with no renderable
# geometry. These statements fill only NULL rows, so once real road polylines
# are imported they are never overwritten.
#
# NOTE: ST_MakePoint takes (longitude, latitude) -- x before y -- which matches
# GeoJSON coordinate ordering.

NODE_GEOM_SQL = text(
    """
    UPDATE road_nodes
    SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    WHERE geom IS NULL
      AND longitude IS NOT NULL
      AND latitude IS NOT NULL;
    """
)

EDGE_GEOM_SQL = text(
    """
    UPDATE road_edges e
    SET geom = ST_SetSRID(ST_MakeLine(a.geom, b.geom), 4326)
    FROM road_nodes a, road_nodes b
    WHERE a.node_id = e.start_node_id
      AND b.node_id = e.end_node_id
      AND e.geom IS NULL
      AND a.geom IS NOT NULL
      AND b.geom IS NOT NULL;
    """
)

EDGE_INDEX_SQL = text(
    """
    CREATE INDEX IF NOT EXISTS idx_road_edges_geom
    ON road_edges USING GIST (geom);
    """
)

NODE_INDEX_SQL = text(
    """
    CREATE INDEX IF NOT EXISTS idx_road_nodes_geom
    ON road_nodes USING GIST (geom);
    """
)


def backfill_geometry(db: Session) -> dict:
    """
    Populate missing node/edge geometry and ensure spatial indexes exist.

    Nodes must be filled before edges, because edge geometry is derived from
    its endpoints' point geometry.
    """
    node_result = db.execute(NODE_GEOM_SQL)
    edge_result = db.execute(EDGE_GEOM_SQL)

    # Spatial indexes make future "edges near me" queries possible.
    db.execute(EDGE_INDEX_SQL)
    db.execute(NODE_INDEX_SQL)

    db.commit()

    return {
        "nodes_updated": node_result.rowcount,
        "edges_updated": edge_result.rowcount,
    }
