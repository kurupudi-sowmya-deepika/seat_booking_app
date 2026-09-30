"""SpaceHub MCP Server
Provides a Model Context Protocol (MCP) interface for external AI assistants
(WorkPilot, Intuceo.Ai, Claude Desktop, AGY IDE) to interact securely with the
SpaceHub user portal APIs.

Call `authenticate_employee(email, password)` first to obtain a real per-employee
`auth_token`, then pass it to every other tool. A shared "default identity"
fallback exists only for local testing (see `MCP_ALLOW_DEFAULT_IDENTITY` in
config.py) and is disabled by default.

Transport is selected via `MCP_TRANSPORT` (config.py): `stdio` (default) for a
locally-spawned client such as Claude Desktop, or `streamable-http` to run this
as a standalone network service another application can connect to.
"""

import hmac
from typing import List, Dict, Any, Optional

import uvicorn
from mcp.server.fastmcp import FastMCP
from starlette.responses import JSONResponse
from mcp_server.client import api_client
from mcp_server.config import settings

# Initialize FastMCP Server. host/port only take effect for the streamable-http
# transport (see `if __name__ == "__main__":` below) - stdio ignores them.
mcp = FastMCP(
    name="SeatBookingPortal",
    instructions="MCP Server providing secure access to the SpaceHub Application user portal. Allows searching and booking desks, meeting rooms, viewing reservations, and checking wallet credits without direct database access. Call authenticate_employee first to obtain a real employee's auth_token.",
    host=settings.MCP_HOST,
    port=settings.MCP_PORT,
)

SEAT_STATUS_AVAILABLE = "AVAILABLE"


def _seat_is_available(seat: Dict[str, Any]) -> bool:
    """`GET /bookings/availability/seat` reports `status` ("AVAILABLE" | "BOOKED"), not a boolean flag."""
    return str(seat.get("status", "")).upper() == SEAT_STATUS_AVAILABLE


@mcp.tool()
async def authenticate_employee(email: str, password: str) -> Dict[str, Any]:
    """Authenticate as a real employee using their own SpaceHub email and password.
    Call this FIRST, before any tool that books, cancels, or reads personal data
    (bookings, wallet, visitors) - those tools act as whichever employee's
    `auth_token` you pass them, so obtain a real one here rather than guessing.

    Args:
        email: The employee's SpaceHub account email.
        password: The employee's SpaceHub account password.

    Returns:
        Dictionary with `auth_token` (pass this as `auth_token` to every other tool
        for this employee) and `employee_email`.
    """
    token = await api_client.login(email, password)
    return {"auth_token": token, "employee_email": email}

@mcp.tool()
async def get_current_user(employee_email: Optional[str] = None, auth_token: Optional[str] = None) -> Dict[str, Any]:
    """Return the acting employee's own profile so the caller can confirm whose identity is in use.

    Args:
        employee_email: Email of the employee to act as (trusted callers only).
        auth_token: The employee's bearer token from authenticate_employee.

    Returns:
        Dictionary with id, name, email and role. No other personal data is returned.
    """
    me = await api_client.get_current_user(employee_email=employee_email, auth_token=auth_token)
    return {key: me.get(key) for key in ("id", "name", "email", "role")}

@mcp.tool()
async def get_users(search: str, employee_email: Optional[str] = None, auth_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """Search active colleagues by name or email (e.g. to invite meeting participants).

    Args:
        search: At least 2 characters of a name or email.
        employee_email: Email of the employee to act as (trusted callers only).
        auth_token: The employee's bearer token from authenticate_employee.

    Returns:
        Up to 10 matches with id, name and email only.
    """
    users = await api_client.search_users(search=search, employee_email=employee_email, auth_token=auth_token)
    return [{key: u.get(key) for key in ("id", "name", "email")} for u in users]

@mcp.tool()
async def get_locations() -> List[Dict[str, Any]]:
    """Retrieve all corporate office locations (e.g. Jacksonville, London, Bangalore, Hyderabad).

    Returns:
        List of locations with their ID, name, city, state, country, and address.
    """
    return await api_client.get_locations()

@mcp.tool()
async def get_branches(location_id: Optional[str] = None, location_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve campus branches and office buildings for a specific location.

    Args:
        location_id: Optional UUID of the location.
        location_name: Optional name or city of the location (e.g. 'Bangalore', 'London').

    Returns:
        List of campus branches with id, name, address, and location details.
    """
    target_loc_id = location_id
    if not target_loc_id and location_name:
        locs = await api_client.get_locations()
        matched = next((l for l in locs if location_name.lower() in l.get("name", "").lower() or location_name.lower() in l.get("city", "").lower()), None)
        if matched:
            target_loc_id = matched["id"]

    return await api_client.get_branches(location_id=target_loc_id)

@mcp.tool()
async def get_floors_and_rooms(
    branch_id: Optional[str] = None,
    branch_name: Optional[str] = None,
    room_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve rooms, floors, and workspace zones within a campus branch.

    Args:
        branch_id: Optional UUID of the branch.
        branch_name: Optional branch name (e.g. 'Development Center', 'Global Delivery Center').
        room_type: Optional room type filter: 'WORKSPACE' (desks), 'MEETING_ROOM', 'CONFERENCE_ROOM'.

    Returns:
        List of rooms with capacity, floor, facilities, and hourly/slot pricing.
    """
    target_branch_id = branch_id
    if not target_branch_id and branch_name:
        branches = await api_client.get_branches()
        matched = next((b for b in branches if branch_name.lower() in b.get("name", "").lower()), None)
        if matched:
            target_branch_id = matched["id"]

    return await api_client.get_rooms(branch_id=target_branch_id, room_type=room_type)

@mcp.tool()
async def get_time_slots() -> List[Dict[str, Any]]:
    """Retrieve all active corporate time slots for desk and workspace booking.

    Returns:
        List of time slot objects with id, slot_name, start_time, end_time, and price.
    """
    return await api_client.get_time_slots()

@mcp.tool()
async def check_seat_availability(
    room_id: str,
    booking_date: str,
    time_slot_id: str
) -> Dict[str, Any]:
    """Check seat availability for a specific room on a given date and time slot.

    Args:
        room_id: UUID of the workspace room.
        booking_date: Booking date in 'YYYY-MM-DD' format (e.g. '2026-09-30').
        time_slot_id: UUID of the time slot.

    Returns:
        Dictionary containing total seats, available seats, occupied seats, and seat details.
    """
    seats = await api_client.check_seat_availability(
        room_id=room_id,
        booking_date=booking_date,
        time_slot_id=time_slot_id
    )
    available_seats = [s for s in seats if _seat_is_available(s)]
    occupied_seats = [s for s in seats if not _seat_is_available(s)]

    return {
        "room_id": room_id,
        "booking_date": booking_date,
        "time_slot_id": time_slot_id,
        "total_seats": len(seats),
        "available_count": len(available_seats),
        "occupied_count": len(occupied_seats),
        "available_seats": available_seats,
        "occupied_seats": occupied_seats
    }

@mcp.tool()
async def search_available_seats(
    booking_date: str,
    city_or_location: Optional[str] = None,
    branch_name: Optional[str] = None,
    time_slot_id: Optional[str] = None,
    seat_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Search and filter available workstation desks across rooms and campus locations.

    Args:
        booking_date: Target date in 'YYYY-MM-DD' format.
        city_or_location: Optional city or location filter (e.g. 'Bangalore', 'Hyderabad', 'London').
        branch_name: Optional branch name filter.
        time_slot_id: Optional specific time slot ID. If omitted, uses the first active slot.
        seat_type: Optional seat type filter (e.g. 'STANDARD', 'STANDING_DESK', 'WINDOW', 'FOCUS_POD').

    Returns:
        List of available seats with seat_number, room_name, branch_name, location_name, and IDs needed to book.
    """
    # 1. Resolve Location & Branch
    locs = await api_client.get_locations()
    target_loc_ids = [l["id"] for l in locs]
    if city_or_location:
        locs = [l for l in locs if city_or_location.lower() in l.get("name", "").lower() or city_or_location.lower() in l.get("city", "").lower()]
        target_loc_ids = [l["id"] for l in locs]

    branches = []
    for loc_id in target_loc_ids:
        b_list = await api_client.get_branches(location_id=loc_id)
        branches.extend(b_list)

    if branch_name:
        branches = [b for b in branches if branch_name.lower() in b.get("name", "").lower()]

    # 2. Get active time slot
    slots = await api_client.get_time_slots()
    active_slots = [s for s in slots if s.get("status") == "ACTIVE"]
    selected_slot = next((s for s in active_slots if s["id"] == time_slot_id), active_slots[0] if active_slots else None)

    if not selected_slot:
        return []

    slot_id = selected_slot["id"]
    slot_label = f"{selected_slot.get('start_time', '')[:5]} - {selected_slot.get('end_time', '')[:5]}"

    results = []
    # 3. Check workspace rooms in matched branches
    for br in branches:
        rooms = await api_client.get_rooms(branch_id=br["id"], room_type="WORKSPACE")
        for rm in rooms:
            try:
                seats = await api_client.check_seat_availability(room_id=rm["id"], booking_date=booking_date, time_slot_id=slot_id)
                available = [s for s in seats if _seat_is_available(s)]
                if seat_type:
                    available = [s for s in available if s.get("seat_type") == seat_type]

                for st in available:
                    results.append({
                        "seat_id": st["seat_id"],
                        "seat_number": st["seat_number"],
                        "seat_type": st.get("seat_type", "STANDARD"),
                        "price": float(st.get("price", rm.get("price_per_slot", 90.0))),
                        "room_id": rm["id"],
                        "room_name": rm["name"],
                        "branch_id": br["id"],
                        "branch_name": br["name"],
                        "location_id": br["location_id"],
                        "location_name": next((l["name"] for l in locs if l["id"] == br["location_id"]), "Hub"),
                        "booking_date": booking_date,
                        "time_slot_id": slot_id,
                        "time_slot_label": slot_label
                    })
            except Exception:
                continue

    return results

@mcp.tool()
async def book_seat(
    seat_id: str,
    room_id: str,
    branch_id: str,
    location_id: str,
    booking_date: str,
    time_slot_id: str,
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    """Book a workstation desk for an employee. Validates wallet balance and double-booking concurrency.

    Args:
        seat_id: UUID of the seat.
        room_id: UUID of the room containing the seat.
        branch_id: UUID of the campus branch.
        location_id: UUID of the location.
        booking_date: Booking date in 'YYYY-MM-DD' format.
        time_slot_id: UUID of the time slot.
        employee_email: Optional email of the requesting employee (must already be authenticated this session via authenticate_employee).
        auth_token: The employee's bearer token from authenticate_employee - required unless a default identity is explicitly enabled for local testing.

    Returns:
        Booking confirmation details including booking ID, confirmed status, amount charged, and reservation summary.
    """
    return await api_client.book_seat(
        location_id=location_id,
        branch_id=branch_id,
        room_id=room_id,
        seat_id=seat_id,
        booking_date=booking_date,
        time_slot_id=time_slot_id,
        employee_email=employee_email,
        auth_token=auth_token
    )

@mcp.tool()
async def get_my_bookings(
    status: Optional[str] = None,
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve all active, upcoming, and past reservations for the authenticated employee.

    Args:
        status: Optional status filter: 'CONFIRMED', 'PENDING', 'CANCELLED', 'COMPLETED'.
        employee_email: Optional email of the requesting employee.
        auth_token: Optional JWT bearer token.

    Returns:
        List of bookings with booking ID, date, workspace/room name, branch, amount, and status.
    """
    bookings = await api_client.get_my_bookings(employee_email=employee_email, auth_token=auth_token)
    if status:
        bookings = [b for b in bookings if b.get("status") == status]
    return bookings

@mcp.tool()
async def cancel_my_booking(
    booking_id: str,
    cancellation_reason: Optional[str] = "Cancelled via AI Assistant",
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    """Cancel an existing reservation and trigger an automatic wallet refund if within the cancellation policy window.

    Args:
        booking_id: UUID of the booking to cancel.
        cancellation_reason: Reason for cancellation.
        employee_email: Optional email of the requesting employee.
        auth_token: Optional JWT bearer token.

    Returns:
        Cancellation confirmation and refund status.
    """
    return await api_client.cancel_booking(
        booking_id=booking_id,
        reason=cancellation_reason,
        employee_email=employee_email,
        auth_token=auth_token
    )

@mcp.tool()
async def check_meeting_room_availability(
    booking_date: str,
    start_time: str,
    end_time: str,
    branch_id: Optional[str] = None,
    branch_name: Optional[str] = None,
    room_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Check availability of smart meeting rooms and conference halls for a given date and time window.

    Args:
        booking_date: Date in 'YYYY-MM-DD' format.
        start_time: Start time in 'HH:MM' format (e.g. '10:00').
        end_time: End time in 'HH:MM' format (e.g. '11:30').
        branch_id: Optional UUID of the branch.
        branch_name: Optional branch name.
        room_type: Optional filter: 'MEETING_ROOM' or 'CONFERENCE_ROOM'.

    Returns:
        List of meeting rooms with availability status, capacity, facilities, and calculated price.
    """
    target_branch_id = branch_id
    if not target_branch_id and branch_name:
        branches = await api_client.get_branches()
        matched = next((b for b in branches if branch_name.lower() in b.get("name", "").lower()), None)
        if matched:
            target_branch_id = matched["id"]

    if not target_branch_id:
        branches = await api_client.get_branches()
        if branches:
            target_branch_id = branches[0]["id"]
        else:
            return []

    return await api_client.check_room_availability(
        branch_id=target_branch_id,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        room_type=room_type
    )

@mcp.tool()
async def book_meeting_room(
    room_id: str,
    branch_id: str,
    location_id: str,
    booking_date: str,
    start_time: str,
    end_time: str,
    title: Optional[str] = "Team Collaboration Session",
    purpose: Optional[str] = "Workplace Meeting",
    participant_emails: Optional[List[str]] = None,
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    """Reserve a smart meeting room or conference hall.

    Args:
        room_id: UUID of the room.
        branch_id: UUID of the branch.
        location_id: UUID of the location.
        booking_date: Date in 'YYYY-MM-DD' format.
        start_time: Start time in 'HH:MM' format (e.g. '14:00').
        end_time: End time in 'HH:MM' format (e.g. '15:00').
        title: Meeting title.
        purpose: Meeting purpose.
        participant_emails: Optional list of attendee email addresses.
        employee_email: Optional email of the requesting employee.
        auth_token: Optional JWT bearer token.

    Returns:
        Booking confirmation details with reservation ID and amount charged.
    """
    return await api_client.book_meeting_room(
        location_id=location_id,
        branch_id=branch_id,
        room_id=room_id,
        booking_date=booking_date,
        start_time=start_time,
        end_time=end_time,
        title=title,
        purpose=purpose,
        participant_emails=participant_emails,
        employee_email=employee_email,
        auth_token=auth_token
    )

@mcp.tool()
async def get_day_passes(
    branch_id: Optional[str] = None,
    branch_name: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve available Day Pass packages and pricing for a campus branch.

    Args:
        branch_id: Optional UUID of the branch.
        branch_name: Optional name of the branch.

    Returns:
        List of Day Pass packages with pass ID, price, capacity, and included amenities.
    """
    target_branch_id = branch_id
    if not target_branch_id and branch_name:
        branches = await api_client.get_branches()
        matched = next((b for b in branches if branch_name.lower() in b.get("name", "").lower()), None)
        if matched:
            target_branch_id = matched["id"]

    return await api_client.get_day_passes(branch_id=target_branch_id)

@mcp.tool()
async def check_day_pass_availability(
    booking_date: str,
    branch_id: Optional[str] = None,
    branch_name: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Check Day Pass availability and capacity for a campus branch on a specific date.

    Args:
        booking_date: Date in 'YYYY-MM-DD' format.
        branch_id: Optional UUID of the branch.
        branch_name: Optional branch name.

    Returns:
        List of day passes with available capacity and pricing.
    """
    target_branch_id = branch_id
    if not target_branch_id and branch_name:
        branches = await api_client.get_branches()
        matched = next((b for b in branches if branch_name.lower() in b.get("name", "").lower()), None)
        if matched:
            target_branch_id = matched["id"]

    if not target_branch_id:
        branches = await api_client.get_branches()
        if branches:
            target_branch_id = branches[0]["id"]
        else:
            return []

    return await api_client.check_day_pass_availability(branch_id=target_branch_id, booking_date=booking_date)

@mcp.tool()
async def book_day_pass(
    day_pass_id: str,
    branch_id: str,
    location_id: str,
    booking_date: str,
    number_of_people: int = 1,
    additional_users: Optional[List[Dict[str, str]]] = None,
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    """Book a full-day flex pass for an employee or a group of attendees.

    Args:
        day_pass_id: UUID of the Day Pass package.
        branch_id: UUID of the campus branch.
        location_id: UUID of the location.
        booking_date: Date in 'YYYY-MM-DD' format.
        number_of_people: Number of people (default 1).
        additional_users: Optional list of additional guests [{"name": "Jane", "email": "jane@acme.com"}].
        employee_email: Optional email of the requesting employee.
        auth_token: Optional JWT bearer token.

    Returns:
        Booking confirmation details with amount charged and pass IDs.
    """
    return await api_client.book_day_pass(
        location_id=location_id,
        branch_id=branch_id,
        day_pass_id=day_pass_id,
        booking_date=booking_date,
        number_of_people=number_of_people,
        additional_users=additional_users,
        employee_email=employee_email,
        auth_token=auth_token
    )

@mcp.tool()
async def pre_register_visitor(
    branch_id: str,
    visitor_name: str,
    visitor_email: str,
    visitor_phone: Optional[str] = None,
    purpose: Optional[str] = "Client Meeting & Discussion",
    visit_date: Optional[str] = None,
    expected_arrival_time: Optional[str] = "10:00",
    notes: Optional[str] = None,
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    """Pre-register an external guest/client for campus entry and issue a digital gate pass.

    Args:
        branch_id: UUID of the campus branch where the guest is visiting.
        visitor_name: Full name of the visitor.
        visitor_email: Email address of the visitor.
        visitor_phone: Optional phone number.
        purpose: Reason for visit (e.g. 'Project Kickoff Meeting', 'Job Interview').
        visit_date: Visit date in 'YYYY-MM-DD' format.
        expected_arrival_time: Expected arrival time in 'HH:MM' format (e.g. '10:30').
        notes: Optional additional instructions for the front desk reception.
        employee_email: Optional host employee email.
        auth_token: Optional JWT bearer token.

    Returns:
        Visitor pass details including visitor pass ID, QR pass status, and registered schedule.
    """
    return await api_client.pre_register_visitor(
        branch_id=branch_id,
        visitor_name=visitor_name,
        visitor_email=visitor_email,
        visitor_phone=visitor_phone,
        purpose=purpose,
        visit_date=visit_date,
        expected_arrival_time=expected_arrival_time,
        notes=notes,
        employee_email=employee_email,
        auth_token=auth_token
    )

@mcp.tool()
async def get_my_visitors(
    status: Optional[str] = None,
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve pre-registered visitors and guest passes hosted by the authenticated employee.

    Args:
        status: Optional status filter: 'PENDING', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'.
        employee_email: Optional employee email.
        auth_token: Optional JWT bearer token.

    Returns:
        List of visitor passes with guest name, visit date, status, arrival time, and branch.
    """
    return await api_client.get_my_visitors(status=status, employee_email=employee_email, auth_token=auth_token)

@mcp.tool()
async def check_in_visitor(
    visitor_id: str,
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    """Mark a pre-registered visitor as checked in at the reception desk.

    Args:
        visitor_id: UUID of the visitor pass.
        employee_email: Optional employee email.
        auth_token: Optional JWT bearer token.

    Returns:
        Updated visitor status with check-in timestamp.
    """
    return await api_client.check_in_visitor(visitor_id=visitor_id, employee_email=employee_email, auth_token=auth_token)

@mcp.tool()
async def check_out_visitor(
    visitor_id: str,
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    """Mark a visitor visit as completed and check them out.

    Args:
        visitor_id: UUID of the visitor pass.
        employee_email: Optional employee email.
        auth_token: Optional JWT bearer token.

    Returns:
        Updated visitor status with check-out timestamp.
    """
    return await api_client.check_out_visitor(visitor_id=visitor_id, employee_email=employee_email, auth_token=auth_token)

@mcp.tool()
async def get_my_wallet_balance(
    employee_email: Optional[str] = None,
    auth_token: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieve the current corporate wallet balance and credit status for the authenticated employee.

    Args:
        employee_email: Optional email of the requesting employee.
        auth_token: Optional JWT bearer token.

    Returns:
        Dictionary with balance, user_id, and currency.
    """
    return await api_client.get_wallet_balance(employee_email=employee_email, auth_token=auth_token)

class BearerAuthMiddleware:
    """Rejects any HTTP request that lacks `Authorization: Bearer <MCP_AUTH_TOKEN>` (constant-time compare)."""

    def __init__(self, app, token: str):
        self.app = app
        self._token = token.encode("utf-8")

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            supplied = dict(scope["headers"]).get(b"authorization", b"")
            scheme, _, value = supplied.partition(b" ")
            if scheme.lower() != b"bearer" or not hmac.compare_digest(value.strip(), self._token):
                response = JSONResponse({"error": "unauthorized"}, status_code=401, headers={"WWW-Authenticate": "Bearer"})
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


def build_http_app():
    """Streamable-HTTP ASGI app, wrapped with bearer auth when MCP_AUTH_TOKEN is set.

    Refuses to start if trusted-caller mode is on without MCP auth: anyone reaching an
    unauthenticated port could otherwise act as any employee by naming their email.
    """
    if settings.WORKPILOT_SERVICE_TOKEN and not settings.MCP_AUTH_TOKEN:
        raise RuntimeError(
            "WORKPILOT_SERVICE_TOKEN is set but MCP_AUTH_TOKEN is not. Refusing to start an "
            "unauthenticated MCP endpoint that can act as any employee."
        )
    app = mcp.streamable_http_app()
    if settings.MCP_AUTH_TOKEN:
        app.add_middleware(BearerAuthMiddleware, token=settings.MCP_AUTH_TOKEN)
    return app


if __name__ == "__main__":
    # "stdio" (default): spawned as a local subprocess by a client like Claude
    # Desktop - see mcp_config.json. "streamable-http": runs as a standalone
    # network service on MCP_HOST:MCP_PORT for a separate application
    # (WorkPilot/Intuceo.Ai) to connect to over HTTP.
    if settings.MCP_TRANSPORT == "streamable-http":
        uvicorn.run(build_http_app(), host=settings.MCP_HOST, port=settings.MCP_PORT)
    else:
        mcp.run(transport=settings.MCP_TRANSPORT)
