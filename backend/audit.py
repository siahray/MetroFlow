"""Tamper-evident audit trail for privileged actions (TSD LIM-008, FSD-FR-093).

Every privileged action has to leave one attributable row: who did it, what they
did, the payload they did it with and when (TC-044). The table already existed in
the baseline schema with a ``hash_signature`` column and was never written, so
this module is the write path rather than a new table.

Why a hash chain instead of a plain row:

* A row is only evidence if nobody can edit it afterwards without leaving a mark.
  Each record's digest covers the record's own fields *and* the previous record's
  digest, so changing or deleting an entry breaks every later link.
* It is still not a proof against someone with write access to the database and
  the code to recompute the chain --- that is what shipping the chain to an
  append-only store would be for. It is the strongest guarantee available without
  a new service, and it is honest about its scope in the TSD note.

The digest is SHA-256 over a canonical JSON document (sorted keys, no spaces), so
the same content always produces the same hex digest regardless of dict order.

``record`` only adds the row; the caller commits. That is deliberate: an audit
record and the change it describes must land in the same transaction, so a
failure cannot leave one without the other.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

import models

# Action vocabulary. Kept flat and explicit so a report can filter on it; the
# value is what an auditor reads, so it names the action, not the verb.
HAZARD_CREATE = "HAZARD_CREATE"
HAZARD_UPDATE = "HAZARD_UPDATE"
HAZARD_PUBLISH = "HAZARD_PUBLISH"
SOS_ASSIGN = "SOS_ASSIGN"
DISPATCH_CONFIRM = "DISPATCH_CONFIRM"
DISPATCH_UNDO = "DISPATCH_UNDO"
SOS_REJECT = "SOS_REJECT"
SOS_HOLD = "SOS_HOLD"
SOS_ESCALATE = "SOS_ESCALATE"
SOS_NOTE = "SOS_NOTE"
VEHICLE_CREATE = "VEHICLE_CREATE"
VEHICLE_UPDATE = "VEHICLE_UPDATE"
VEHICLE_DELETE = "VEHICLE_DELETE"
SIMULATION_RAIN = "SIMULATION_RAIN"
REPORT_APPROVE = "REPORT_APPROVE"
REPORT_REJECT = "REPORT_REJECT"
REPORT_HOLD = "REPORT_HOLD"
REPORT_ESCALATE = "REPORT_ESCALATE"
REPORT_NOTE = "REPORT_NOTE"
USER_CREATE = "USER_CREATE"
USER_UPDATE = "USER_UPDATE"
USER_DELETE = "USER_DELETE"
SENSOR_CREATE = "SENSOR_CREATE"
SENSOR_UPDATE = "SENSOR_UPDATE"
SENSOR_DELETE = "SENSOR_DELETE"
SENSOR_BREACH = "SENSOR_BREACH"


def _canonical(document: dict[str, Any]) -> str:
    """Stable serialisation: same content, same bytes, whatever the dict order."""
    return json.dumps(document, sort_keys=True, separators=(",", ":"), default=str)


def digest(
    *,
    user_id: int | None,
    action_type: str,
    payload: dict[str, Any],
    created_at: datetime,
    previous_hash: str | None,
) -> str:
    """SHA-256 of one record, bound to the record before it."""
    return hashlib.sha256(
        _canonical(
            {
                "user_id": user_id,
                "action_type": action_type,
                "payload": payload,
                "created_at": created_at.isoformat(),
                "previous_hash": previous_hash,
            }
        ).encode("utf-8")
    ).hexdigest()


def previous_hash(db: Session) -> str | None:
    """Digest of the newest entry, or ``None`` for the first record in the chain."""
    latest = (
        db.query(models.AuditLog.hash_signature)
        .order_by(models.AuditLog.log_id.desc())
        .limit(1)
        .scalar()
    )
    return latest


def record(
    db: Session,
    *,
    user: models.User | None,
    action_type: str,
    payload: dict[str, Any] | None = None,
) -> models.AuditLog:
    """Append one attributable entry to the chain.

    Does not commit: the caller commits together with the action being recorded.
    ``user`` may be ``None`` only for actions the system performs on its own.
    """
    user_id = getattr(user, "user_id", None)
    body = dict(payload or {})
    created_at = datetime.now(UTC).replace(tzinfo=None)

    entry = models.AuditLog(
        user_id=user_id,
        action_type=action_type,
        payload=_canonical(body),
        hash_signature=digest(
            user_id=user_id,
            action_type=action_type,
            payload=body,
            created_at=created_at,
            previous_hash=previous_hash(db),
        ),
        created_at=created_at,
    )
    db.add(entry)
    return entry


def verify_chain(entries: list[models.AuditLog]) -> dict[str, Any]:
    """Recompute the chain over ``entries`` in ascending ``log_id`` order.

    Returns ``{"valid", "checked", "broken_at"}``. ``checked`` counts the links
    that verified before a break, so ``valid`` and ``checked == len(entries)``
    together mean the whole chain is intact.
    """
    expected_previous: str | None = None
    for index, entry in enumerate(entries):
        try:
            body = json.loads(entry.payload)
        except (TypeError, ValueError):
            return {"valid": False, "checked": index, "broken_at": entry.log_id}

        expected = digest(
            user_id=entry.user_id,
            action_type=entry.action_type,
            payload=body,
            created_at=entry.created_at,
            previous_hash=expected_previous,
        )
        if expected != entry.hash_signature:
            return {"valid": False, "checked": index, "broken_at": entry.log_id}
        expected_previous = entry.hash_signature

    return {"valid": True, "checked": len(entries), "broken_at": None}
