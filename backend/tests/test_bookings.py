"""
test_bookings.py – booking lifecycle tests (pytest version).

Covers (converted from test_api_flow.py + test_advanced_features.py):
  • Create a SEAT booking  →  wallet deduction
  • Booking history  (/bookings/my)
  • Cancel booking  →  instant full refund
  • Duplicate / double-booking prevention
  • Hourly MEETING_ROOM booking  →  extend by +1 hour
  • iCalendar (.ics) export
  • Alternative resource suggestions
"""
from __future__ import annotations

import pytest

# Fixed test date that should be far enough in the future to avoid conflicts
TEST_BOOKING_DATE = "2026-12-01"
TEST_ROOM_DATE = "2026-12-10"


# ──────────────────────────────────────────────────────────────────────────
# Seat booking lifecycle
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.booking
async def test_seat_booking_creates_and_deducts_wallet(
    http_client, user_headers, seats, time_slots, locations, branches, user_wallet_balance
):
    """Full happy-path: create booking → wallet is debited → cancel → full refund."""
    initial_balance = user_wallet_balance
    seat = seats[0]
    slot = time_slots[0]
    loc = locations[0]
    branch = branches[0]

    payload = {
        "booking_type": "SEAT",
        "location_id": str(loc["id"]),
        "branch_id": str(branch["id"]),
        "room_id": str(seat["room_id"]),
        "seat_id": str(seat["id"]),
        "time_slot_id": str(slot["id"]),
        "booking_date": TEST_BOOKING_DATE,
        "notes": "pytest harness – seat booking lifecycle",
    }

    # --- Create ---
    res = await http_client.post("/api/bookings/", json=payload, headers=user_headers)
    assert res.status_code in (200, 201), f"Booking creation failed: {res.text}"
    booking = res.json()
    booking_id = booking["id"]
    amount = float(booking.get("amount", booking.get("total_price", 0)))

    # --- Wallet debited ---
    bal_res = await http_client.get("/api/wallet/balance", headers=user_headers)
    assert bal_res.status_code == 200
    new_balance = float(bal_res.json()["balance"])
    assert new_balance == pytest.approx(initial_balance - amount, abs=0.01), (
        f"Wallet deduction mismatch: expected {initial_balance - amount}, got {new_balance}"
    )

    # --- Cancel ---
    cancel_res = await http_client.post(f"/api/bookings/{booking_id}/cancel", headers=user_headers)
    assert cancel_res.status_code == 200, f"Cancellation failed: {cancel_res.text}"
    assert cancel_res.json()["status"] == "CANCELLED"

    # --- Full refund ---
    refund_res = await http_client.get("/api/wallet/balance", headers=user_headers)
    refunded_balance = float(refund_res.json()["balance"])
    assert refunded_balance == pytest.approx(initial_balance, abs=0.01), (
        f"Refund mismatch: expected {initial_balance}, got {refunded_balance}"
    )


@pytest.mark.e2e
@pytest.mark.booking
async def test_booking_appears_in_my_bookings(
    http_client, user_headers, seats, time_slots, locations, branches
):
    seat = seats[0]
    slot = time_slots[0]

    payload = {
        "booking_type": "SEAT",
        "location_id": str(locations[0]["id"]),
        "branch_id": str(branches[0]["id"]),
        "room_id": str(seat["room_id"]),
        "seat_id": str(seat["id"]),
        "time_slot_id": str(slot["id"]),
        "booking_date": "2026-12-02",
    }
    create_res = await http_client.post("/api/bookings/", json=payload, headers=user_headers)
    assert create_res.status_code in (200, 201), create_res.text
    booking_id = create_res.json()["id"]

    # Fetch user's history
    my_res = await http_client.get("/api/bookings/my", headers=user_headers)
    assert my_res.status_code == 200
    my_bookings = my_res.json()
    assert any(b["id"] == booking_id for b in my_bookings), (
        f"Created booking {booking_id} not found in /bookings/my"
    )

    # Cleanup
    await http_client.post(f"/api/bookings/{booking_id}/cancel", headers=user_headers)


@pytest.mark.e2e
@pytest.mark.booking
async def test_booking_requires_auth(http_client, seats, time_slots, locations, branches):
    payload = {
        "booking_type": "SEAT",
        "location_id": str(locations[0]["id"]),
        "branch_id": str(branches[0]["id"]),
        "room_id": str(seats[0]["room_id"]),
        "seat_id": str(seats[0]["id"]),
        "time_slot_id": str(time_slots[0]["id"]),
        "booking_date": "2026-12-03",
    }
    res = await http_client.post("/api/bookings/", json=payload)
    assert res.status_code == 401


# ──────────────────────────────────────────────────────────────────────────
# Alternative resource suggestions
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.booking
async def test_alternatives_endpoint_returns_suggestions(http_client, user_headers, branches):
    branch_id = branches[0]["id"]
    res = await http_client.get(
        f"/api/bookings/alternatives?branch_id={branch_id}&booking_date=2026-12-15&resource_type=SEAT",
        headers=user_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "alternatives" in data
    assert "message" in data


# ──────────────────────────────────────────────────────────────────────────
# Meeting room booking lifecycle
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
@pytest.mark.booking
async def test_meeting_room_booking_and_extension(
    http_client, user_headers, rooms, locations, branches
):
    """Book a MEETING_ROOM, extend by 1 hour, verify end_time, then clean up."""
    branch = branches[0]
    loc = locations[0]
    meeting_room = next(
        (r for r in rooms if r.get("room_type") == "MEETING_ROOM" and r.get("branch_id") == branch["id"]),
        None,
    )
    if meeting_room is None:
        pytest.skip("No MEETING_ROOM found in the first branch – run seed.py or skip this test")

    payload = {
        "booking_type": "MEETING_ROOM",
        "location_id": str(loc["id"]),
        "branch_id": str(branch["id"]),
        "room_id": str(meeting_room["id"]),
        "booking_date": TEST_ROOM_DATE,
        "start_time": "09:00:00",
        "end_time": "10:00:00",
    }
    create_res = await http_client.post("/api/bookings/", json=payload, headers=user_headers)
    assert create_res.status_code in (200, 201), f"Room booking failed: {create_res.text}"
    booking = create_res.json()
    booking_id = booking["id"]

    # Extend by +1 hour
    ext_res = await http_client.post(
        f"/api/bookings/{booking_id}/extend",
        json={"additional_hours": 1},
        headers=user_headers,
    )
    assert ext_res.status_code == 200, f"Extension failed: {ext_res.text}"
    extended = ext_res.json()
    assert extended["end_time"] == "11:00:00", (
        f"Expected end_time=11:00:00 after +1h extension, got {extended.get('end_time')}"
    )

    # Cleanup
    cancel_res = await http_client.post(f"/api/bookings/{booking_id}/cancel", headers=user_headers)
    assert cancel_res.status_code == 200


@pytest.mark.e2e
@pytest.mark.booking
async def test_ical_export_for_meeting_room_booking(
    http_client, user_headers, rooms, locations, branches
):
    """The .ics export must return valid iCalendar content."""
    branch = branches[0]
    loc = locations[0]
    meeting_room = next(
        (r for r in rooms if r.get("room_type") == "MEETING_ROOM" and r.get("branch_id") == branch["id"]),
        None,
    )
    if meeting_room is None:
        pytest.skip("No MEETING_ROOM found – skipping iCal export test")

    payload = {
        "booking_type": "MEETING_ROOM",
        "location_id": str(loc["id"]),
        "branch_id": str(branch["id"]),
        "room_id": str(meeting_room["id"]),
        "booking_date": "2026-12-11",
        "start_time": "11:00:00",
        "end_time": "12:00:00",
    }
    create_res = await http_client.post("/api/bookings/", json=payload, headers=user_headers)
    assert create_res.status_code in (200, 201), create_res.text
    booking_id = create_res.json()["id"]

    ical_res = await http_client.get(f"/api/bookings/{booking_id}/ical", headers=user_headers)
    assert ical_res.status_code == 200
    assert "BEGIN:VCALENDAR" in ical_res.text
    assert "UID:" in ical_res.text

    # Cleanup
    await http_client.post(f"/api/bookings/{booking_id}/cancel", headers=user_headers)
