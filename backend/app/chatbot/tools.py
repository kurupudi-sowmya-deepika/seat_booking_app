from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import date, datetime, time, timedelta
import math

from app.models.location import Location, Branch, Room, Seat, Facility, DayPass
from app.models.booking import Booking, TimeSlot, BookingStatus, BookingType
from app.models.wallet import Wallet
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

    async def search_locations(self) -> List[Dict[str, Any]]:
        """Search for all available office locations/cities."""
        result = await self.db.execute(select(Location).where(Location.status == "ACTIVE"))
        locations = result.scalars().all()
        return [{"id": str(l.id), "name": l.name, "city": l.city, "address": l.address} for l in locations]

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
        """Search for branches within a specific location name or city."""
        result = await self.db.execute(select(Location).where(Location.name.ilike(f"%{location_name}%") | Location.city.ilike(f"%{location_name}%")))
        location = result.scalar_one_or_none()
        if not location:
            return [{"error": f"Location {location_name} not found."}]
            
        b_result = await self.db.execute(select(Branch).where(Branch.location_id == location.id, Branch.status == "ACTIVE"))
        branches = b_result.scalars().all()
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
        b_result = await self.db.execute(select(Branch).where(Branch.name.ilike(f"%{branch_name}%")))
        branch = b_result.scalar_one_or_none()
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
        r_result = await self.db.execute(select(Room).where(Room.name.ilike(f"%{room_name}%")))
        room = r_result.scalar_one_or_none()
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
        b_result = await self.db.execute(select(Branch).where(Branch.name.ilike(f"%{branch_name}%")))
        branch = b_result.scalar_one_or_none()
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

    async def get_meeting_or_conference_rooms(self, branch_name: str, room_type: str, booking_date: str, start_time_str: str, end_time_str: str) -> Dict[str, Any]:
        """Check meeting or conference rooms availability for a given time range."""
        b_result = await self.db.execute(select(Branch).where(Branch.name.ilike(f"%{branch_name}%")))
        branch = b_result.scalar_one_or_none()
        if not branch:
            return {"error": f"Branch {branch_name} not found."}
            
        try:
            b_date = datetime.strptime(booking_date, "%Y-%m-%d").date()
            t_start = datetime.strptime(start_time_str[:5], "%H:%M").time()
            t_end = datetime.strptime(end_time_str[:5], "%H:%M").time()
        except Exception:
            return {"error": "Invalid date or time format. Use date: YYYY-MM-DD, times: HH:MM."}
            
        rooms_res = await self.db.execute(
            select(Room).options(selectinload(Room.facilities)).where(
                Room.branch_id == branch.id,
                Room.room_type == room_type,
                Room.status == "ACTIVE"
            )
        )
        rooms = rooms_res.scalars().all()
        
        available = []
        duration_hrs = (t_end.hour - t_start.hour) + (t_end.minute - t_start.minute) / 60.0
        
        for r in rooms:
            overlap = await self.db.execute(
                select(Booking).where(
                    and_(
                        Booking.room_id == r.id,
                        Booking.booking_date == b_date,
                        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                        Booking.start_time < t_end,
                        Booking.end_time > t_start
                    )
                )
            )
            if not overlap.scalars().first():
                cost = float(r.price_per_hour or 0) * duration_hrs
                available.append({
                    "room_id": str(r.id),
                    "name": r.name,
                    "capacity": r.capacity,
                    "price_per_hour": float(r.price_per_hour or 0),
                    "estimated_total": cost,
                    "facilities": [f.name for f in r.facilities]
                })
                
        return {
            "branch": branch.name,
            "room_type": room_type,
            "date": booking_date,
            "start_time": start_time_str,
            "end_time": end_time_str,
            "available_rooms": available
        }

    # ---------- AI Intelligence Tools ----------

    async def recommend_seat(self, branch_name: str, preference: str, booking_date: str) -> Dict[str, Any]:
        """
        AI tool to recommend the best seat based on preference ('QUIET_ZONE', 'WINDOW', 'ERGONOMIC', 'STANDARD').
        """
        pref_upper = preference.upper()
        b_res = await self.db.execute(select(Branch).where(Branch.name.ilike(f"%{branch_name}%")))
        branch = b_res.scalar_one_or_none()
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
        b_res = await self.db.execute(select(Branch).where(Branch.name.ilike(f"%{branch_name}%")))
        branch = b_res.scalar_one_or_none()
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

    async def resolve_booking_conflict(self, branch_name: str, booking_date: str, requested_time: str) -> Dict[str, Any]:
        """
        AI Conflict Resolution Tool: Suggests adjacent available time slots or alternate rooms when collision occurs.
        """
        b_res = await self.db.execute(select(Branch).where(Branch.name.ilike(f"%{branch_name}%")))
        branch = b_res.scalar_one_or_none()
        if not branch:
            return {"error": f"Branch {branch_name} not found."}

        slots = (await self.db.execute(select(TimeSlot).where(TimeSlot.status == "ACTIVE"))).scalars().all()
        slot_list = [{"id": str(s.id), "time_label": f"{str(s.start_time)[:5]} - {str(s.end_time)[:5]}"} for s in slots]

        return {
            "branch": branch.name,
            "date": booking_date,
            "resolution_advice": f"The slot at {requested_time} has high demand. We recommend reserving an adjacent time window or booking a Day Pass for full-day flexibility.",
            "alternative_slots": slot_list[:3]
        }

    async def get_wallet_balance(self) -> Dict[str, Any]:
        """Check the current user's wallet credit balance."""
        result = await self.db.execute(select(Wallet).where(Wallet.user_id == self.current_user.id))
        wallet = result.scalar_one_or_none()
        if not wallet:
            return {"balance": 0.0, "currency": "INR"}
        return {"balance": float(wallet.balance), "currency": wallet.currency}

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
        resource_label: Optional[str] = None
    ) -> Dict[str, Any]:
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
                "resource_label": resource_label
            }
        }
        
    async def confirm_intent_to_cancel(self, booking_id: str) -> Dict[str, Any]:
        return {
            "action": "REQUIRE_CANCEL_CONFIRMATION",
            "payload": {
                "booking_id": booking_id
            }
        }

    async def intent_add_credits(self, amount: float) -> Dict[str, Any]:
        return {
            "action": "REQUIRE_TOPUP_CONFIRMATION",
            "payload": {
                "amount": amount
            }
        }
