"""Report rules: urgency, evidence metadata and the hazard an approval creates.

Everything here is a pure function, so the suite pins the scoring and the EXIF
parser without PostGIS. The endpoints themselves are exercised by the integration
suite.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from evidence import build_jpeg

import reports


def test_depth_vocabulary_maps_onto_the_hazard_vocabulary():
    assert reports.hazard_for(reports.ANKLE) == ("CAUTION", 20)
    assert reports.hazard_for(reports.KNEE) == ("LEVEL_2", 50)
    assert reports.hazard_for(reports.IMPASSABLE) == ("IMPASSABLE", 80)
    assert [reports.depth_label(level) for level in reports.DEPTH_LEVELS] == [
        "Ankle-Deep",
        "Knee-Deep",
        "Impassable",
    ]


def test_urgency_ranks_deeper_and_better_sourced_reports_higher():
    ankle_photo = reports.base_urgency(reports.ANKLE, "PHOTO")
    knee_photo = reports.base_urgency(reports.KNEE, "PHOTO")
    knee_call = reports.base_urgency(reports.KNEE, "CALL")
    impassable_call = reports.base_urgency(reports.IMPASSABLE, "CALL")

    assert ankle_photo < knee_photo
    assert knee_call < knee_photo
    # A third witness is worth more than a better source, but not more than depth.
    assert reports.base_urgency(reports.ANKLE, "PHOTO", nearby_reports=3) > knee_call
    assert impassable_call > knee_photo


def test_corroboration_is_capped_at_double_weight():
    assert reports.corroboration(0) == 1.0
    assert reports.corroboration(2) == 1.5
    assert reports.corroboration(100) == 2.0
    assert reports.base_urgency(reports.KNEE, "PHOTO", 0) * 2 == pytest.approx(
        reports.base_urgency(reports.KNEE, "PHOTO", 100)
    )


def test_recency_decays_and_never_exceeds_one():
    assert reports.recency(0) == 1.0
    assert reports.recency(30) == pytest.approx(0.3679, abs=1e-4)
    assert reports.recency(-5) == 1.0
    assert reports.recency(600) < 0.001


def test_live_urgency_sinks_an_older_report_below_a_fresher_one():
    now = datetime(2026, 10, 29, 12, 0, 0)
    old = reports.live_urgency(2.0, now - timedelta(hours=2), now)
    fresh = reports.live_urgency(1.0, now, now)

    assert fresh > old
    # The stored score is unchanged: recency is applied on read, not written.
    assert reports.live_urgency(2.0, now, now) == 2.0


def test_reporter_hash_is_salted_stable_and_not_the_user_id():
    first = reports.reporter_hash(7, "salt-a")
    again = reports.reporter_hash(7, "salt-a")
    rotated = reports.reporter_hash(7, "salt-b")
    other_user = reports.reporter_hash(8, "salt-a")

    assert first == again
    assert len(first) == 64
    assert first != rotated
    assert first != other_user
    assert first != "7"


def test_photo_digest_changes_with_the_bytes():
    assert reports.photo_digest(b"one") == reports.photo_digest(b"one")
    assert reports.photo_digest(b"one") != reports.photo_digest(b"two")
    assert len(reports.photo_digest(b"one")) == 64


def test_location_plausibility_uses_the_pilot_bounds():
    assert reports.location_plausible(14.5764, 121.0851) is True
    assert reports.location_plausible(10.3157, 123.8854) is False
    assert reports.location_plausible(14.9, 121.0851) is False


def test_haversine_matches_a_known_distance():
    # Pasig to Taguig, roughly 7.5 km apart.
    distance = reports.haversine_m(14.5764, 121.0851, 14.5176, 121.0509)
    assert 7_000 < distance < 8_000
    assert reports.haversine_m(14.5, 121.0, 14.5, 121.0) == 0.0
    assert distance == pytest.approx(reports.haversine_m(14.5176, 121.0509, 14.5764, 121.0851))


def test_hazard_polygon_is_a_closed_ring_around_the_report():
    wkt = reports.hazard_polygon(14.5764, 121.0851)

    assert wkt.startswith("POLYGON((") and wkt.endswith("))")
    coordinates = wkt.removeprefix("POLYGON((").removesuffix("))").split(", ")
    assert len(coordinates) == 5
    assert coordinates[0] == coordinates[-1]

    longitudes = [float(pair.split()[0]) for pair in coordinates]
    latitudes = [float(pair.split()[1]) for pair in coordinates]
    assert min(latitudes) < 14.5764 < max(latitudes)
    assert min(longitudes) < 121.0851 < max(longitudes)


# ---------------------------------------------------------------------------
# EXIF
# ---------------------------------------------------------------------------


def test_exif_exposes_capture_time_camera_and_position():
    exif = reports.read_exif(build_jpeg())

    assert exif["camera_make"] == "TestCam"
    assert exif["captured_at"] == "2026:10:29 13:00:00"
    assert exif["gps_latitude"] == pytest.approx(14.583333, abs=1e-6)
    assert exif["gps_longitude"] == pytest.approx(121.05, abs=1e-6)
    assert exif["gps_in_pilot_area"] is True


def test_exif_flags_a_photo_taken_outside_the_pilot_area():
    # The report can claim Pasig while the camera says Cebu.
    assert reports.read_exif(build_jpeg(latitude_degrees=10))["gps_in_pilot_area"] is False


def test_a_report_photo_without_exif_is_not_an_error():
    assert reports.read_exif(b"\xff\xd8\xff\xd9") == {}
    assert reports.read_exif(b"") == {}
    assert reports.read_exif(b"not a jpeg") == {}


def test_truncated_exif_degrades_to_no_metadata():
    jpeg = build_jpeg()
    assert reports.read_exif(jpeg[:60]) == {}
    assert reports.read_exif(jpeg[:140]) == {}


def test_exif_timestamp_parses_the_camera_format():
    from main import _exif_timestamp

    assert _exif_timestamp("2026:10:29 13:00:00") == datetime(2026, 10, 29, 13, 0, 0)
    assert _exif_timestamp("not a date") is None


def test_photo_type_is_decided_from_the_bytes_not_the_upload_header():
    assert reports.sniff_image_mime(build_jpeg()) == "image/jpeg"
    assert reports.sniff_image_mime(b"\x89PNG\r\n\x1a\n" + b"0" * 10) == "image/png"
    assert reports.sniff_image_mime(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image/webp"
    # A client can claim any type; these bytes are not an image the API accepts.
    assert reports.sniff_image_mime(b"GIF89a" + b"0" * 10) is None
    assert reports.sniff_image_mime(b"RIFF\x00\x00\x00\x00WAVEfmt ") is None
    assert reports.sniff_image_mime(b"") is None


def test_sensor_mismatch_only_when_the_nearest_gauge_in_range_contradicts_the_report():
    here = (14.6, 121.0)
    near = (14.601, 121.0)  # about 110 m away
    far = (14.7, 121.0)  # about 11 km away: out of range

    # Nearest gauge has reported and is quiet: the report is contradicted.
    assert reports.sensor_mismatch(*here, [(*near, True, False)]) is True
    # Gauge in breach agrees with the report.
    assert reports.sensor_mismatch(*here, [(*near, True, True)]) is False
    # No reading yet, no gauge, or only a far gauge: absence of data is not a contradiction.
    assert reports.sensor_mismatch(*here, [(*near, False, False)]) is False
    assert reports.sensor_mismatch(*here, []) is False
    assert reports.sensor_mismatch(*here, [(*far, True, False)]) is False
    # The nearest gauge decides, not any gauge.
    assert (
        reports.sensor_mismatch(*here, [(*near, True, True), (14.603, 121.0, True, False)]) is False
    )
    # A report without a position cannot be compared.
    assert reports.sensor_mismatch(None, None, [(*near, True, False)]) is False
