"""Event feed: framing, cursor rules, and what the relay yields.

Everything here runs without a database. ``emit`` only needs a session that
records ``add``/``flush``; the relay's query is replaced with a scripted one, so
what is pinned is the wire format and the loop's two promises — a snapshot or a
replay, never both, and a closed session however the stream ends. The endpoints
themselves are exercised by the integration suite.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

import events
import models
from config import settings


class FakeSession:
    """The relay only reads, rolls back and closes its own session."""

    def __init__(self) -> None:
        self.rollbacks = 0
        self.closed = False

    def rollback(self) -> None:
        self.rollbacks += 1

    def close(self) -> None:
        self.closed = True


class RecordingSession:
    """Captures what ``emit`` asks of the caller's session."""

    def __init__(self) -> None:
        self.added: list[models.EventLog] = []
        self.flushes = 0

    def add(self, row: models.EventLog) -> None:
        self.added.append(row)

    def flush(self) -> None:
        # The real database assigns the id on flush; the relay needs it then,
        # not after the commit, or a mutation and its event could disagree.
        self.flushes += 1
        self.added[-1].event_id = 41


@pytest.fixture
def relay(monkeypatch):
    """A fake relay: one session, a scripted tail, and a very short lifetime.

    Polling at 1 ms and ending after 30 ms keeps the loop honest (several
    iterations, real sleeping) without adding half a minute to the suite.
    """
    db = FakeSession()
    calls: list[tuple[int, int]] = []
    batches: list[list[SimpleNamespace]] = []

    def fake_replay(session, channel, after, limit):
        assert session is db
        calls.append((after, limit))
        return batches.pop(0) if batches else []

    monkeypatch.setattr(events, "replay", fake_replay)
    monkeypatch.setattr(settings, "event_stream_poll_ms", 1)
    monkeypatch.setattr(settings, "event_stream_lifetime_seconds", 0.03)
    monkeypatch.setattr(settings, "event_stream_heartbeat_seconds", 1)
    monkeypatch.setattr(settings, "event_stream_batch", 200)

    return SimpleNamespace(db=db, factory=lambda: db, calls=calls, batches=batches)


def ids(frames: list[str]) -> list[int]:
    return [
        int(line.removeprefix("id: "))
        for frame in frames
        for line in frame.splitlines()
        if line.startswith("id: ")
    ]


def data_lines(frame: str) -> list[str]:
    return [line for line in frame.splitlines() if line.startswith("data: ")]


# ---------------------------------------------------------------------------
# Wire format
# ---------------------------------------------------------------------------


def test_frame_carries_one_id_one_type_and_one_json_line():
    wire = events.frame(7, events.HAZARD_UPDATED, {"hazard_id": 7, "avg_depth_cm": 40})

    assert wire == 'id: 7\nevent: hazard.updated\ndata: {"hazard_id":7,"avg_depth_cm":40}\n\n'


def test_frame_keeps_a_multiline_payload_on_a_single_data_line():
    """A bare newline inside ``data:`` would split the event; JSON escapes it."""
    wire = events.frame(3, events.HAZARD_CREATED, {"notes": "line one\nline two"})

    lines = data_lines(wire)
    assert len(lines) == 1
    assert json.loads(lines[0].removeprefix("data: "))["notes"] == "line one\nline two"
    assert wire.endswith("\n\n")


def test_frame_serialises_dates_and_uuids_instead_of_failing():
    """The payload was just handed to ``json.dumps``; non-core types must survive."""
    wire = events.frame(
        1,
        events.HAZARD_CREATED,
        {"at": datetime(2026, 10, 30, 12, 0, tzinfo=UTC), "id": SimpleNamespace()},
    )

    line = data_lines(wire)[0].removeprefix("data: ")
    assert '"at":"2026-10-30 12:00:00+00:00"' in line


# ---------------------------------------------------------------------------
# Emitting
# ---------------------------------------------------------------------------


def test_emit_flushes_so_the_id_exists_before_the_commit():
    db = RecordingSession()

    event_id = events.emit(
        db,
        channel=events.HAZARD,
        event_type=events.HAZARD_PUBLISHED,
        payload={"hazard_id": 4},
    )

    assert event_id == 41
    assert db.flushes == 1
    assert len(db.added) == 1
    assert (db.added[0].channel, db.added[0].event_type) == (
        events.HAZARD,
        events.HAZARD_PUBLISHED,
    )
    assert db.added[0].payload == {"hazard_id": 4}


def test_emit_leaves_the_commit_to_the_caller():
    """No commit here: the event must roll back with a failed mutation."""

    class NoCommitSession(RecordingSession):
        def commit(self) -> None:  # pragma: no cover - must never run
            raise AssertionError("emit must not commit")

    events.emit(NoCommitSession(), channel=events.SOS, event_type=events.SOS_CREATED, payload={})


def test_payloads_match_the_rest_contract():
    """A streamed row is the row ``GET`` returns, so a client can upsert blindly."""
    hazard = models.HazardZone(
        hazard_id=4,
        name="Flooded underpass",
        obstruction_level="LEVEL_2",
        avg_depth_cm=50,
        active=True,
        created_at=datetime(2026, 10, 30, 12, 0),
    )
    vehicle = models.Vehicle(
        vehicle_id=2, call_sign="RU-02", vehicle_type="RESCUE_BOAT", status="AVAILABLE"
    )
    sos = models.SOSRequest(sos_id=9, latitude=14.6, longitude=121.0, note=None, status="PENDING")

    assert events.hazard_payload(hazard) == {
        "hazard_id": 4,
        "name": "Flooded underpass",
        "obstruction_level": "LEVEL_2",
        "avg_depth_cm": 50,
        "edge_id": None,
        "notes": None,
        "published_at": None,
        "active": True,
        "created_at": "2026-10-30T12:00:00",
        "updated_at": None,
    }
    assert events.vehicle_payload(vehicle)["call_sign"] == "RU-02"
    assert events.sos_payload(sos)["sos_id"] == 9


# ---------------------------------------------------------------------------
# Cursors
# ---------------------------------------------------------------------------


def test_parse_cursor_prefers_the_query_parameter_over_the_header():
    assert events.parse_cursor(after=4, last_event_id="9") == 4


def test_parse_cursor_resumes_from_the_last_event_id_header():
    assert events.parse_cursor(after=None, last_event_id="9") == 9
    assert events.parse_cursor(after=None, last_event_id="  9 ") == 9


def test_parse_cursor_returns_none_for_a_fresh_subscription():
    assert events.parse_cursor(after=None, last_event_id=None) is None
    assert events.parse_cursor(after=None, last_event_id="") is None
    assert events.parse_cursor(after=None, last_event_id="   ") is None


@pytest.mark.parametrize("header", ["abc", "1.5", "-1", "1e3", "0x10"])
def test_parse_cursor_rejects_a_malformed_header(header):
    """Silently resetting to the beginning would replay the whole log on a typo."""
    with pytest.raises(ValueError):
        events.parse_cursor(after=None, last_event_id=header)


# ---------------------------------------------------------------------------
# The relay
# ---------------------------------------------------------------------------


def test_stream_opens_with_retry_then_one_snapshot_at_the_latest_id(relay, monkeypatch):
    monkeypatch.setattr(settings, "event_stream_lifetime_seconds", 0)
    snapshot = {"hazards": [{"hazard_id": 4}]}

    frames = list(
        events.stream(
            relay.factory,
            channel=events.HAZARD,
            cursor=12,
            snapshot=snapshot,
            snapshot_id=12,
        )
    )

    assert frames[0] == f"retry: {events.RETRY_MS}\n\n"
    assert frames[1] == events.frame(12, events.SNAPSHOT, snapshot)
    # A snapshot subscription starts from the snapshot's id, never from zero:
    # otherwise every fresh client would re-receive events it already has.
    assert relay.calls == []
    assert relay.db.closed


def test_stream_replays_missed_events_in_order_and_advances_the_cursor(relay):
    relay.batches.append(
        [
            SimpleNamespace(event_id=8, event_type=events.HAZARD_UPDATED, payload={"hazard_id": 8}),
            SimpleNamespace(
                event_id=9, event_type=events.HAZARD_PUBLISHED, payload={"hazard_id": 9}
            ),
        ]
    )

    frames = list(events.stream(relay.factory, channel=events.HAZARD, cursor=7))

    assert ids(frames) == [8, 9]
    assert "event: hazard.updated" in frames[1]
    assert "event: hazard.published" in frames[2]
    assert json.loads(data_lines(frames[2])[0].removeprefix("data: ")) == {"hazard_id": 9}
    # The drain after a batch asks for what comes after the last delivered id,
    # so a client that fell behind cannot skip or repeat a row.
    assert (8, 200) not in relay.calls
    assert (9, 200) in relay.calls
    assert relay.db.closed


def test_stream_never_mixes_a_snapshot_with_a_replay(relay):
    """A reconnect sends a cursor and no snapshot; a fresh client the reverse."""
    frames = list(
        events.stream(
            relay.factory,
            channel=events.SOS,
            cursor=0,
            snapshot={"sos": []},
            snapshot_id=0,
        )
    )

    assert "event: snapshot" in frames[1]
    assert sum("event: snapshot" in frame for frame in frames) == 1


def test_stream_keeps_the_connection_warm_and_leaves_no_open_transaction(relay, monkeypatch):
    monkeypatch.setattr(settings, "event_stream_heartbeat_seconds", 0)

    frames = list(events.stream(relay.factory, channel=events.VEHICLE, cursor=0))

    assert ": keep-alive\n\n" in frames
    # Ending each read transaction matters: between polls the connection must
    # not sit "idle in transaction" on a pooler that is shared by everyone.
    assert relay.db.rollbacks >= 1
    assert relay.calls
    assert all(call[0] == 0 for call in relay.calls)


def test_stream_closes_its_session_even_when_the_client_disconnects(relay):
    frames = events.stream(relay.factory, channel=events.HAZARD, cursor=0)

    next(frames)
    frames.close()

    assert relay.db.closed
