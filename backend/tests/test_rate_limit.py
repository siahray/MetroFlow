"""Request ceilings: the counter, the 429, and which routes carry them.

The counter is exercised against a throwaway SQLite database holding only the
``rate_limit_counters`` table. That keeps the arithmetic, the window rollover and
the failure behaviour testable without PostGIS; the statement itself runs against
the real database in the integration suite.
"""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

import rate_limit as limiter
from main import app
from models import RateLimitCounter

# Every route that spends real resources or is worth brute-forcing, and the
# bucket name it must use. A new route without an entry here is deliberate.
LIMITED_ROUTES = [
    ("POST", "/api/v1/auth/login", "login"),
    ("POST", "/api/v1/auth/register", "register"),
    ("POST", "/api/v1/auth/send-verification", "send-verification"),
    ("POST", "/api/v1/auth/verify", "verify"),
    ("POST", "/api/v1/sos", "sos"),
    ("POST", "/api/v1/simulation/rain", "simulation"),
]


@pytest.fixture
def session_factory():
    """A database holding only the counter table."""
    engine = create_engine("sqlite+pysqlite:///:memory:")
    RateLimitCounter.__table__.create(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def client_request(ip: str = "203.0.113.7") -> SimpleNamespace:
    return SimpleNamespace(headers={"x-forwarded-for": ip}, client=SimpleNamespace(host=ip))


def test_counters_are_scoped_to_their_window(session_factory):
    with session_factory() as db:
        # 100s and 119s fall in the window that starts at 60s; 120s starts the next.
        assert limiter.consume(db, "login:1.2.3.4", 60, now=100) == (1, 60)
        assert limiter.consume(db, "login:1.2.3.4", 60, now=119) == (2, 60)
        assert limiter.consume(db, "login:1.2.3.4", 60, now=120) == (1, 120)


def test_buckets_do_not_share_a_counter(session_factory):
    with session_factory() as db:
        assert limiter.consume(db, "login:1.2.3.4", 60, now=100) == (1, 60)
        assert limiter.consume(db, "login:5.6.7.8", 60, now=100) == (1, 60)
        assert limiter.consume(db, "sos:1.2.3.4", 60, now=100) == (1, 60)


def test_dependency_allows_the_limit_and_rejects_the_next_request(monkeypatch, session_factory):
    monkeypatch.setattr(limiter, "SessionLocal", session_factory)
    dependency = limiter.rate_limit("login", 2)

    assert dependency(client_request()) is None
    assert dependency(client_request()) is None

    with pytest.raises(HTTPException) as excinfo:
        dependency(client_request())

    assert excinfo.value.status_code == 429
    assert "Too many requests" in excinfo.value.detail
    assert int(excinfo.value.headers["Retry-After"]) >= 1


def test_limit_is_per_client(monkeypatch, session_factory):
    monkeypatch.setattr(limiter, "SessionLocal", session_factory)
    dependency = limiter.rate_limit("login", 1)

    assert dependency(client_request("203.0.113.7")) is None
    assert dependency(client_request("198.51.100.9")) is None

    with pytest.raises(HTTPException):
        dependency(client_request("203.0.113.7"))


def test_zero_limit_disables_the_check(monkeypatch):
    def explode(*args, **kwargs):
        raise AssertionError("a disabled limit must not touch the database")

    monkeypatch.setattr(limiter, "SessionLocal", explode)

    assert limiter.rate_limit("login", 0)(client_request()) is None


def test_an_unreachable_database_lets_the_request_through(monkeypatch):
    class BrokenSession:
        def __enter__(self):
            raise SQLAlchemyError("database is down")

        def __exit__(self, *exc_info):
            return False

    monkeypatch.setattr(limiter, "SessionLocal", BrokenSession)

    assert limiter.rate_limit("login", 5)(client_request()) is None


def test_client_id_prefers_the_forwarding_header():
    request = SimpleNamespace(
        headers={"x-forwarded-for": "203.0.113.7, 70.41.3.18"},
        client=SimpleNamespace(host="10.0.0.1"),
    )

    assert limiter.client_id(request) == "203.0.113.7"


def test_client_id_falls_back_to_the_socket_address():
    request = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))

    assert limiter.client_id(request) == "127.0.0.1"


def _dependency_calls(route: APIRoute) -> list[object]:
    """Every callable FastAPI will run for this route, including nested ones."""
    calls: list[object] = []
    stack = list(route.dependant.dependencies)
    while stack:
        dependant = stack.pop()
        calls.append(dependant.call)
        stack.extend(dependant.dependencies)
    return calls


@pytest.mark.parametrize(("method", "path", "bucket"), LIMITED_ROUTES)
def test_route_carries_its_rate_limit(method: str, path: str, bucket: str):
    route = next(
        route
        for route in app.routes
        if isinstance(route, APIRoute) and route.path == path and method in (route.methods or set())
    )
    buckets = {call.limit_name for call in _dependency_calls(route) if hasattr(call, "limit_name")}

    assert bucket in buckets
