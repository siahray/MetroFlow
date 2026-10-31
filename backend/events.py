"""Server-sent events for hazard, fleet and SOS changes (FSD-FR-086, BR-018).

The TSD names Redis pub/sub for this fan-out (ADR-015). No Redis is provisioned
and the hosted database sits behind a transaction pooler, which cannot carry
Postgres LISTEN/NOTIFY, so the bus here is a durable table instead (ADR-024):
a privileged mutation appends one ``event_log`` row in its own transaction, and
every relay reads the rows after its cursor.

What that buys, and what it costs:

* **No gap and no phantom.** The event is committed with the change it
  announces, so a rolled-back hazard never reaches a client and a committed one
  always does. Redis publish-after-commit has a failure window between the two.
* **Replay for free.** ``event_id`` is monotonic, so a client that reconnects
  sends ``Last-Event-ID`` and receives exactly what it missed. There is no
  at-most-once fan-out to lose messages.
* **Latency bounded by the poll, not by a broker.** The relay wakes every
  ``event_stream_poll_ms`` (100 ms), which keeps the server-side publication
  inside the NFR-019 budget but is not Redis's sub-millisecond push.
* **One connection per open stream.** A serverless function holds the invocation
  until the stream ends, so ``stream`` stops after
  ``event_stream_lifetime_seconds`` and the client reconnects; this is a
  deliberate bound, not a failure.

The wire format is plain SSE: ``id:`` so a reconnect can resume, ``event:`` for
the change type, and one JSON ``data:`` line carrying the row as the REST
endpoint returns it, so a client can upsert it without a second fetch.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable, Iterator
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from config import settings
from schemas import HazardResponse, SOSResponse, VehicleResponse

# Channel names. The relay endpoint and the emitting mutation have to agree on
# these, so they live here rather than as string literals at both ends.
HAZARD = "hazard"
VEHICLE = "vehicle"
SOS = "sos"

HAZARD_CREATED = "hazard.created"
HAZARD_UPDATED = "hazard.updated"
HAZARD_PUBLISHED = "hazard.published"
VEHICLE_CREATED = "vehicle.created"
VEHICLE_UPDATED = "vehicle.updated"
SOS_CREATED = "sos.created"
SOS_UPDATED = "sos.updated"

# The first frame of a fresh subscription: the current state, so a client does
# not have to fetch the collection and then subscribe and reconcile the overlap.
SNAPSHOT = "snapshot"

# A client that reconnects too fast would spin; this is also what EventSource
# uses by default.
RETRY_MS = 3000


def hazard_payload(hazard: models.HazardZone) -> dict[str, Any]:
    """The row exactly as ``GET /api/v1/hazards`` would return it."""
    return HazardResponse.model_validate(hazard).model_dump(mode="json")


def vehicle_payload(vehicle: models.Vehicle) -> dict[str, Any]:
    return VehicleResponse.model_validate(vehicle).model_dump(mode="json")


def sos_payload(sos: models.SOSRequest) -> dict[str, Any]:
    return SOSResponse.model_validate(sos).model_dump(mode="json")


def emit(
    db: Session,
    *,
    channel: str,
    event_type: str,
    payload: dict[str, Any],
) -> int:
    """Append one event and return its id. The caller commits it with the change.

    ``flush`` is what makes the id available inside the same transaction; if the
    caller rolls back, the event goes with it.
    """
    event = models.EventLog(channel=channel, event_type=event_type, payload=payload)
    db.add(event)
    db.flush()
    return event.event_id


def latest_id(db: Session, channel: str | None = None) -> int:
    """Newest event id on a channel, or 0 before the first event ever."""
    query = db.query(func.max(models.EventLog.event_id))
    if channel is not None:
        query = query.filter(models.EventLog.channel == channel)
    return int(query.scalar() or 0)


def replay(db: Session, channel: str, after: int, limit: int) -> list[models.EventLog]:
    """Events on ``channel`` with an id greater than ``after``, oldest first."""
    return (
        db.query(models.EventLog)
        .filter(models.EventLog.channel == channel, models.EventLog.event_id > after)
        .order_by(models.EventLog.event_id)
        .limit(limit)
        .all()
    )


def _data(payload: Any) -> str:
    """One JSON line. ``json.dumps`` escapes newlines, so ``data:`` stays single."""
    return json.dumps(payload, separators=(",", ":"), default=str)


def frame(event_id: int, event_type: str, payload: Any) -> str:
    return f"id: {event_id}\nevent: {event_type}\ndata: {_data(payload)}\n\n"


def parse_cursor(*, after: int | None, last_event_id: str | None) -> int | None:
    """Where a subscription resumes: the query parameter, else the SSE header.

    Returns ``None`` for a fresh subscription, which asks for a snapshot. The
    header is client-controlled, so a malformed value is an error rather than a
    silent reset to the beginning — replaying the whole log would hide the bug.
    """
    if after is not None:
        return after
    if last_event_id is None or not last_event_id.strip():
        return None
    try:
        value = int(last_event_id.strip())
    except ValueError:
        raise ValueError("Last-Event-ID must be a non-negative integer") from None
    if value < 0:
        raise ValueError("Last-Event-ID must be a non-negative integer")
    return value


def stream(
    session_factory: Callable[[], Session],
    *,
    channel: str,
    cursor: int,
    snapshot: dict[str, Any] | None = None,
    snapshot_id: int | None = None,
) -> Iterator[str]:
    """Yield SSE frames until the outbound wait budget runs out.

    ``snapshot`` is sent first on a fresh subscription and carries
    ``snapshot_id``; a reconnect passes its ``Last-Event-ID`` as ``cursor`` and
    gets only the events it missed. The generator owns its session because the
    request-scoped one is closed when the response starts streaming.
    """
    poll_seconds = max(settings.event_stream_poll_ms, 1) / 1000
    heartbeat_seconds = max(settings.event_stream_heartbeat_seconds, poll_seconds)
    batch = max(settings.event_stream_batch, 1)
    deadline = time.monotonic() + max(settings.event_stream_lifetime_seconds, 0)

    db = session_factory()
    try:
        yield f"retry: {RETRY_MS}\n\n"
        if snapshot is not None:
            # The snapshot already contains every change up to this id, so the
            # cursor starts there rather than at zero.
            cursor = snapshot_id or 0
            yield frame(cursor, SNAPSHOT, snapshot)

        last_beat = time.monotonic()
        while time.monotonic() < deadline:
            # Copy the fields out before ending the read: a rollback expires the
            # instances, and re-reading them would be a query per row.
            pending = [
                (row.event_id, row.event_type, row.payload)
                for row in replay(db, channel, cursor, batch)
            ]
            # Nothing here writes: ending the implicit read transaction keeps the
            # connection out of "idle in transaction" between polls.
            db.rollback()

            if pending:
                for event_id, event_type, payload in pending:
                    cursor = event_id
                    yield frame(event_id, event_type, payload)
                last_beat = time.monotonic()
                # A full batch may have more behind it; drain before sleeping.
                continue

            if time.monotonic() - last_beat >= heartbeat_seconds:
                last_beat = time.monotonic()
                yield ": keep-alive\n\n"

            time.sleep(poll_seconds)
    finally:
        db.close()
