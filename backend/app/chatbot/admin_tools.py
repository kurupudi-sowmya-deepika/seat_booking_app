"""Admin-only chatbot tools - the Admin AI Assistant's tool set.

Mirrors `ChatbotTools`' construction and conventions exactly (per-request `db`/
`current_user`, plain dict returns, docstrings required for LangChain's schema
generation) but is never exposed to a non-admin: `POST /api/chatbot/admin-message`
(the only route that builds this class) is gated with `Depends(get_current_admin)`,
so a non-admin never reaches this code at all - that FastAPI dependency is the real
authorization boundary, not anything checked inside these methods.

Read tools mirror the query logic already proven in the corresponding admin REST
route (list_rooms ~ GET /rooms/, search_all_bookings ~ GET /bookings/admin/all,
etc.) rather than reinventing it. Destructive tools never mutate directly - they
return the same `{"action": "REQUIRE_ADMIN_ACTION_CONFIRMATION", "payload": {...}}`
sentinel shape `ChatbotTools.confirm_intent_to_book` already established, and the
frontend's confirm button calls the real, already-admin-gated REST endpoint
(PUT/DELETE) directly - exactly the same "tool stages, UI executes after explicit
confirmation" pattern used everywhere else in this chatbot.
"""
from typing import List, Dict, Any, Optional
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from datetime import date, timedelta

from app.models.location import Location, Branch, Room, Seat, Facility, DayPass
from app.models.booking import Booking, BookingStatus
from app.models.wallet import Wallet
from app.models.user import User
from app.models.floor_plan import Floor, FloorLayoutItem, FloorLayoutItemType
from app.utils.geometry import aabb_overlap, rotated_aabb


class AdminChatbotTools:
    def __init__(self, db: AsyncSession, current_user: User):
        self.db = db
        self.current_user = current_user

    # ---------- Read tools ----------

    async def list_users(self, search: Optional[str] = None, role: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List employees/admins, optionally filtered by name/email search, role (ADMIN/USER), or status."""
        query = select(User)
        if search:
            query = query.where(or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
        if role:
            query = query.where(User.role == role)
        if status:
            query = query.where(User.status == status)
        users = (await self.db.execute(query.limit(30))).scalars().all()
        return [{"id": str(u.id), "name": u.name, "email": u.email, "role": u.role.value, "status": u.status.value} for u in users]

    async def search_all_bookings(self, booking_type: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Search bookings across ALL users (not just the admin's own) - by booking type, status, or a free-text search against user name/email/branch/location."""
        query = select(Booking).options(
            selectinload(Booking.user), selectinload(Booking.branch),
            selectinload(Booking.location), selectinload(Booking.room), selectinload(Booking.seat),
        )
        if booking_type:
            query = query.where(Booking.booking_type == booking_type)
        if status:
            query = query.where(Booking.status == status)
        if search:
            like = f"%{search}%"
            query = query.join(User, Booking.user_id == User.id).outerjoin(Branch, Booking.branch_id == Branch.id).where(
                or_(User.name.ilike(like), User.email.ilike(like), Branch.name.ilike(like))
            )
        query = query.order_by(Booking.created_at.desc()).limit(limit)
        bookings = (await self.db.execute(query)).scalars().all()
        return [{
            "booking_id": str(b.id), "user_name": b.user.name if b.user else None, "user_email": b.user.email if b.user else None,
            "booking_type": b.booking_type.value, "status": b.status.value, "booking_date": str(b.booking_date),
            "start_time": str(b.start_time) if b.start_time else None, "end_time": str(b.end_time) if b.end_time else None,
            "branch": b.branch.name if b.branch else None, "location": b.location.name if b.location else None,
            "resource": (b.room.name if b.room else None) or (b.seat.seat_number if b.seat else None),
            "amount": float(b.amount),
        } for b in bookings]

    async def list_locations(self) -> List[Dict[str, Any]]:
        """List every office location (any status), for admin oversight."""
        locations = (await self.db.execute(select(Location))).scalars().all()
        return [{"id": str(l.id), "name": l.name, "city": l.city, "status": l.status} for l in locations]

    async def list_branches(self, location_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List every branch (any status), optionally filtered by location/city name."""
        query = select(Branch).options(selectinload(Branch.location))
        branches = (await self.db.execute(query)).scalars().all()
        if location_name:
            key = location_name.strip().lower()
            branches = [b for b in branches if b.location and (key in b.location.name.lower() or key in b.location.city.lower())]
        return [{"id": str(b.id), "name": b.name, "location": b.location.name if b.location else None, "status": b.status} for b in branches]

    async def list_rooms(self, branch_name: Optional[str] = None, room_type: Optional[str] = None, min_capacity: Optional[int] = None) -> List[Dict[str, Any]]:
        """List rooms (any status) across the whole app, optionally filtered by branch name, room_type (WORKSPACE/MEETING_ROOM/CONFERENCE_ROOM), and/or a minimum capacity (e.g. "rooms with capacity greater than 8" -> min_capacity=9)."""
        query = select(Room).options(selectinload(Room.branch), selectinload(Room.facilities))
        if room_type:
            query = query.where(Room.room_type == room_type)
        if min_capacity is not None:
            query = query.where(Room.capacity >= min_capacity)
        rooms = (await self.db.execute(query)).scalars().all()
        if branch_name:
            key = branch_name.strip().lower()
            rooms = [r for r in rooms if r.branch and key in r.branch.name.lower()]
        return [{
            "room_id": str(r.id), "name": r.name, "room_type": r.room_type, "capacity": r.capacity,
            "floor": r.floor, "status": r.status, "branch": r.branch.name if r.branch else None,
            "facilities": [f.name for f in r.facilities] if r.facilities else [],
        } for r in rooms]

    async def list_floors(self, branch_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """List floors (any status) across the whole app, optionally filtered by branch/building name."""
        floors = (await self.db.execute(select(Floor).options(selectinload(Floor.branch)))).scalars().all()
        if branch_name:
            key = branch_name.strip().lower()
            floors = [f for f in floors if f.branch and key in f.branch.name.lower()]
        return [{
            "id": str(f.id), "name": f.name, "floor_number": f.floor_number, "status": f.status,
            "branch": f.branch.name if f.branch else None,
            "published": f.published_at is not None, "has_unpublished_changes": f.has_draft_changes,
        } for f in floors]

    async def get_floor_seat_availability(self, floor_name: str, branch_name: Optional[str] = None) -> Dict[str, Any]:
        """Real-time seat counts for one PUBLISHED floor (what employees actually see) - total seats, available now, booked today, and disabled/under maintenance. Find the floor by name, optionally scoped to a branch."""
        floor = await self._find_floor(floor_name, branch_name)
        if not floor:
            return {"error": f"Floor '{floor_name}' not found."}

        items = (await self.db.execute(select(FloorLayoutItem).where(
            FloorLayoutItem.floor_id == floor.id, FloorLayoutItem.is_draft == False,  # noqa: E712
            FloorLayoutItem.item_type == FloorLayoutItemType.SEAT,
        ))).scalars().all()
        seat_ids = [i.seat_id for i in items if i.seat_id]
        if not seat_ids:
            return {"floor": floor.name, "total_seats": 0, "available": 0, "booked_today": 0, "disabled_or_maintenance": 0}

        seats = (await self.db.execute(select(Seat).where(Seat.id.in_(seat_ids)))).scalars().all()
        disabled = sum(1 for s in seats if s.status in ("DISABLED", "MAINTENANCE"))
        booked_today = (await self.db.execute(select(func.count(func.distinct(Booking.seat_id))).where(
            Booking.seat_id.in_(seat_ids), Booking.booking_date == date.today(),
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        ))).scalar_one()
        return {
            "floor": floor.name, "total_seats": len(seats),
            "available": max(0, len(seats) - disabled - booked_today),
            "booked_today": booked_today, "disabled_or_maintenance": disabled,
        }

    async def list_seats(self, branch_name: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List seats/desks (any status), optionally filtered by branch name and/or status."""
        query = select(Seat).options(selectinload(Seat.room).selectinload(Room.branch))
        if status:
            query = query.where(Seat.status == status)
        seats = (await self.db.execute(query.limit(50))).scalars().all()
        if branch_name:
            key = branch_name.strip().lower()
            seats = [s for s in seats if s.room and s.room.branch and key in s.room.branch.name.lower()]
        return [{
            "seat_id": str(s.id), "seat_number": s.seat_number, "seat_type": s.seat_type, "status": s.status,
            "room": s.room.name if s.room else None, "branch": s.room.branch.name if s.room and s.room.branch else None,
        } for s in seats]

    async def list_facilities(self) -> List[Dict[str, Any]]:
        """List every facility/amenity in the shared library, with its category."""
        facilities = (await self.db.execute(select(Facility))).scalars().all()
        return [{"id": str(f.id), "name": f.name, "category": f.category} for f in facilities]

    async def list_time_slots(self) -> List[Dict[str, Any]]:
        """List every configured seat-booking time slot (any status)."""
        from app.models.booking import TimeSlot
        slots = (await self.db.execute(select(TimeSlot))).scalars().all()
        return [{"id": str(s.id), "start_time": str(s.start_time), "end_time": str(s.end_time), "status": s.status} for s in slots]

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Overall workspace stats: user/location/branch/room/seat counts, total & today's bookings, total revenue, wallet credits in circulation, today's seat occupancy rate."""
        today = date.today()
        total_users = (await self.db.execute(select(func.count(User.id)))).scalar_one()
        total_locations = (await self.db.execute(select(func.count(Location.id)))).scalar_one()
        total_branches = (await self.db.execute(select(func.count(Branch.id)))).scalar_one()
        total_rooms = (await self.db.execute(select(func.count(Room.id)))).scalar_one()
        total_seats = (await self.db.execute(select(func.count(Seat.id)))).scalar_one()
        total_bookings = (await self.db.execute(select(func.count(Booking.id)))).scalar_one()
        today_bookings = (await self.db.execute(select(func.count(Booking.id)).where(Booking.booking_date == today))).scalar_one()
        total_revenue = float((await self.db.execute(
            select(func.sum(Booking.amount)).where(Booking.status == BookingStatus.CONFIRMED)
        )).scalar_one() or 0.0)
        total_wallet_credits = float((await self.db.execute(select(func.sum(Wallet.balance)))).scalar_one() or 0.0)
        today_seat_bookings = (await self.db.execute(select(func.count(Booking.id)).where(
            and_(Booking.booking_date == today, Booking.seat_id.isnot(None), Booking.status == BookingStatus.CONFIRMED)
        ))).scalar_one()
        occupancy_rate = round((today_seat_bookings / max(1, total_seats)) * 100, 1)
        return {
            "total_users": total_users, "total_locations": total_locations, "total_branches": total_branches,
            "total_rooms": total_rooms, "total_seats": total_seats, "total_bookings": total_bookings,
            "today_bookings": today_bookings, "total_revenue": round(total_revenue, 2),
            "total_wallet_credits_in_circulation": round(total_wallet_credits, 2),
            "today_seat_occupancy_rate_percent": occupancy_rate,
        }

    async def get_revenue_report(self, days: int = 30, branch_name: Optional[str] = None) -> Dict[str, Any]:
        """Revenue report for the last N days (default 30), optionally scoped to one branch by name."""
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        query = select(Booking).options(selectinload(Booking.branch)).where(
            and_(Booking.booking_date >= start_date, Booking.booking_date <= end_date, Booking.status == BookingStatus.CONFIRMED)
        )
        bookings = (await self.db.execute(query)).scalars().all()
        if branch_name:
            key = branch_name.strip().lower()
            bookings = [b for b in bookings if b.branch and key in b.branch.name.lower()]
        total_revenue = sum(float(b.amount) for b in bookings)
        by_type: Dict[str, Dict[str, Any]] = {}
        for b in bookings:
            t = b.booking_type.value
            by_type.setdefault(t, {"count": 0, "revenue": 0.0})
            by_type[t]["count"] += 1
            by_type[t]["revenue"] += float(b.amount)
        return {
            "start_date": str(start_date), "end_date": str(end_date),
            "total_revenue": round(total_revenue, 2), "total_confirmed_bookings": len(bookings),
            "breakdown_by_type": by_type,
        }

    # ---------- Confirmation-gated destructive tools ----------
    # None of these mutate anything - they return a REQUIRE_ADMIN_ACTION_CONFIRMATION
    # sentinel with enough of the affected record's current state for the confirmation
    # card to show "you are about to..."; the frontend's Confirm button then calls the
    # real, already-admin-gated REST endpoint directly.

    async def stage_cancel_booking(self, booking_id: str) -> Dict[str, Any]:
        """Stage cancelling ANY user's booking by its booking ID (not just the admin's own) - requires the admin's explicit confirmation before it actually cancels."""
        booking = (await self.db.execute(
            select(Booking).options(selectinload(Booking.user), selectinload(Booking.branch)).where(Booking.id == booking_id)
        )).scalar_one_or_none()
        if not booking:
            return {"error": f"Booking {booking_id} not found."}
        return {"action": "REQUIRE_ADMIN_ACTION_CONFIRMATION", "payload": {
            "operation": "cancel_booking", "booking_id": str(booking.id),
            "summary": f"Cancel {booking.booking_type.value} booking for {booking.user.name if booking.user else 'unknown user'} "
                       f"on {booking.booking_date} at {booking.branch.name if booking.branch else 'unknown branch'} (₹{float(booking.amount)}).",
        }}

    async def stage_deactivate_seat(self, seat_number: str, branch_name: str) -> Dict[str, Any]:
        """Stage disabling one seat by its seat number and branch name - requires the admin's explicit confirmation before it actually disables the seat."""
        branch = await self._find_branch_for_admin(branch_name)
        if not branch:
            return {"error": f"Branch '{branch_name}' not found."}
        seat = (await self.db.execute(
            select(Seat).join(Room, Seat.room_id == Room.id).where(Seat.seat_number == seat_number, Room.branch_id == branch.id)
        )).scalar_one_or_none()
        if not seat:
            return {"error": f"Seat '{seat_number}' not found in branch '{branch.name}'."}
        return {"action": "REQUIRE_ADMIN_ACTION_CONFIRMATION", "payload": {
            "operation": "deactivate_seat", "seat_id": str(seat.id),
            # Full current fields, not just the changed status - SeatUpdate inherits
            # SeatBase's required room_id/seat_number/price even on a partial PUT.
            "seat_fields": {
                "room_id": str(seat.room_id), "seat_number": seat.seat_number, "seat_type": seat.seat_type,
                "description": seat.description, "price": float(seat.price), "status": "DISABLED",
            },
            "summary": f"Disable seat {seat.seat_number} in branch {branch.name}.",
        }}

    async def stage_deactivate_room(self, room_name: str) -> Dict[str, Any]:
        """Stage deactivating one room by name - requires the admin's explicit confirmation before it actually deactivates the room."""
        room = (await self.db.execute(select(Room).where(Room.name.ilike(f"%{room_name}%")))).scalars().first()
        if not room:
            return {"error": f"Room '{room_name}' not found."}
        return {"action": "REQUIRE_ADMIN_ACTION_CONFIRMATION", "payload": {
            "operation": "deactivate_room", "room_id": str(room.id),
            "room_fields": {
                "name": room.name, "description": room.description, "room_type": room.room_type,
                "capacity": room.capacity, "floor": room.floor, "room_number": room.room_number,
                "price_per_hour": float(room.price_per_hour) if room.price_per_hour is not None else None,
                "status": "INACTIVE",
            },
            "summary": f"Deactivate room {room.name} ({room.room_type}).",
        }}

    async def stage_delete_branch(self, branch_name: str) -> Dict[str, Any]:
        """Stage permanently deleting a branch by name - requires the admin's explicit confirmation before it actually deletes it. This cannot be undone."""
        branch = await self._find_branch_for_admin(branch_name)
        if not branch:
            return {"error": f"Branch '{branch_name}' not found."}
        room_count = (await self.db.execute(select(func.count(Room.id)).where(Room.branch_id == branch.id))).scalar_one()
        return {"action": "REQUIRE_ADMIN_ACTION_CONFIRMATION", "payload": {
            "operation": "delete_branch", "branch_id": str(branch.id),
            "summary": f"Permanently delete branch '{branch.name}' and all {room_count} of its rooms. This cannot be undone.",
        }}

    async def stage_create_floor(self, branch_name: str, floor_name: str, floor_number: Optional[int] = None) -> Dict[str, Any]:
        """Stage creating a new, empty floor for a branch/building - requires the admin's explicit confirmation. Safe and reversible: an empty floor has no bookable resources until the admin adds and publishes them."""
        branch = await self._find_branch_for_admin(branch_name)
        if not branch:
            return {"error": f"Branch '{branch_name}' not found."}
        return {"action": "REQUIRE_ADMIN_ACTION_CONFIRMATION", "payload": {
            "operation": "create_floor",
            "floor_fields": {
                "branch_id": str(branch.id), "name": floor_name,
                "floor_number": floor_number if floor_number is not None else 0,
                "canvas_width": 1200, "canvas_height": 800,
            },
            "summary": f"Create a new floor '{floor_name}' in {branch.name}.",
        }}

    async def stage_add_desks_to_floor(self, floor_name: str, count: int, branch_name: Optional[str] = None) -> Dict[str, Any]:
        """Stage adding `count` new desks/seats to a floor's current DRAFT layout, auto-placed inside its default workspace room without overlapping anything already there - requires the admin's explicit confirmation. Only touches the draft; the admin must still Save and Publish for the desks to become bookable."""
        floor = await self._find_floor(floor_name, branch_name)
        if not floor:
            return {"error": f"Floor '{floor_name}' not found."}
        if count <= 0 or count > 100:
            return {"error": "count must be between 1 and 100."}

        draft_items = (await self.db.execute(select(FloorLayoutItem).where(
            FloorLayoutItem.floor_id == floor.id, FloorLayoutItem.is_draft == True,  # noqa: E712
        ))).scalars().all()

        workspace_room = next(
            (i for i in draft_items if i.item_type == FloorLayoutItemType.ROOM and (i.properties or {}).get("is_default_workspace")),
            None,
        ) or next((i for i in draft_items if i.item_type == FloorLayoutItemType.ROOM), None)
        if not workspace_room:
            return {"error": f"Floor '{floor.name}' has no room to add desks into yet - create one first (e.g. add a seat manually once to auto-create the default workspace)."}

        existing_numbers = {
            str((i.properties or {}).get("seat_number", "")).strip().upper()
            for i in draft_items if i.item_type == FloorLayoutItemType.SEAT
        }
        occupied_aabbs = [
            rotated_aabb(i.x, i.y, i.width, i.height, i.rotation or 0)
            for i in draft_items if i.item_type in (FloorLayoutItemType.SEAT, FloorLayoutItemType.ROOM, FloorLayoutItemType.WALL)
            and i.id != workspace_room.id
        ]
        room_bounds = (workspace_room.x, workspace_room.y, workspace_room.x + workspace_room.width, workspace_room.y + workspace_room.height)

        seat_size, gap = 40.0, 10.0
        per_row = max(1, int((room_bounds[2] - room_bounds[0] - gap) // (seat_size + gap)))
        new_items: List[Dict[str, Any]] = []
        next_num, row, col, attempts = 1, 0, 0, 0

        while len(new_items) < count and attempts < count * 20 and (room_bounds[1] + gap + row * (seat_size + gap) + seat_size) <= room_bounds[3] - gap:
            attempts += 1
            x = room_bounds[0] + gap + col * (seat_size + gap)
            y = room_bounds[1] + gap + row * (seat_size + gap)
            col = (col + 1) % per_row
            if col == 0:
                row += 1
            candidate = (x, y, x + seat_size, y + seat_size)
            if any(aabb_overlap(candidate, other) for other in occupied_aabbs):
                continue
            while f"D{next_num:02d}" in existing_numbers:
                next_num += 1
            seat_number = f"D{next_num:02d}"
            existing_numbers.add(seat_number)
            new_items.append({
                "id": str(uuid4()), "item_type": "SEAT", "parent_item_id": str(workspace_room.id),
                "x": x, "y": y, "width": seat_size, "height": seat_size, "rotation": 0, "shape": "SQUARE", "z_index": 1,
                "properties": {"seat_number": seat_number, "seat_type": "STANDARD", "status": "AVAILABLE", "price": 100},
            })
            occupied_aabbs.append(candidate)

        if not new_items:
            return {"error": f"No room left in '{workspace_room.label or 'the workspace'}' on floor '{floor.name}' to fit any new desks."}

        shortfall_note = f" (only {len(new_items)} of {count} fit - the workspace area is full)" if len(new_items) < count else ""
        return {"action": "REQUIRE_ADMIN_ACTION_CONFIRMATION", "payload": {
            "operation": "add_desks_to_floor", "floor_id": str(floor.id), "new_items": new_items,
            "summary": f"Add {len(new_items)} new desk(s) to '{floor.name}'{shortfall_note}. Saves to the draft only - publish separately to make them bookable.",
        }}

    async def stage_move_room_to_zone(self, room_name: str, zone_name: str, floor_name: Optional[str] = None) -> Dict[str, Any]:
        """Stage reassigning an existing room (in its floor's current draft) to a different zone by name - requires the admin's explicit confirmation. Only touches the draft; publish separately."""
        query = select(FloorLayoutItem).where(FloorLayoutItem.item_type == FloorLayoutItemType.ROOM, FloorLayoutItem.is_draft == True)  # noqa: E712
        if floor_name:
            floor = await self._find_floor(floor_name)
            if not floor:
                return {"error": f"Floor '{floor_name}' not found."}
            query = query.where(FloorLayoutItem.floor_id == floor.id)
        rooms = (await self.db.execute(query)).scalars().all()
        key = room_name.strip().lower()
        room = next((r for r in rooms if key in (r.label or (r.properties or {}).get("name") or "").strip().lower()), None)
        if not room:
            return {"error": f"Room '{room_name}' not found in any floor's current draft."}

        zones = (await self.db.execute(select(FloorLayoutItem).where(
            FloorLayoutItem.floor_id == room.floor_id, FloorLayoutItem.item_type == FloorLayoutItemType.ZONE,
            FloorLayoutItem.is_draft == True,  # noqa: E712
        ))).scalars().all()
        zone_key = zone_name.strip().lower()
        zone = next((z for z in zones if zone_key in (z.label or "").strip().lower()), None)
        if not zone:
            return {"error": f"Zone '{zone_name}' not found on that room's floor draft."}

        return {"action": "REQUIRE_ADMIN_ACTION_CONFIRMATION", "payload": {
            "operation": "move_room_to_zone", "floor_id": str(room.floor_id),
            "item_id": str(room.id), "zone_item_id": str(zone.id),
            "summary": f"Move room '{room.label}' into zone '{zone.label}'.",
        }}

    async def _find_floor(self, floor_name: str, branch_name: Optional[str] = None) -> Optional[Floor]:
        """Case-insensitive, partial-match floor lookup, optionally scoped to a branch -
        same ambiguity handling as _find_branch_for_admin."""
        floors = (await self.db.execute(select(Floor).options(selectinload(Floor.branch)))).scalars().all()
        if branch_name:
            key = branch_name.strip().lower()
            floors = [f for f in floors if f.branch and key in f.branch.name.lower()]
        if not floors:
            return None
        name_key = floor_name.strip().lower()
        exact = next((f for f in floors if f.name.strip().lower() == name_key), None)
        if exact:
            return exact
        return next((f for f in floors if name_key in f.name.strip().lower()), None)

    async def _find_branch_for_admin(self, branch_name: str):
        """Like ChatbotTools._find_branch but not status-restricted - an admin must
        be able to find an already-INACTIVE branch/room to manage it."""
        result = await self.db.execute(select(Branch).where(Branch.name.ilike(f"%{branch_name}%")))
        branches = result.scalars().all()
        if not branches:
            return None
        exact = next((b for b in branches if b.name.strip().lower() == branch_name.strip().lower()), None)
        return exact or branches[0]
