"""One-off: give the already-imported network real elevation spread.

`osm_network.py`'s import used to hardcode every node's `elevation_m` at a
flat 10.0, which made the rainfall simulation's SCS-CN ponding amplification
produce the exact same water depth on every edge -- nothing for flood-aware
routing to route around. The import now computes a varied, deterministic
placeholder per node (`osm_network._synthetic_elevation_m`); this script
applies that same formula to the network already sitting in the hosted
database, from each row's own stored latitude/longitude, so a full re-import
(which would reset every hazard, sensor and live-state row tied to the
current node/edge ids) is not needed just to fix elevation.

    cd backend && ./venv/bin/python update_node_elevation.py --dry-run
    cd backend && ./venv/bin/python update_node_elevation.py
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import Float, Integer, column, update, values

import models
from database import SessionLocal
from osm_network import _synthetic_elevation_m


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true", help="Report what would change, write nothing"
    )
    args = parser.parse_args(argv)

    db = SessionLocal()
    try:
        rows = db.query(
            models.RoadNode.node_id, models.RoadNode.latitude, models.RoadNode.longitude
        ).all()
        changed = [(node_id, _synthetic_elevation_m(lat, lon)) for node_id, lat, lon in rows]
        spread = [elevation for _, elevation in changed]

        print(f"{len(changed)} nodes; elevation would range {min(spread):.1f}-{max(spread):.1f} m")
        if args.dry_run:
            print("--dry-run: no changes written")
            return 0

        # One VALUES-driven statement per batch, same reasoning as the
        # simulation endpoint's bulk UPDATE: one round trip per row over the
        # hosted connection is minutes, not seconds, at this scale.
        BATCH_SIZE = 1000
        for i in range(0, len(changed), BATCH_SIZE):
            batch = changed[i : i + BATCH_SIZE]
            rows_cte = values(
                column("node_id", Integer),
                column("elevation_m", Float),
                name="v",
            ).data(batch)
            db.execute(
                update(models.RoadNode)
                .values(elevation_m=rows_cte.c.elevation_m)
                .where(models.RoadNode.node_id == rows_cte.c.node_id)
                .execution_options(synchronize_session=False)
            )
        db.commit()
        print(f"updated {len(changed)} nodes")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
