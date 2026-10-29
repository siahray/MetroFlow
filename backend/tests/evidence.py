"""Evidence fixtures shared by the report unit and integration suites.

A camera JPEG with the metadata the moderation desk reads: a make, a capture
time and a GPS position. The byte layout is an APP1 segment wrapping a
little-endian TIFF, and the offsets are fixed so the fixture stays readable:

    TIFF header 0-7, IFD0 8-61, Exif IFD 62-79, GPS IFD 80-133, data 134+
"""

from __future__ import annotations


def _entry(tag: int, kind: int, count: int, value: bytes) -> bytes:
    return (
        tag.to_bytes(2, "little")
        + kind.to_bytes(2, "little")
        + count.to_bytes(4, "little")
        + value.ljust(4, b"\x00")[:4]
    )


def _offset_entry(tag: int, kind: int, count: int, offset: int) -> bytes:
    return _entry(tag, kind, count, offset.to_bytes(4, "little"))


def _rational(value: int) -> bytes:
    return value.to_bytes(4, "little") + (1).to_bytes(4, "little")


def _gps_rationals(degrees: int, minutes: int) -> bytes:
    return _rational(degrees) + _rational(minutes) + _rational(0)


def build_jpeg(*, make: str = "TestCam", latitude_degrees: int = 14) -> bytes:
    ifd0 = (
        (4).to_bytes(2, "little")
        + _offset_entry(0x010F, 2, 8, 134)  # Make
        + _offset_entry(0x0132, 2, 20, 142)  # DateTime
        + _offset_entry(0x8769, 4, 1, 62)  # Exif IFD pointer
        + _offset_entry(0x8825, 4, 1, 80)  # GPS IFD pointer
        + (0).to_bytes(4, "little")
    )
    exif_ifd = (
        (1).to_bytes(2, "little")
        + _offset_entry(0x9003, 2, 20, 162)  # DateTimeOriginal
        + (0).to_bytes(4, "little")
    )
    gps_ifd = (
        (4).to_bytes(2, "little")
        + _entry(1, 2, 2, b"N\x00")  # latitude ref
        + _offset_entry(2, 5, 3, 182)  # latitude
        + _entry(3, 2, 2, b"E\x00")  # longitude ref
        + _offset_entry(4, 5, 3, 206)  # longitude
        + (0).to_bytes(4, "little")
    )
    data = (
        make.encode().ljust(7, b"\x00")
        + b"\x00"
        + b"2026:10:29 13:00:00\x00"
        + b"2026:10:29 13:00:00\x00"
        + _gps_rationals(latitude_degrees, 35)
        + _gps_rationals(121, 3)
    )
    tiff = (
        b"II"
        + (42).to_bytes(2, "little")
        + (8).to_bytes(4, "little")
        + ifd0
        + exif_ifd
        + gps_ifd
        + data
    )
    payload = b"Exif\x00\x00" + tiff
    return b"\xff\xd8" + b"\xff\xe1" + (len(payload) + 2).to_bytes(2, "big") + payload + b"\xff\xd9"
