from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from uuid import UUID
from datetime import date, datetime

from app.models.location import Location, Branch, Room, Seat, Facility
from app.models.booking import Booking, TimeSlot, BookingStatus
from app.models.wallet import Wallet
from app.models.user import User

class ChatbotTools:
    def __init__(self, db: AsyncSession, current_user: User):
        self.db = db
        self.current_user = current_user

    async def search_locations(self) -> List[Dict[str, Any]]:
        """Search for all available locations/cities where workspaces are present."""
        result = await self.db.execute(select(Location))
        locations = result.scalars().all()
        return [{"id": str(l.id), "name": l.name, "city": l.city} for l in locations]

    async def search_branches(self, location_name: str) -> List[Dict[str, Any]]:
        """Search for branches within a specific location/city name."""
        # Find location first
        result = await self.db.execute(select(Location).where(Location.name.ilike(f"%{location_name}%") | Location.city.ilike(f"%{location_name}%")))
        location = result.scalar_one_or_none()
        if not location:
            return [{"error": f"Location {location_name} not found."}]
            
        b_result = await self.db.execute(select(Branch).where(Branch.location_id == location.id))
        branches = b_result.scalars().all()
        return [{"id": str(b.id), "name": b.name, "address": b.address} for b in branches]

    async def search_rooms(self, branch_name: str) -> List[Dict[str, Any]]:
        """Search for available rooms in a specific branch."""
        b_result = await self.db.execute(select(Branch).where(Branch.name.ilike(f"%{branch_name}%")))
        branch = b_result.scalar_one_or_none()
        if not branch:
            return [{"error": f"Branch {branch_name} not found."}]
            
        r_result = await self.db.execute(select(Room).where(Room.branch_id == branch.id))
        rooms = r_result.scalars().all()
        return [{"id": str(r.id), "name": r.name, "capacity": r.capacity} for r in rooms]

    async def get_time_slots(self) -> List[Dict[str, Any]]:
        """Get all available time slots."""
        result = await self.db.execute(select(TimeSlot))
        slots = result.scalars().all()
        return [{"id": str(s.id), "start": str(s.start_time), "end": str(s.end_time)} for s in slots]

    async def check_availability(self, room_name: str, booking_date: str, start_time_str: str) -> Dict[str, Any]:
        """
        Check available seats for a specific room, date (YYYY-MM-DD), and start time (HH:MM:SS).
        """
        # Find room
        r_result = await self.db.execute(select(Room).where(Room.name.ilike(f"%{room_name}%")))
        room = r_result.scalar_one_or_none()
        if not room:
            return {"error": f"Room {room_name} not found."}
            
        # Find time slot
        t_result = await self.db.execute(select(TimeSlot))
        slots = t_result.scalars().all()
        target_slot = None
        for s in slots:
            if str(s.start_time).startswith(start_time_str[:5]):
                target_slot = s
                break
                
        if not target_slot:
            return {"error": f"Time slot starting at {start_time_str} not found."}

        # Get all seats
        s_result = await self.db.execute(select(Seat).where(Seat.room_id == room.id))
        seats = s_result.scalars().all()
        
        # Get active bookings
        b_date = datetime.strptime(booking_date, "%Y-%m-%d").date()
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
                available.append({"id": str(s.id), "seat_number": s.seat_number, "price": float(s.price)})
                
        return {
            "room_id": str(room.id),
            "time_slot_id": str(target_slot.id),
            "date": booking_date,
            "available_seats": available
        }

    async def get_wallet_balance(self) -> Dict[str, Any]:
        """Check the current user's wallet credit balance."""
        result = await self.db.execute(select(Wallet).where(Wallet.user_id == self.current_user.id))
        wallet = result.scalar_one_or_none()
        if not wallet:
            return {"error": "Wallet not found."}
        return {"balance": float(wallet.balance), "currency": wallet.currency}

    async def get_my_bookings(self) -> List[Dict[str, Any]]:
        """Get the user's upcoming bookings."""
        result = await self.db.execute(
            select(Booking, Seat, Room, Branch, Location, TimeSlot)
            .join(Seat, Booking.seat_id == Seat.id)
            .join(Room, Seat.room_id == Room.id)
            .join(Branch, Room.branch_id == Branch.id)
            .join(Location, Branch.location_id == Location.id)
            .join(TimeSlot, Booking.time_slot_id == TimeSlot.id)
            .where(Booking.user_id == self.current_user.id)
            .order_by(Booking.booking_date.desc())
        )
        
        bookings = []
        for b, s, r, br, loc, ts in result:
            bookings.append({
                "booking_id": str(b.id),
                "location": loc.name,
                "branch": br.name,
                "room": r.name,
                "seat_number": s.seat_number,
                "date": str(b.booking_date),
                "time": f"{ts.start_time} - {ts.end_time}",
                "status": b.status.value,
                "amount": float(b.amount)
            })
        return bookings

    # Note: create_booking and cancel_booking are handled by UI redirects or specific actions
    # to maintain strict transactional boundaries, but the chatbot can initiate the intent.
    async def confirm_intent_to_book(self, seat_id: str, booking_date: str, time_slot_id: str) -> Dict[str, Any]:
        """
        Called when the user explicitly agrees to book a specific seat.
        Returns a signal for the UI to show the final confirmation modal.
        """
        return {
            "action": "REQUIRE_BOOKING_CONFIRMATION",
            "payload": {
                "seat_id": seat_id,
                "booking_date": booking_date,
                "time_slot_id": time_slot_id
            }
        }
        
    async def confirm_intent_to_cancel(self, booking_id: str) -> Dict[str, Any]:
        """
        Called when the user explicitly agrees to cancel a booking.
        """
        return {
            "action": "REQUIRE_CANCEL_CONFIRMATION",
            "payload": {
                "booking_id": booking_id
            }
        }

    async def intent_add_credits(self, amount: float) -> Dict[str, Any]:
        """
        Called when the user wants to add credits to their wallet.
        """
        return {
            "action": "REQUIRE_TOPUP_CONFIRMATION",
            "payload": {
                "amount": amount
            }
        }
