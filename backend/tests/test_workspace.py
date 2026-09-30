"""
test_workspace.py – workspace hierarchy & geo-location tests.

Covers:
  • GET /api/locations/
  • GET /api/branches/
  • GET /api/rooms/
  • GET /api/seats/
  • GET /api/time-slots/
  • GET /api/locations/nearest  (Haversine distance calculation)
"""
import pytest


# ──────────────────────────────────────────────────────────────────────────
# Basic listing endpoints
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
async def test_locations_returns_list(http_client, locations):
    assert isinstance(locations, list)
    assert len(locations) > 0
    loc = locations[0]
    for field in ("id", "name", "city", "country"):
        assert field in loc, f"Location missing field: {field}"


@pytest.mark.e2e
async def test_branches_returns_list(http_client, branches):
    assert isinstance(branches, list)
    assert len(branches) > 0
    branch = branches[0]
    assert "id" in branch
    assert "name" in branch
    assert "location_id" in branch


@pytest.mark.e2e
async def test_rooms_returns_list(http_client, rooms):
    assert isinstance(rooms, list)
    # Rooms may be empty in a minimal seed – just check schema if present
    if rooms:
        assert "id" in rooms[0]
        assert "room_type" in rooms[0]


@pytest.mark.e2e
async def test_seats_returns_list(http_client, seats):
    assert isinstance(seats, list)
    if seats:
        seat = seats[0]
        assert "id" in seat
        assert "seat_number" in seat


@pytest.mark.e2e
async def test_time_slots_returns_list(http_client, time_slots):
    assert isinstance(time_slots, list)
    assert len(time_slots) > 0
    slot = time_slots[0]
    assert "id" in slot
    assert "start_time" in slot
    assert "end_time" in slot


# ──────────────────────────────────────────────────────────────────────────
# Nearest-location (Haversine) endpoint
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.e2e
async def test_nearest_location_bangalore_gps(http_client):
    """Querying from Bangalore lat/lon should return a valid nearest location."""
    res = await http_client.get("/api/locations/nearest?lat=12.9716&lon=77.5946")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "location" in data
    assert "name" in data["location"]
    assert "city" in data["location"]


@pytest.mark.e2e
async def test_nearest_location_returns_distance(http_client):
    res = await http_client.get("/api/locations/nearest?lat=12.9716&lon=77.5946")
    assert res.status_code == 200
    assert "distance_km" in res.json()


@pytest.mark.e2e
async def test_nearest_location_missing_params_returns_error(http_client):
    """Omitting required lat/lon must not return 200."""
    res = await http_client.get("/api/locations/nearest")
    assert res.status_code in (400, 422)
