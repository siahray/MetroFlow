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
from main import app, require_admin

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
    ("POST", "/api/v1/simulation/rain"),
    ("POST", "/api/v1/sos/{sos_id}/assign"),
    ("POST", "/api/v1/dispatch/{sos_id}/confirm"),
    ("POST", "/api/v1/hazards"),
    ("PATCH", "/api/v1/hazards/{hazard_id}"),
    ("POST", "/api/v1/hazards/{hazard_id}/publish"),
    ("POST", "/api/v1/vehicles"),
    ("PATCH", "/api/v1/vehicles/{vehicle_id}"),
    ("GET", "/api/v1/audit"),
    ("GET", "/api/v1/audit/verify"),
    ("GET", "/api/v1/reports"),
    ("GET", "/api/v1/reports/{report_id}"),
    ("GET", "/api/v1/reports/{report_id}/photo"),
    ("POST", "/api/v1/reports/{report_id}/approve"),
    ("POST", "/api/v1/reports/{report_id}/reject"),
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
    assert require_admin in calls


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
