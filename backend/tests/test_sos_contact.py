"""The call-back number and plate an SOS carries to dispatch.

Both are optional, so the shape that matters is: what a driver types is stored in
one comparable form, a blank field means "not given" rather than an empty string,
and junk is refused instead of being written to the incident.
"""

import pytest
from pydantic import ValidationError

from schemas import SelfUpdateRequest, SOSCreate


def test_mobile_number_is_stored_as_digits_with_an_optional_plus():
    assert SelfUpdateRequest(mobile_number="+63 917 555 0100").mobile_number == "+639175550100"
    assert SelfUpdateRequest(mobile_number="0917-555-0100").mobile_number == "09175550100"


def test_a_blank_mobile_number_clears_it():
    assert SelfUpdateRequest(mobile_number="   ").mobile_number is None
    assert SelfUpdateRequest(mobile_number=None).mobile_number is None


@pytest.mark.parametrize("value", ["12345", "+63 917 555 0100 999 000 111"])
def test_a_number_with_too_few_or_too_many_digits_is_refused(value):
    with pytest.raises(ValidationError):
        SelfUpdateRequest(mobile_number=value)


def test_plate_is_uppercased_and_blank_means_not_given():
    assert SOSCreate(latitude=14.6, longitude=121.0, plate_number=" abc 1234 ").plate_number == (
        "ABC 1234"
    )
    assert SOSCreate(latitude=14.6, longitude=121.0, plate_number="  ").plate_number is None


def test_plate_with_characters_a_plate_cannot_have_is_refused():
    with pytest.raises(ValidationError):
        SOSCreate(latitude=14.6, longitude=121.0, plate_number="ABC<script>")
