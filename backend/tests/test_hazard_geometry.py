"""Unit tests for hazard write validation (VAL-017, VAL-018, E013).

``geojson_to_geometry`` and the ``HazardCreate``/``HazardUpdate`` schemas are
pure — no database — so these run in the default (non-integration) suite.
"""

import pytest
from pydantic import ValidationError

from schemas import HazardCreate, HazardUpdate, geojson_to_geometry

TRIANGLE = {
    "type": "Polygon",
    "coordinates": [[[120.9, 14.5], [121.0, 14.5], [121.0, 14.6], [120.9, 14.5]]],
}
LINE = {"type": "LineString", "coordinates": [[120.9, 14.5], [121.0, 14.6]]}


def test_valid_polygon_and_line_convert():
    assert geojson_to_geometry(TRIANGLE) is not None
    assert geojson_to_geometry(LINE) is not None


def test_polygon_with_fewer_than_three_vertices_rejected():
    degenerate = {
        "type": "Polygon",
        "coordinates": [[[120.9, 14.5], [121.0, 14.5], [120.9, 14.5]]],
    }
    with pytest.raises(ValueError, match="at least three vertices"):
        geojson_to_geometry(degenerate)


def test_self_intersecting_polygon_rejected():
    bowtie = {
        "type": "Polygon",
        "coordinates": [
            [
                [120.9, 14.5],
                [121.0, 14.6],
                [121.0, 14.5],
                [120.9, 14.6],
                [120.9, 14.5],
            ]
        ],
    }
    with pytest.raises(ValueError):
        geojson_to_geometry(bowtie)


def test_line_with_one_point_rejected():
    # Shapely refuses to build a one-point line at all; either way it is a 422.
    with pytest.raises(ValueError):
        geojson_to_geometry({"type": "LineString", "coordinates": [[120.9, 14.5]]})


def test_unsupported_geometry_type_rejected():
    with pytest.raises(ValueError, match="Polygon or LineString"):
        geojson_to_geometry({"type": "Point", "coordinates": [120.9, 14.5]})


def test_obstruction_level_constrained_on_create():
    with pytest.raises(ValidationError):
        HazardCreate(name="x", obstruction_level="partial")
    with pytest.raises(ValidationError):
        HazardCreate(name="x", obstruction_level="LEVEL_9")
    assert HazardCreate(name="x", obstruction_level="LEVEL_2").obstruction_level == "LEVEL_2"


def test_obstruction_level_constrained_on_update():
    with pytest.raises(ValidationError):
        HazardUpdate(obstruction_level="bogus")
    assert HazardUpdate(obstruction_level="IMPASSABLE").obstruction_level == "IMPASSABLE"
