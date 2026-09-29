"""Regression: bookings created before branches existed have branch_id NULL (bookings.branch_id is
nullable since migration 00002). BookingResponse/BookingDetailResponse must accept them instead of
failing validation, which made GET /bookings/my return 500 for any user owning such a booking.

Pure schema test - no database. Run from backend/:  python -m pytest tests/test_booking_null_branch.py
"""
import uuid
from datetime import date, datetime

from app.schemas.booking import BookingDetailResponse


def _payload(**overrides):
    base = {
        "id": uuid.uuid4(), "user_id": uuid.uuid4(), "booking_type": "SEAT", "location_id": uuid.uuid4(),
        "branch_id": uuid.uuid4(), "booking_date": date(2026, 9, 30), "status": "CONFIRMED",
        "amount": 90.0, "created_at": datetime(2026, 9, 29, 17, 43),
    }
    base.update(overrides)
    return base


def test_booking_without_branch_is_accepted():
    booking = BookingDetailResponse(**_payload(branch_id=None, branch_name=None))
    assert booking.branch_id is None


def test_booking_with_branch_still_round_trips():
    branch_id = uuid.uuid4()
    assert BookingDetailResponse(**_payload(branch_id=branch_id)).branch_id == branch_id
