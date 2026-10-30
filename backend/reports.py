"""Report intake rules: urgency, depth semantics and moderation decisions.

Kept out of ``main.py`` because these are the decisions a dispatcher can argue
about, and an argument is easier to settle against a pure function than against
a request handler. Everything here is deterministic and needs no database, so
``tests/test_reports.py`` pins the behaviour without PostGIS.

The scoring follows TSD §2.8:

    severity = ANKLE 1.0 | KNEE 2.0 | IMPASSABLE 3.0
    source   = PHOTO 1.0 | SENSOR 0.9 | CALL 0.8
    corrobor = min(1 + 0.25 × nearby_reports, 2.0)
    recency  = exp(−age_minutes / 30)
    urgency  = severity × source × corrobor × recency

Only the age-independent part is stored. Recency has to be applied when the
queue is read, otherwise an un-triaged report would sit at its intake priority
for ever and a new one would never outrank it.
"""

from __future__ import annotations

import hashlib
import math
from datetime import datetime

# Depth vocabulary used by the API and the driver app.
ANKLE = "ANKLE"
KNEE = "KNEE"
IMPASSABLE = "IMPASSABLE"
DEPTH_LEVELS = (ANKLE, KNEE, IMPASSABLE)

# Display labels, so the portal and the docs agree on the words the FSD uses.
DEPTH_LABELS = {ANKLE: "Ankle-Deep", KNEE: "Knee-Deep", IMPASSABLE: "Impassable"}

SEVERITY = {ANKLE: 1.0, KNEE: 2.0, IMPASSABLE: 3.0}
SOURCE_WEIGHT = {"PHOTO": 1.0, "SENSOR": 0.9, "CALL": 0.8}
SOURCES = tuple(SOURCE_WEIGHT)

# approval maps a witness description onto the hazard vocabulary. The depth is
# an estimate for the hazard's average, not a measurement: the report is
# evidence, the marker is the decision.
HAZARD_LEVEL = {ANKLE: "CAUTION", KNEE: "LEVEL_2", IMPASSABLE: "IMPASSABLE"}
HAZARD_DEPTH_CM = {ANKLE: 20, KNEE: 50, IMPASSABLE: 80}

WAITING = "PENDING"
VERIFIED = "VERIFIED"
REJECTED = "REJECTED"
DUPLICATE = "DUPLICATE"
STATUSES = (WAITING, VERIFIED, REJECTED, DUPLICATE)

# Metro Manila, used only to flag a report whose coordinates cannot be right.
# It is a plausibility check for the moderation desk, not a gate: the API
# already rejects coordinates outside the globe.
PILOT_BOUNDS = {"lat": (14.4, 14.8), "lon": (120.9, 121.2)}


def severity_of(depth_level: str) -> float:
    return SEVERITY[depth_level]


def source_weight(source: str) -> float:
    return SOURCE_WEIGHT.get(source, SOURCE_WEIGHT["CALL"])


def corroboration(nearby_reports: int) -> float:
    """More witnesses inside the radius raise confidence, capped at 2.0."""
    return min(1.0 + 0.25 * max(nearby_reports, 0), 2.0)


def base_urgency(depth_level: str, source: str, nearby_reports: int = 0) -> float:
    """Urgency without the recency term; this is what the row stores."""
    return round(
        severity_of(depth_level) * source_weight(source) * corroboration(nearby_reports), 4
    )


def recency(age_minutes: float) -> float:
    """Exponential decay with a 30-minute half-life scale (TSD §2.8)."""
    return math.exp(-max(age_minutes, 0.0) / 30.0)


def live_urgency(base: float, submitted_at: datetime, now: datetime) -> float:
    """What the queue sorts on: the stored score decayed by the report's age."""
    age_minutes = max((now - submitted_at).total_seconds() / 60.0, 0.0)
    return round(base * recency(age_minutes), 4)


def reporter_hash(user_id: int, salt: str) -> str:
    """Salted digest standing in for the reporter (BR-011).

    The moderation desk only needs to know whether two reports came from the same
    device, never who that device belongs to, so the identity never leaves this
    function.
    """
    return hashlib.sha256(f"{salt}:{user_id}".encode()).hexdigest()


def photo_digest(data: bytes) -> str:
    """SHA-256 of the stored evidence bytes, so a swap is detectable."""
    return hashlib.sha256(data).hexdigest()


# Evidence is accepted in the three formats a phone camera or screenshot
# produces. The type is decided from the bytes, never from the uploaded header:
# SEC-006 treats a lying Content-Type as an attack, and the portal needs a type
# it can trust when it renders the image. WebP is a RIFF container, so it needs
# its own check rather than a prefix in this table.
PHOTO_SIGNATURES = (
    ("image/jpeg", b"\xff\xd8\xff"),
    ("image/png", b"\x89PNG\r\n\x1a\n"),
)


def sniff_image_mime(data: bytes) -> str | None:
    """Return the image type the bytes actually are, or ``None``."""
    if data.startswith(b"RIFF"):
        return "image/webp" if data[8:12] == b"WEBP" else None
    for mime, signature in PHOTO_SIGNATURES:
        if data.startswith(signature):
            return mime
    return None


def depth_label(depth_level: str) -> str:
    return DEPTH_LABELS.get(depth_level, depth_level)


def hazard_for(depth_level: str) -> tuple[str, int]:
    """Obstruction level and average depth for the hazard an approval creates."""
    return HAZARD_LEVEL[depth_level], HAZARD_DEPTH_CM[depth_level]


def location_plausible(latitude: float, longitude: float) -> bool:
    """Whether the point lands inside the pilot area the seed graph covers."""
    return (
        PILOT_BOUNDS["lat"][0] <= latitude <= PILOT_BOUNDS["lat"][1]
        and PILOT_BOUNDS["lon"][0] <= longitude <= PILOT_BOUNDS["lon"][1]
    )


def haversine_m(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    """Great-circle distance in metres, for neighbour detection in Python.

    PostGIS can answer the same question, but the moderation queue needs it for
    a handful of pending reports and doing it here keeps the rule testable
    without a spatial database.
    """
    radius = 6_371_000.0
    phi_a, phi_b = math.radians(a_lat), math.radians(b_lat)
    d_phi = phi_b - phi_a
    d_lambda = math.radians(b_lon - a_lon)
    h = math.sin(d_phi / 2) ** 2 + math.cos(phi_a) * math.cos(phi_b) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(h)))


def hazard_polygon(latitude: float, longitude: float, radius_m: float = 30.0) -> str:
    """WKT square around a verified report point, for the hazard's geometry.

    A report is one coordinate and a hazard is an area, so approval gives the
    marker a small footprint instead of an invalid point-shaped polygon. Degrees
    are converted locally: at this scale a metre of longitude is
    ``cos(latitude)`` shorter than a metre of latitude.
    """
    d_lat = radius_m / 111_320.0
    d_lon = radius_m / (111_320.0 * math.cos(math.radians(latitude)))
    west, east = longitude - d_lon, longitude + d_lon
    south, north = latitude - d_lat, latitude + d_lat
    ring = [
        (west, south),
        (east, south),
        (east, north),
        (west, north),
        (west, south),
    ]
    points = ", ".join(f"{lon:.7f} {lat:.7f}" for lon, lat in ring)
    return f"POLYGON(({points}))"


# ---------------------------------------------------------------------------
# EXIF extraction (FSD-FR-078)
# ---------------------------------------------------------------------------
#
# Evidence photos arrive as camera JPEGs, and the moderation desk needs the
# capture time and the camera's own position to judge whether the photo matches
# where the report claims to be. Pillow is not a dependency of this function, so
# a JPEG's APP1 segment is read directly: enough tags to answer those two
# questions, and nothing else.

# Tag numbers map to the vocabulary the portal renders. IFD0 tags are looked up
# in IFD0, Exif tags in the Exif sub-IFD, GPS tags in the GPS sub-IFD.
_IFD0_TAGS = {0x010F: "camera_make", 0x0110: "camera_model", 0x0132: "modified_at"}
_EXIF_TAGS = {0x9003: "captured_at", 0x9004: "digitized_at", 0x8827: "iso"}
_GPS_TAGS = {1: "gps_latitude_ref", 2: "gps_latitude", 3: "gps_longitude_ref", 4: "gps_longitude"}

_EXIF_IFD_POINTER = 0x8769
_GPS_IFD_POINTER = 0x8825
_TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8}


def _u16(buf: bytes, pos: int, endian: str) -> int:
    return int.from_bytes(buf[pos : pos + 2], endian)


def _u32(buf: bytes, pos: int, endian: str) -> int:
    return int.from_bytes(buf[pos : pos + 4], endian)


def _decode(kind: int, raw: bytes, endian: str, items: int) -> object:
    if kind == 2:
        return raw.split(b"\x00", 1)[0].decode("ascii", "ignore").strip()
    if kind == 3:
        return _u16(raw, 0, endian)
    if kind == 4:
        return _u32(raw, 0, endian)
    if kind == 5:
        values: list[float | None] = []
        for index in range(items):
            numerator = _u32(raw, index * 8, endian)
            denominator = _u32(raw, index * 8 + 4, endian)
            values.append(numerator / denominator if denominator else None)
        return tuple(values) if items > 1 else values[0]
    return raw


def _read_ifd(tiff: bytes, offset: int, endian: str, wanted: dict[int, str]) -> dict[str, object]:
    """Read the tags named in ``wanted`` from the IFD at ``offset``."""
    found: dict[str, object] = {}
    if offset <= 0 or offset + 2 > len(tiff):
        return found

    count = _u16(tiff, offset, endian)
    for index in range(count):
        entry = offset + 2 + index * 12
        if entry + 12 > len(tiff):
            break
        tag = _u16(tiff, entry, endian)
        name = wanted.get(tag)
        if name is None:
            continue
        kind = _u16(tiff, entry + 2, endian)
        items = _u32(tiff, entry + 4, endian)
        size = _TYPE_SIZE.get(kind)
        if not size or items == 0:
            continue
        total = size * items
        position = entry + 8 if total <= 4 else _u32(tiff, entry + 8, endian)
        if position + total > len(tiff):
            continue
        found[name] = _decode(kind, tiff[position : position + total], endian, items)
    return found


def _ifd_offset(tiff: bytes, offset: int, endian: str, tag: int) -> int:
    """Resolve a sub-IFD pointer (Exif, GPS) stored in the IFD at ``offset``."""
    if offset <= 0 or offset + 2 > len(tiff):
        return 0
    for index in range(_u16(tiff, offset, endian)):
        entry = offset + 2 + index * 12
        if entry + 12 > len(tiff):
            return 0
        if _u16(tiff, entry, endian) == tag:
            return _u32(tiff, entry + 8, endian)
    return 0


def _dms_to_degrees(value: object, ref: object) -> float | None:
    """Convert a GPS tag's three rationals into signed decimal degrees."""
    if not isinstance(value, tuple) or len(value) != 3:
        return None
    degrees, minutes, seconds = value
    if degrees is None or minutes is None or seconds is None:
        return None
    result = degrees + minutes / 60.0 + seconds / 3600.0
    if isinstance(ref, str) and ref.upper() in {"S", "W"}:
        result = -result
    return round(result, 6)


def _parse_tiff(tiff: bytes) -> dict[str, object]:
    if len(tiff) < 8 or tiff[:2] not in (b"II", b"MM"):
        return {}
    endian = "little" if tiff[:2] == b"II" else "big"
    if _u16(tiff, 2, endian) != 42:
        return {}

    ifd0_offset = _u32(tiff, 4, endian)
    raw: dict[str, object] = {}
    raw.update(_read_ifd(tiff, ifd0_offset, endian, _IFD0_TAGS))
    raw.update(
        _read_ifd(
            tiff,
            _ifd_offset(tiff, ifd0_offset, endian, _EXIF_IFD_POINTER),
            endian,
            _EXIF_TAGS,
        )
    )

    gps_offset = _ifd_offset(tiff, ifd0_offset, endian, _GPS_IFD_POINTER)
    gps = _read_ifd(tiff, gps_offset, endian, _GPS_TAGS)
    latitude = _dms_to_degrees(gps.get("gps_latitude"), gps.get("gps_latitude_ref"))
    longitude = _dms_to_degrees(gps.get("gps_longitude"), gps.get("gps_longitude_ref"))
    if latitude is not None and longitude is not None:
        raw["gps_latitude"] = latitude
        raw["gps_longitude"] = longitude
        # The camera's own position is the check that matters: a photo taken
        # outside the pilot area cannot evidence a flood inside it.
        raw["gps_in_pilot_area"] = location_plausible(latitude, longitude)

    return raw


def read_exif(data: bytes) -> dict[str, object]:
    """Best-effort EXIF for a JPEG, or an empty dict.

    Intake must never fail because evidence metadata is odd, so every parse error
    degrades to "no EXIF" rather than a rejected report.
    """
    try:
        if not data.startswith(b"\xff\xd8"):
            return {}
        position = 2
        while position + 4 <= len(data):
            if data[position] != 0xFF:
                return {}
            marker = data[position + 1]
            if marker == 0xDA:  # start of scan: no metadata after this
                break
            length = int.from_bytes(data[position + 2 : position + 4], "big")
            if length < 2:
                return {}
            segment = data[position + 4 : position + 2 + length]
            if marker == 0xE1 and segment.startswith(b"Exif\x00\x00"):
                return _parse_tiff(segment[6:])
            position += 2 + length
    except (IndexError, ValueError):
        return {}
    return {}
