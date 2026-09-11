from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import date, datetime, time, timedelta
import math

from app.models.location import Location, Branch, Room, Seat, Facility, DayPass
from app.models.booking import Booking, TimeSlot, BookingStatus, BookingType
from app.models.wallet import Wallet, CreditTransaction
from app.models.user import User

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class ChatbotTools:
    def __init__(self, db: AsyncSession, current_user: User):
        self.db = db
        self.current_user = current_user

    async def _find_branch(self, branch_name: str) -> Optional[Branch]:
        """Find an active branch by partial, case-insensitive name. A plain
        `scalar_one_or_none()` here would raise MultipleResultsFound (and crash the
        whole chat turn) whenever the pattern matches more than one branch - instead
        prefer an exact name match if present, else the first partial match."""
        result = await self.db.execute(
            select(Branch).where(Branch.name.ilike(f"%{branch_name}%"), Branch.status == "ACTIVE")
        )
        branches = result.scalars().all()
        if not branches:
            return None
        exact = next((b for b in branches if b.name.strip().lower() == branch_name.strip().lower()), None)
        return exact or branches[0]

    async def _find_room_by_name(self, room_name: str) -> Optional[Room]:
        """Find an active room by partial, case-insensitive name. Same ambiguity
        handling as _find_branch, for the same reason."""
        result = await self.db.execute(
            select(Room).where(Room.name.ilike(f"%{room_name}%"), Room.status == "ACTIVE")
        )
        rooms = result.scalars().all()
        if not rooms:
            return None
        exact = next((r for r in rooms if r.name.strip().lower() == room_name.strip().lower()), None)
        return exact or rooms[0]

    async def search_locations(self) -> List[Dict[str, Any]]:
        """Search for all available office locations/cities."""
        result = await self.db.execute(select(Location).where(Location.status == "ACTIVE"))
        locations = result.scalars().all()
        return [{"id": str(l.id), "name": l.name, "city": l.city, "address": l.address} for l in locations]

    async def get_location_details(self, location_name: str) -> Dict[str, Any]:
        """Get full details (address, city, state, country, branch count) for one office location by name or city."""
        result = await self.db.execute(
            select(Location).where(
                (Location.name.ilike(f"%{location_name}%") | Location.city.ilike(f"%{location_name}%")),
                Location.status == "ACTIVE"
            )
        )
        locations = result.scalars().all()
        if not locations:
            return {"error": f"No location matching '{location_name}' was found."}
        location = next((l for l in locations if l.name.strip().lower() == location_name.strip().lower()), locations[0])

        branch_count = (await self.db.execute(
            select(func.count(Branch.id)).where(Branch.location_id == location.id, Branch.status == "ACTIVE")
        )).scalar_one()

        return {
            "id": str(location.id),
            "name": location.name,
            "address": location.address,
            "city": location.city,
            "state": location.state,
            "country": location.country,
            "postal_code": location.postal_code,
            "active_branch_count": branch_count
        }

    async def get_branch_details(self, branch_name: str) -> Dict[str, Any]:
        """Get full details (address, hours, 24x7 status, location) for one branch by name."""
        branch = await self._find_branch(branch_name)
        if not branch:
            return {"error": f"Branch {branch_name} not found."}

        location = (await self.db.execute(select(Location).where(Location.id == branch.location_id))).scalar_one_or_none()
        room_count = (await self.db.execute(
            select(func.count(Room.id)).where(Room.branch_id == branch.id, Room.status == "ACTIVE")
        )).scalar_one()

        return {
            "id": str(branch.id),
            "name": branch.name,
            "address": branch.address,
            "description": branch.description,
            "location_name": location.name if location else None,
            "city": location.city if location else None,
            "opening_time": str(branch.opening_time)[:5] if branch.opening_time else "08:00",
            "closing_time": str(branch.closing_time)[:5] if branch.closing_time else "20:00",
            "is_24x7": branch.is_24x7,
            "active_room_count": room_count
        }

    async def get_nearest_location(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """Find the nearest office location using coordinates."""
        result = await self.db.execute(select(Location).where(Location.status == "ACTIVE"))
        locations = result.scalars().all()
        if not locations:
            return {"error": "No locations configured."}
        nearest = None
        min_d = float("inf")
        for l in locations:
            if l.latitude and l.longitude:
                d = haversine_distance(latitude, longitude, l.latitude, l.longitude)
                if d < min_d:
                    min_d = d
                    nearest = l
        if not nearest:
            nearest = locations[0]
            min_d = 0.0
        return {"id": str(nearest.id), "name": nearest.name, "city": nearest.city, "distance_km": round(min_d, 2)}

    async def search_branches(self, location_name: str) -> List[Dict[str, Any]]:
        """Search for branches within a specific location name/city, OR by a branch name directly."""
        if not location_name or not location_name.strip():
            return [{"error": "Please provide a location, city, or branch name to search."}]

        result = await self.db.execute(
            select(Location).where(Location.name.ilike(f"%{location_name}%") | Location.city.ilike(f"%{location_name}%"))
        )
        locations = result.scalars().all()

        if locations:
            location_ids = [l.id for l in locations]
            b_result = await self.db.execute(
                select(Branch).where(Branch.location_id.in_(location_ids), Branch.status == "ACTIVE")
            )
            branches = b_result.scalars().all()
        else:
            # Fall back to matching the branch name directly (e.g. "Whitefield" is a
            # branch, not a location/city) rather than reporting a false negative.
            b_result = await self.db.execute(
                select(Branch).where(Branch.name.ilike(f"%{location_name}%"), Branch.status == "ACTIVE")
            )
            branches = b_result.scalars().all()

        if not branches:
            return [{"error": f"No location or branch matching '{location_name}' was found."}]
        return [{
            "id": str(b.id), 
            "name": b.name, 
            "address": b.address,
            "opening_time": str(b.opening_time) if b.opening_time else "08:00",
            "closing_time": str(b.closing_time) if b.closing_time else "20:00",
            "is_24x7": b.is_24x7
        } for b in branches]

    async def search_rooms(self, branch_name: str, room_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for available rooms in a specific branch, optionally filtered by room_type (WORKSPACE, MEETING_ROOM, CONFERENCE_ROOM)."""
        branch = await self._find_branch(branch_name)
        if not branch:
            return [{"error": f"Branch {branch_name} not found."}]

        query = select(Room).options(selectinload(Room.facilities)).where(Room.branch_id == branch.id, Room.status == "ACTIVE")
        if room_type:
            query = query.where(Room.room_type == room_type)
        r_result = await self.db.execute(query)
        rooms = r_result.scalars().all()
        return [{
            "id": str(r.id), 
            "name": r.name, 
            "room_type": r.room_type,
            "capacity": r.capacity, 
            "price_per_hour": float(r.price_per_hour or 0),
            "facilities": [f.name for f in r.facilities]
        } for r in rooms]

    async def get_time_slots(self) -> List[Dict[str, Any]]:
        """Get all available time slots for workspace seats."""
        result = await self.db.execute(select(TimeSlot).where(TimeSlot.status == "ACTIVE"))
        slots = result.scalars().all()
        return [{"id": str(s.id), "start": str(s.start_time)[:5], "end": str(s.end_time)[:5]} for s in slots]

    async def check_availability(self, room_name: str, booking_date: str, start_time_str: str) -> Dict[str, Any]:
        """
        Check available seats for a specific workspace room, date (YYYY-MM-DD), and start time (e.g. '09:00' or '10:00').
        """
        room = await self._find_room_by_name(room_name)
        if not room:
            return {"error": f"Room {room_name} not found."}

        t_result = await self.db.execute(select(TimeSlot))
        slots = t_result.scalars().all()
        target_slot = None
        for s in slots:
            if str(s.start_time).startswith(start_time_str[:5]):
                target_slot = s
                break
                
        if not target_slot:
            return {"error": f"Time slot starting around {start_time_str} not found."}

        s_result = await self.db.execute(select(Seat).where(Seat.room_id == room.id, Seat.status == "ACTIVE"))
        seats = s_result.scalars().all()
        
        try:
            b_date = datetime.strptime(booking_date, "%Y-%m-%d").date()
        except Exception:
            return {"error": "Invalid date format. Please use YYYY-MM-DD."}

        bookings_result = await self.db.execute(
            select(Booking).where(
                and_(
                    Booking.seat_id.in_([s.id for s in seats]),
                    Booking.booking_date == b_date,
                    Booking.time_slot_id == target_slot.id,
                    Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
                )
            )
        )
        booked_seat_ids = {b.seat_id for b in bookings_result.scalars().all()}
        
        available = []
        for s in seats:
            if s.id not in booked_seat_ids:
                available.append({"id": str(s.id), "seat_number": s.seat_number, "seat_type": s.seat_type, "price": float(s.price)})
                
        return {
            "room_id": str(room.id),
            "room_name": room.name,
            "time_slot_id": str(target_slot.id),
            "time_slot": f"{str(target_slot.start_time)[:5]} - {str(target_slot.end_time)[:5]}",
            "date": booking_date,
            "available_seats": available
        }

    async def get_day_pass_availability(self, branch_name: str, booking_date: str) -> Dict[str, Any]:
        """Check Day Pass pricing and availability for a branch on a given date (YYYY-MM-DD)."""
        branch = await self._find_branch(branch_name)
        if not branch:
            return {"error": f"Branch {branch_name} not found."}

        dp_result = await self.db.execute(select(DayPass).where(DayPass.branch_id == branch.id, DayPass.status == "ACTIVE"))
        dp = dp_result.scalars().first()
        if not dp:
            return {"error": f"No active day pass configured for {branch.name}."}
            
        try:
            b_date = datetime.strptime(booking_date, "%Y-%m-%d").date()
        except Exception:
            return {"error": "Invalid date format. Please use YYYY-MM-DD."}
            
        count_res = await self.db.execute(
            select(func.count(Booking.id)).where(
                and_(Booking.day_pass_id == dp.id, Booking.booking_date == b_date, Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]))
            )
        )
        booked = count_res.scalar_one()
        remaining = max(0, dp.daily_capacity - booked)
        
        return {
            "day_pass_id": str(dp.id),
            "name": dp.name,
            "branch": branch.name,
            "date": booking_date,
            "price": float(dp.price),
            "available_capacity": remaining,
            "status": "AVAILABLE" if remaining > 0 else "SOLD_OUT"
        }

    async def _find_available_rooms(
        self,
        branch_id,
        room_type: str,
        b_date: date,
        t_start: time,
        t_end: time,
        capacity: Optional[int] = None,
        amenities: Optional[List[str]] = None,
        exclude_booking_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Deterministic room search: only returns rooms that actually satisfy
        capacity and amenity requirements and have no overlapping booking. This
        is used for every room search/availability tool so the model can never
        present a room that doesn't meet the user's stated requirements."""
        query = select(Room).options(selectinload(Room.facilities)).where(
            Room.branch_id == branch_id,
            Room.room_type == room_type,
            Room.status == "ACTIVE"
        )
        if capacity:
            query = query.where(Room.capacity >= capacity)
        rooms = (await self.db.execute(query)).scalars().all()

        wanted_amenities = {a.lower() for a in amenities} if amenities else set()
        duration_hrs = (t_end.hour - t_start.hour) + (t_end.minute - t_start.minute) / 60.0

        available = []
        for r in rooms:
            facility_names = {f.name.lower() for f in r.facilities} if r.facilities else set()
            if wanted_amenities and not wanted_amenities.issubset(facility_names):
                continue

            overlap_conditions = [
                Booking.room_id == r.id,
                Booking.booking_date == b_date,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                Booking.start_time < t_end,
                Booking.end_time > t_start
            ]
            if exclude_booking_id:
                overlap_conditions.append(Booking.id != exclude_booking_id)
            overlap = await self.db.execute(select(Booking).where(and_(*overlap_conditions)))
            if overlap.scalars().first():
                continue

            available.append({
                "room_id": str(r.id),
                "name": r.name,
                "capacity": r.capacity,
                "price_per_hour": float(r.price_per_hour or 0),
                "estimated_total": float(r.price_per_hour or 0) * duration_hrs,
                "facilities": [f.name for f in r.facilities] if r.facilities else []
            })
        return available

    async def get_meeting_or_conference_rooms(
        self,
        branch_name: str,
        room_type: str,
        booking_date: str,
        start_time_str: str,
        end_time_str: str,
        capacity: Optional[int] = None,
        amenities: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Check meeting or conference room availability for a given time range.
        Only rooms that seat at least `capacity` people AND have every amenity in
        `amenities` (e.g. ["Video Conferencing"]) are returned - never present a
        room to the user that doesn't meet these requirements.
        """
        branch = await self._find_branch(branch_name)
        if not branch:
            return {"error": f"Branch {branch_name} not found."}

        try:
            b_date = datetime.strptime(booking_date, "%Y-%m-%d").date()
            t_start = datetime.strptime(start_time_str[:5], "%H:%M").time()
            t_end = datetime.strptime(end_time_str[:5], "%H:%M").time()
        except Exception:
            return {"error": "Invalid date or time format. Use date: YYYY-MM-DD, times: HH:MM."}

        if b_date < datetime.now().date():
            return {"error": "The requested date is in the past. Please provide a future date."}
        if t_end <= t_start:
            return {"error": "End time must be after start time."}

        available = await self._find_available_rooms(
            branch.id, room_type, b_date, t_start, t_end, capacity=capacity, amenities=amenities
        )

        return {
            "branch": branch.name,
            "room_type": room_type,
            "date": booking_date,
            "start_time": start_time_str,
            "end_time": end_time_str,
            "requested_capacity": capacity,
            "requested_amenities": amenities or [],
            "available_rooms": available
        }

    async def get_room_details(self, room_id: str) -> Dict[str, Any]:
        """Get full details (capacity, price, facilities, floor) for a specific room by its ID."""
        room = (await self.db.execute(
            select(Room).options(selectinload(Room.facilities)).where(Room.id == room_id)
        )).scalar_one_or_none()
        if not room:
            return {"error": f"Room with id {room_id} not found."}
        return {
            "room_id": str(room.id),
            "name": room.name,
            "room_type": room.room_type,
            "capacity": room.capacity,
            "floor": room.floor,
            "price_per_hour": float(room.price_per_hour or 0),
            "facilities": [f.name for f in room.facilities] if room.facilities else [],
            "status": room.status
        }

    # ---------- AI Intelligence Tools ----------

    async def recommend_seat(self, branch_name: str, preference: str, booking_date: str) -> Dict[str, Any]:
        """
        AI tool to recommend the best seat based on preference ('QUIET_ZONE', 'WINDOW', 'ERGONOMIC', 'STANDARD').
        """
        pref_upper = preference.upper()
        branch = await self._find_branch(branch_name)
        if not branch:
            return {"error": f"Branch {branch_name} not found."}

        seats_res = await self.db.execute(
            select(Seat, Room)
            .join(Room, Seat.room_id == Room.id)
            .where(Room.branch_id == branch.id, Seat.status == "ACTIVE")
        )
        all_seats = seats_res.all()

        matched = []
        fallback = []
        for seat, room in all_seats:
            seat_info = {
                "seat_id": str(seat.id),
                "seat_number": seat.seat_number,
                "seat_type": seat.seat_type,
                "room_name": room.name,
                "price": float(seat.price),
                "branch": branch.name
            }
            if pref_upper in seat.seat_type or (pref_upper == "WINDOW" and "WINDOW" in seat.seat_type):
                matched.append(seat_info)
            else:
                fallback.append(seat_info)

        recommendations = (matched + fallback)[:4]
        return {
            "branch": branch.name,
            "preference": preference,
            "date": booking_date,
            "top_recommendations": recommendations,
            "ai_reasoning": f"Found {len(matched)} exact matching desks for '{preference}' preference in {branch.name}."
        }

    async def recommend_room(self, branch_name: str, team_size: int, required_amenity: Optional[str] = None) -> Dict[str, Any]:
        """
        AI tool to recommend the best Meeting or Conference Room matching team size and tech setup.
        """
        branch = await self._find_branch(branch_name)
        if not branch:
            return {"error": f"Branch {branch_name} not found."}

        target_type = "CONFERENCE_ROOM" if team_size >= 12 else "MEETING_ROOM"
        rooms_res = await self.db.execute(
            select(Room).options(selectinload(Room.facilities)).where(
                Room.branch_id == branch.id,
                Room.capacity >= team_size,
                Room.status == "ACTIVE"
            ).order_by(Room.capacity.asc())
        )
        rooms = rooms_res.scalars().all()

        recs = []
        for r in rooms:
            facs = [f.name for f in r.facilities] if r.facilities else []
            recs.append({
                "room_id": str(r.id),
                "name": r.name,
                "room_type": r.room_type,
                "capacity": r.capacity,
                "price_per_hour": float(r.price_per_hour or 0),
                "facilities": facs,
                "suitability_score": "High" if (not required_amenity or any(required_amenity.lower() in f.lower() for f in facs)) else "Moderate"
            })

        return {
            "branch": branch.name,
            "team_size": team_size,
            "recommended_rooms": recs[:3],
            "ai_recommendation": f"For a group of {team_size}, we suggest {recs[0]['name'] if recs else 'our conference suite'} with optimal audio-visual equipment."
        }

    async def resolve_booking_conflict(
        self,
        branch_name: str,
        room_type: str,
        booking_date: str,
        start_time_str: str,
        end_time_str: str,
        capacity: Optional[int] = None,
        amenities: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Call this ONLY after get_meeting_or_conference_rooms returned zero available_rooms.
        Computes genuinely available alternatives (never invented): nearby time slots on the
        same day, rooms without the requested amenity, larger-capacity rooms, and the same
        search repeated on the next day.
        """
        branch = await self._find_branch(branch_name)
        if not branch:
            return {"error": f"Branch {branch_name} not found."}

        try:
            b_date = datetime.strptime(booking_date, "%Y-%m-%d").date()
            t_start = datetime.strptime(start_time_str[:5], "%H:%M").time()
            t_end = datetime.strptime(end_time_str[:5], "%H:%M").time()
        except Exception:
            return {"error": "Invalid date or time format. Use date: YYYY-MM-DD, times: HH:MM."}

        duration_min = (t_end.hour * 60 + t_end.minute) - (t_start.hour * 60 + t_start.minute)
        day_start_min, day_end_min = 8 * 60, 20 * 60  # branch business hours fallback

        nearby_time_slots = []
        for shift in (-120, -60, 60, 120, 180):
            new_start_min = t_start.hour * 60 + t_start.minute + shift
            new_end_min = new_start_min + duration_min
            if new_start_min < day_start_min or new_end_min > day_end_min:
                continue
            new_start = time(new_start_min // 60, new_start_min % 60)
            new_end = time(new_end_min // 60, new_end_min % 60)
            rooms = await self._find_available_rooms(branch.id, room_type, b_date, new_start, new_end, capacity, amenities)
            if rooms:
                nearby_time_slots.append({
                    "start_time": new_start.strftime("%H:%M"),
                    "end_time": new_end.strftime("%H:%M"),
                    "rooms": rooms[:2]
                })
            if len(nearby_time_slots) >= 3:
                break

        larger_capacity_rooms = []
        if capacity:
            larger_capacity_rooms = await self._find_available_rooms(
                branch.id, room_type, b_date, t_start, t_end, capacity=capacity + 1, amenities=amenities
            )

        rooms_without_amenity = []
        if amenities:
            rooms_without_amenity = await self._find_available_rooms(
                branch.id, room_type, b_date, t_start, t_end, capacity=capacity, amenities=None
            )

        next_day = b_date + timedelta(days=1)
        next_day_rooms = await self._find_available_rooms(branch.id, room_type, next_day, t_start, t_end, capacity, amenities)

        return {
            "branch": branch.name,
            "requested_date": booking_date,
            "requested_time": f"{start_time_str}-{end_time_str}",
            "nearby_time_slots_same_day": nearby_time_slots,
            "larger_capacity_rooms_same_slot": larger_capacity_rooms[:3],
            "rooms_without_requested_amenity_same_slot": rooms_without_amenity[:3],
            "next_day_alternative": {"date": next_day.isoformat(), "rooms": next_day_rooms[:3]} if next_day_rooms else None,
            "has_alternatives": bool(nearby_time_slots or larger_capacity_rooms or rooms_without_amenity or next_day_rooms)
        }

    async def get_wallet_balance(self) -> Dict[str, Any]:
        """Check the current user's wallet credit balance."""
        result = await self.db.execute(select(Wallet).where(Wallet.user_id == self.current_user.id))
        wallet = result.scalar_one_or_none()
        if not wallet:
            return {"balance": 0.0, "currency": "INR"}
        return {"balance": float(wallet.balance), "currency": wallet.currency}

    async def get_transaction_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the current user's recent wallet transactions (top-ups, booking debits, refunds)."""
        result = await self.db.execute(
            select(CreditTransaction)
            .where(CreditTransaction.user_id == self.current_user.id)
            .order_by(CreditTransaction.created_at.desc())
            .limit(min(max(limit, 1), 50))
        )
        return [{
            "transaction_id": str(t.id),
            "type": t.transaction_type.value,
            "amount": float(t.amount),
            "balance_after": float(t.balance_after),
            "description": t.description,
            "status": t.status,
            "date": t.created_at.strftime("%Y-%m-%d %H:%M")
        } for t in result.scalars().all()]

    async def get_my_bookings(self) -> List[Dict[str, Any]]:
        """Get the user's upcoming active bookings."""
        result = await self.db.execute(
            select(Booking)
            .options(
                selectinload(Booking.location),
                selectinload(Booking.branch),
                selectinload(Booking.room),
                selectinload(Booking.seat),
                selectinload(Booking.day_pass),
                selectinload(Booking.time_slot)
            )
            .where(Booking.user_id == self.current_user.id)
            .order_by(Booking.booking_date.desc())
            .limit(10)
        )
        
        bookings = []
        for b in result.scalars().all():
            res_name = (
                f"Seat {b.seat.seat_number}" if b.seat else
                f"Day Pass: {b.day_pass.name}" if b.day_pass else
                f"Room: {b.room.name}" if b.room else "Resource"
            )
            time_str = (
                f"{str(b.time_slot.start_time)[:5]} - {str(b.time_slot.end_time)[:5]}" if b.time_slot else
                f"{str(b.start_time)[:5]} - {str(b.end_time)[:5]}" if b.start_time and b.end_time else "Full Day"
            )
            bookings.append({
                "booking_id": str(b.id),
                "type": b.booking_type.value,
                "location": b.location.name if b.location else "",
                "branch": b.branch.name if b.branch else "",
                "resource": res_name,
                "date": str(b.booking_date),
                "time": time_str,
                "status": b.status.value,
                "amount": float(b.amount)
            })
        return bookings

    async def get_booking_details(self, booking_id: str) -> Dict[str, Any]:
        """Get full details for one of the current user's bookings by its booking ID."""
        result = await self.db.execute(
            select(Booking)
            .options(
                selectinload(Booking.location),
                selectinload(Booking.branch),
                selectinload(Booking.room).selectinload(Room.facilities),
                selectinload(Booking.seat),
                selectinload(Booking.day_pass),
                selectinload(Booking.time_slot)
            )
            .where(Booking.id == booking_id, Booking.user_id == self.current_user.id)
        )
        b = result.scalar_one_or_none()
        if not b:
            return {"error": "Booking not found, or it does not belong to you."}

        res_name = (
            f"Seat {b.seat.seat_number}" if b.seat else
            f"Day Pass: {b.day_pass.name}" if b.day_pass else
            f"Room: {b.room.name}" if b.room else "Resource"
        )
        time_str = (
            f"{str(b.time_slot.start_time)[:5]} - {str(b.time_slot.end_time)[:5]}" if b.time_slot else
            f"{str(b.start_time)[:5]} - {str(b.end_time)[:5]}" if b.start_time and b.end_time else "Full Day"
        )
        return {
            "booking_id": str(b.id),
            "type": b.booking_type.value,
            "location": b.location.name if b.location else "",
            "branch": b.branch.name if b.branch else "",
            "resource": res_name,
            "capacity": b.room.capacity if b.room else None,
            "facilities": [f.name for f in b.room.facilities] if b.room and b.room.facilities else [],
            "date": str(b.booking_date),
            "time": time_str,
            "status": b.status.value,
            "amount": float(b.amount),
            "attendees": b.number_of_people or 1,
            "title": b.title,
            "purpose": b.purpose,
            "participant_emails": b.participant_emails or []
        }

    async def confirm_intent_to_book(
        self,
        booking_type: str,
        location_id: str,
        branch_id: str,
        booking_date: str,
        amount: float,
        seat_id: Optional[str] = None,
        day_pass_id: Optional[str] = None,
        room_id: Optional[str] = None,
        time_slot_id: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        resource_label: Optional[str] = None,
        attendees: Optional[int] = None,
        title: Optional[str] = None,
        purpose: Optional[str] = None,
        participant_emails: Optional[List[str]] = None,
        required_amenities: Optional[List[str]] = None,
        additional_users: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Prepare a booking confirmation card. `additional_users` is for DAY_PASS bookings
        with more than one attendee - a list of {"name": ..., "email": ...} for every
        attendee EXCEPT the person booking (attendees should equal 1 + len(additional_users)).
        """
        return {
            "action": "REQUIRE_BOOKING_CONFIRMATION",
            "payload": {
                "booking_type": booking_type,
                "location_id": location_id,
                "branch_id": branch_id,
                "booking_date": booking_date,
                "seat_id": seat_id,
                "day_pass_id": day_pass_id,
                "room_id": room_id,
                "time_slot_id": time_slot_id,
                "start_time": start_time,
                "end_time": end_time,
                "amount": amount,
                "resource_label": resource_label,
                "attendees": attendees,
                "title": title,
                "purpose": purpose,
                "participant_emails": participant_emails,
                "required_amenities": required_amenities,
                "additional_users": additional_users
            }
        }

    async def confirm_intent_to_cancel(self, booking_id: str) -> Dict[str, Any]:
        return {
            "action": "REQUIRE_CANCEL_CONFIRMATION",
            "payload": {
                "booking_id": booking_id
            }
        }

    async def confirm_intent_to_reschedule(
        self,
        booking_id: str,
        new_date: Optional[str] = None,
        new_start_time: Optional[str] = None,
        new_end_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reschedule a Meeting/Conference Room booking to a new date and/or time.
        Only usable on the current user's own room bookings. Pre-validates the new
        slot is actually free and recomputes the price BEFORE asking for confirmation
        so the user sees an accurate preview; the backend re-validates again on confirm.
        """
        booking = (await self.db.execute(
            select(Booking).options(selectinload(Booking.room)).where(
                Booking.id == booking_id, Booking.user_id == self.current_user.id
            )
        )).scalar_one_or_none()
        if not booking:
            return {"error": "Booking not found, or it does not belong to you."}
        if booking.status != BookingStatus.CONFIRMED:
            return {"error": "Only confirmed bookings can be rescheduled."}
        if not booking.room_id or not booking.room:
            return {"error": "Only Meeting/Conference Room bookings can be rescheduled through the assistant. Seat or Day Pass bookings must be managed from My Bookings."}

        try:
            target_date = datetime.strptime(new_date, "%Y-%m-%d").date() if new_date else booking.booking_date
            target_start = datetime.strptime(new_start_time[:5], "%H:%M").time() if new_start_time else booking.start_time
            target_end = datetime.strptime(new_end_time[:5], "%H:%M").time() if new_end_time else booking.end_time
        except Exception:
            return {"error": "Invalid date or time format. Use date: YYYY-MM-DD, times: HH:MM."}

        if target_end <= target_start:
            return {"error": "End time must be after start time."}
        if target_date < datetime.now().date():
            return {"error": "The requested date is in the past. Please provide a future date."}

        overlap = await self.db.execute(
            select(Booking).where(
                and_(
                    Booking.room_id == booking.room_id,
                    Booking.booking_date == target_date,
                    Booking.id != booking.id,
                    Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                    Booking.start_time < target_end,
                    Booking.end_time > target_start
                )
            )
        )
        if overlap.scalars().first():
            return {"error": f"{booking.room.name} is already booked for {target_date} {target_start.strftime('%H:%M')}-{target_end.strftime('%H:%M')}. Call resolve_booking_conflict for alternatives."}

        duration_hrs = (target_end.hour - target_start.hour) + (target_end.minute - target_start.minute) / 60.0
        new_amount = float(booking.room.price_per_hour or 0) * duration_hrs

        return {
            "action": "REQUIRE_RESCHEDULE_CONFIRMATION",
            "payload": {
                "booking_id": str(booking.id),
                "room_name": booking.room.name,
                "current_date": str(booking.booking_date),
                "current_time": f"{str(booking.start_time)[:5]}-{str(booking.end_time)[:5]}",
                "new_date": target_date.isoformat(),
                "new_start_time": target_start.strftime("%H:%M"),
                "new_end_time": target_end.strftime("%H:%M"),
                "current_amount": float(booking.amount),
                "new_amount": new_amount
            }
        }

    async def intent_add_credits(self, amount: float) -> Dict[str, Any]:
        return {
            "action": "REQUIRE_TOPUP_CONFIRMATION",
            "payload": {
                "amount": amount
            }
        }
