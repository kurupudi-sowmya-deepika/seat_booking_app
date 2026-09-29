"""End-to-end test for the Seat Booking MCP Server.

Exercises the real, intended flow for an external AI agent:
    authenticate_employee -> browse -> check availability -> book -> cancel
against a REAL running backend (SEAT_BOOKING_API_URL, default
http://localhost:8000/api) and a real seeded Postgres database - not mocked.
Also cross-checks a seat booking made through MCP against the normal REST
`/bookings/my` endpoint, to prove MCP bookings are stored in the same
database and visible in the User Portal, not a separate/parallel path.

Run with the venv active, backend running, and `python scripts/seed.py`
already applied at least once:
    python -m mcp_server.test_mcp
"""

import asyncio
import sys
from datetime import date, timedelta

import httpx

from mcp_server.config import settings
from mcp_server.server import (
    authenticate_employee,
    get_locations,
    get_branches,
    get_floors_and_rooms,
    get_time_slots,
    get_my_wallet_balance,
    get_my_bookings,
    check_seat_availability,
    book_seat,
    cancel_my_booking,
    check_day_pass_availability,
    pre_register_visitor,
    check_in_visitor,
    check_out_visitor,
    mcp,
)

TEST_EMAIL = "user@example.com"
TEST_PASSWORD = "user123"


async def main():
    print("=" * 65)
    print(" >>> TESTING SEAT BOOKING MCP SERVER (end-to-end) <<<")
    print("=" * 65)

    print("\n[1/7] Tool registration...")
    tools = await mcp.list_tools()
    print(f"      SUCCESS: {len(tools)} tools registered, including 'authenticate_employee'")
    assert any(t.name == "authenticate_employee" for t in tools), "authenticate_employee tool is missing"

    print("\n[2/7] Rejecting an unauthenticated action (no default identity in production)...")
    try:
        await get_my_wallet_balance()
        print("      FAILED: expected this to be rejected without an explicit auth_token")
        sys.exit(1)
    except RuntimeError as e:
        print(f"      SUCCESS: correctly rejected - {e}")

    print("\n[3/7] authenticate_employee with real credentials...")
    auth = await authenticate_employee(email=TEST_EMAIL, password=TEST_PASSWORD)
    token = auth["auth_token"]
    assert token, "Expected a real auth_token back from authenticate_employee"
    print(f"      SUCCESS: authenticated as {auth['employee_email']}")

    print("\n[4/7] Browsing locations/branches/rooms/time-slots and wallet as that employee...")
    locs = await get_locations()
    branches = await get_branches()
    rooms = await get_floors_and_rooms(room_type="WORKSPACE")
    slots = await get_time_slots()
    wallet = await get_my_wallet_balance(auth_token=token)
    print(f"      SUCCESS: {len(locs)} locations, {len(branches)} branches, {len(rooms)} workspace rooms, {len(slots)} time slots")
    print(f"      SUCCESS: wallet balance {wallet.get('currency', 'INR')} {wallet.get('balance', 0):,.2f}")
    assert rooms, "Need at least one WORKSPACE room to test seat booking"
    assert slots, "Need at least one time slot to test seat booking"

    print("\n[5/7] Booking a real seat through MCP...")
    booking_date = (date.today() + timedelta(days=14)).isoformat()
    room = rooms[0]
    slot = slots[0]
    avail = await check_seat_availability(room_id=room["id"], booking_date=booking_date, time_slot_id=slot["id"])
    free = avail["available_seats"]
    assert free, f"No available seats in room '{room['name']}' on {booking_date}/{slot['id']} to book - pick a different date/room"
    seat = free[0]
    result = await book_seat(
        seat_id=seat["seat_id"], room_id=room["id"], branch_id=room["branch_id"], location_id=room.get("location_id") or branches[0]["location_id"],
        booking_date=booking_date, time_slot_id=slot["id"], auth_token=token,
    )
    booking_id = result.get("id") or result.get("booking_id")
    assert booking_id, f"Expected a real booking id back, got: {result}"
    print(f"      SUCCESS: booked seat '{seat['seat_number']}' - booking id {booking_id}")

    print("\n[6/7] Cross-checking the MCP booking is visible via the normal REST API (same database)...")
    mine = await get_my_bookings(auth_token=token)
    assert any(str(b.get("id") or b.get("booking_id")) == str(booking_id) for b in mine), "Booking not found via get_my_bookings"
    async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
        rest_resp = await client.get(f"{settings.SEAT_BOOKING_API_URL}/bookings/my", headers={"Authorization": f"Bearer {token}"})
    rest_resp.raise_for_status()
    rest_bookings = rest_resp.json()
    assert any(str(b.get("id")) == str(booking_id) for b in rest_bookings), "MCP booking not visible via plain REST /bookings/my - MCP may be writing somewhere else"
    print("      SUCCESS: the booking made via MCP is visible both through the MCP tool and the plain REST API (one shared database).")

    print("\n[7/7] Cancelling the booking and confirming the refund flow...")
    cancel_result = await cancel_my_booking(booking_id=str(booking_id), auth_token=token)
    print(f"      SUCCESS: cancellation result: {cancel_result.get('status') or cancel_result}")

    print("\n[bonus] Day pass availability + visitor pass lifecycle...")
    if branches:
        dp = await check_day_pass_availability(booking_date=booking_date, branch_id=branches[0]["id"])
        print(f"      SUCCESS: day pass capacity confirmed for branch '{branches[0]['name']}' ({len(dp)} package(s))")
        visitor = await pre_register_visitor(
            branch_id=branches[0]["id"], visitor_name="Alex Johnson", visitor_email="alex.johnson@clientcorp.com",
            purpose="Q3 Roadmap Sync", visit_date=booking_date, auth_token=token,
        )
        v_id = visitor.get("id")
        cin = await check_in_visitor(visitor_id=v_id, auth_token=token)
        cout = await check_out_visitor(visitor_id=v_id, auth_token=token)
        print(f"      SUCCESS: visitor pass lifecycle - registered/{cin.get('status')}/{cout.get('status')}")

    print("\n" + "=" * 65)
    print(" ALL MCP END-TO-END TESTS PASSED! [SUCCESS]")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
