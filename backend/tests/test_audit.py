"""Audit integrity: one attributable row per action, and a chain that notices edits.

These run against a throwaway SQLite database holding only ``audit_logs``. The
real table is written by every privileged route, which the integration suite
covers; here the concern is the digest and the chain, which need no PostGIS and
no HTTP.
"""

from __future__ import annotations

import json
from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import audit
from models import AuditLog


@pytest.fixture
def db() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    AuditLog.__table__.create(engine)
    session = sessionmaker(bind=engine, autoflush=True, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def dispatcher(user_id: int = 7) -> SimpleNamespace:
    """The shape ``record`` needs from a user row, without creating one."""
    return SimpleNamespace(user_id=user_id)


def entries(db: Session) -> list[AuditLog]:
    return db.query(AuditLog).order_by(AuditLog.log_id.asc()).all()


def test_record_attributes_the_actor_and_the_payload(db: Session):
    audit.record(
        db,
        user=dispatcher(7),
        action_type=audit.HAZARD_PUBLISH,
        payload={"hazard_id": 12},
    )
    db.commit()

    (entry,) = entries(db)
    assert entry.user_id == 7
    assert entry.action_type == "HAZARD_PUBLISH"
    assert json.loads(entry.payload) == {"hazard_id": 12}
    assert len(entry.hash_signature) == 64
    assert entry.created_at is not None


def test_payload_is_stored_canonically(db: Session):
    audit.record(
        db,
        user=dispatcher(),
        action_type=audit.VEHICLE_UPDATE,
        payload={"b": 2, "a": 1},
    )
    db.commit()

    (entry,) = entries(db)
    # Sorted keys, no spaces: the stored bytes do not depend on dict order.
    assert entry.payload == '{"a":1,"b":2}'


def test_digest_is_content_bound(db: Session):
    base = dict(
        user_id=1,
        action_type=audit.SOS_ASSIGN,
        payload={"sos_id": 3},
        created_at=datetime(2026, 10, 29, 6, 0, 0),
        previous_hash=None,
    )
    same = dict(base)
    other = {**base, "payload": {"sos_id": 4}}

    assert audit.digest(**base) == audit.digest(**same)
    assert audit.digest(**base) != audit.digest(**other)


def test_records_form_a_verifiable_chain(db: Session):
    for index in range(3):
        audit.record(
            db,
            user=dispatcher(),
            action_type=audit.HAZARD_UPDATE,
            payload={"step": index},
        )
    db.commit()

    result = audit.verify_chain(entries(db))
    assert result == {"valid": True, "checked": 3, "broken_at": None}


def test_editing_a_record_breaks_the_chain_at_that_record(db: Session):
    for index in range(3):
        audit.record(
            db,
            user=dispatcher(),
            action_type=audit.HAZARD_UPDATE,
            payload={"step": index},
        )
    db.commit()

    middle = entries(db)[1]
    middle.payload = '{"step":99}'
    db.commit()

    result = audit.verify_chain(entries(db))
    assert result["valid"] is False
    assert result["broken_at"] == middle.log_id
    assert result["checked"] == 1


def test_deleting_a_record_breaks_the_chain_for_the_next_one(db: Session):
    for index in range(3):
        audit.record(
            db,
            user=dispatcher(),
            action_type=audit.HAZARD_UPDATE,
            payload={"step": index},
        )
    db.commit()

    rows = entries(db)
    db.delete(rows[1])
    db.commit()

    result = audit.verify_chain(entries(db))
    assert result["valid"] is False
    assert result["broken_at"] == rows[2].log_id


def test_unparsable_payload_is_reported_as_a_break(db: Session):
    audit.record(db, user=dispatcher(), action_type=audit.HAZARD_PUBLISH, payload={"id": 1})
    db.commit()

    entry = entries(db)[0]
    entry.payload = "not json"
    db.commit()

    assert audit.verify_chain(entries(db))["broken_at"] == entry.log_id


def test_record_does_not_commit_on_its_own(db: Session):
    """The caller commits, so the change and its audit row land together."""
    audit.record(db, user=dispatcher(), action_type=audit.HAZARD_CREATE, payload={"id": 1})

    assert len(db.new) == 1
    db.rollback()
    assert entries(db) == []


def test_first_entry_is_the_chain_origin(db: Session):
    audit.record(db, user=dispatcher(), action_type=audit.HAZARD_CREATE, payload={"id": 1})
    db.commit()

    (entry,) = entries(db)
    assert audit.previous_hash(db) == entry.hash_signature
    assert audit.verify_chain(entries(db))["valid"] is True


# Routes that change data but are not privileged actions: sign-in and sign-up, and the
# citizen-side submissions that anyone may make. Everything else needs an audit entry.
_UNAUDITED_BY_DESIGN = {
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/register"),
    ("POST", "/api/v1/auth/send-verification"),
    ("POST", "/api/v1/auth/verify"),
    ("POST", "/api/v1/sos"),
    ("POST", "/api/v1/reports"),
    ("POST", "/api/v1/vehicles/{vehicle_id}/telemetry"),
}


def test_every_privileged_mutating_route_writes_an_audit_entry():
    """FSD-FR-047, FSD-FR-093: overrides and dispatch decisions are always audited.

    Fails when a new POST/PATCH/PUT/DELETE route is added without ``audit.record`` and is
    not on the short list of routes that are public or citizen-side by design.
    """
    import pathlib
    import re

    source = (pathlib.Path(__file__).resolve().parents[1] / "main.py").read_text()
    blocks = re.split(r"\n(?=@app\.(?:get|post|put|patch|delete)\()", source)
    unaudited = set()
    for block in blocks:
        match = re.match(r'@app\.(post|put|patch|delete)\(\s*"([^"]+)"', block)
        if match and "audit.record(" not in block:
            unaudited.add((match.group(1).upper(), match.group(2)))
    assert unaudited == _UNAUDITED_BY_DESIGN, (
        f"unexpected unaudited routes: {sorted(unaudited - _UNAUDITED_BY_DESIGN)}; "
        f"no longer unaudited: {sorted(_UNAUDITED_BY_DESIGN - unaudited)}"
    )
