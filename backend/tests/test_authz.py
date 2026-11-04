"""Authorisation wiring: every route either requires a token or is deliberately public.

These tests read the FastAPI dependency tree rather than calling handlers, so a
new route cannot ship without a token just because nobody remembered to test it.
The role checks themselves are exercised directly, which needs no database.
"""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute

from auth_utils import get_current_user, require_roles
from main import app, require_admin, require_super_admin

# Every guard that admits a portal account and refuses a driver. A route may be
# stricter than its neighbours — vehicle management is SUPER_ADMIN only — but it
# must never fall through to "any authenticated caller".
PORTAL_GUARDS = (require_admin, require_super_admin)
# The only routes a caller may reach without a session. Everything else in
# /api/v1 has to resolve a user first.
PUBLIC_API_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/send-verification",
    "/api/v1/auth/verify",
}

# Routes that change shared state or read incident data. A driver account is
# authenticated, but only a portal role may call these.
PORTAL_ONLY_ROUTES = [
    ("GET", "/api/v1/sos"),
    ("GET", "/api/v1/sos/stream"),
    ("GET", "/api/v1/vehicles/stream"),
    ("POST", "/api/v1/simulation/rain"),
    ("POST", "/api/v1/sos/{sos_id}/assign"),
    ("GET", "/api/v1/dispatch/{sos_id}/preview"),
    ("POST", "/api/v1/dispatch/{sos_id}/confirm"),
    ("POST", "/api/v1/hazards"),
    ("PATCH", "/api/v1/hazards/{hazard_id}"),
    ("POST", "/api/v1/hazards/{hazard_id}/publish"),
    ("GET", "/api/v1/audit"),
    ("GET", "/api/v1/audit/verify"),
    ("GET", "/api/v1/reports"),
    ("GET", "/api/v1/reports/{report_id}"),
    ("GET", "/api/v1/reports/{report_id}/photo"),
    ("POST", "/api/v1/reports/{report_id}/approve"),
    ("POST", "/api/v1/reports/{report_id}/reject"),
    ("POST", "/api/v1/sensors/readings"),
]


# Adding, editing and removing rescue units is the super admin's alone.
SUPER_ADMIN_ONLY_ROUTES = [
    ("POST", "/api/v1/vehicles"),
    ("PATCH", "/api/v1/vehicles/{vehicle_id}"),
    ("DELETE", "/api/v1/vehicles/{vehicle_id}"),
]


def _api_routes() -> list[APIRoute]:
    return [
        route
        for route in app.routes
        if isinstance(route, APIRoute) and route.path.startswith("/api/")
    ]


def _dependency_calls(route: APIRoute) -> set[object]:
    """Every callable FastAPI will run for this route, including nested ones."""
    calls: set[object] = set()
    stack = list(route.dependant.dependencies)
    while stack:
        dependant = stack.pop()
        calls.add(dependant.call)
        stack.extend(dependant.dependencies)
    return calls


def test_every_api_route_except_the_auth_entry_points_requires_a_token():
    unprotected = [
        route.path
        for route in _api_routes()
        if route.path not in PUBLIC_API_PATHS and get_current_user not in _dependency_calls(route)
    ]
    assert unprotected == []


def test_health_endpoint_stays_public():
    route = next(route for route in app.routes if isinstance(route, APIRoute) and route.path == "/")
    assert get_current_user not in _dependency_calls(route)


@pytest.mark.parametrize("method,path", PORTAL_ONLY_ROUTES)
def test_portal_routes_require_a_portal_role(method: str, path: str):
    route = next(
        route
        for route in _api_routes()
        if route.path == path and method in (route.methods or set())
    )
    calls = _dependency_calls(route)
    assert get_current_user in calls
    assert any(guard in calls for guard in PORTAL_GUARDS)


@pytest.mark.parametrize("method,path", SUPER_ADMIN_ONLY_ROUTES)
def test_fleet_management_requires_the_super_admin(method: str, path: str):
    route = next(
        route
        for route in _api_routes()
        if route.path == path and method in (route.methods or set())
    )
    calls = _dependency_calls(route)
    assert get_current_user in calls
    assert require_super_admin in calls
    assert require_admin not in calls


def test_hazard_stream_is_open_to_any_authenticated_user():
    """SEC-007 withholds the fleet, not the hazard layer: the driver map needs it."""
    route = next(route for route in _api_routes() if route.path == "/api/v1/hazards/stream")
    calls = _dependency_calls(route)
    assert get_current_user in calls
    assert not any(guard in calls for guard in PORTAL_GUARDS)


@pytest.mark.parametrize("role", ["LGU_DISPATCHER", "SUPER_ADMIN"])
def test_require_roles_admits_the_listed_roles(role: str):
    dependency = require_roles("LGU_DISPATCHER", "SUPER_ADMIN")
    user = SimpleNamespace(role=role)

    assert dependency(current_user=user) is user


def test_require_roles_rejects_every_other_role():
    dependency = require_roles("LGU_DISPATCHER", "SUPER_ADMIN")

    with pytest.raises(HTTPException) as excinfo:
        dependency(current_user=SimpleNamespace(role="EMERGENCY_DRIVER"))

    assert excinfo.value.status_code == 403
