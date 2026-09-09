from app.models.base import Base
from app.models.user import User
from app.models.location import Location, Branch, Room, Facility, RoomFacility, Seat
from app.models.booking import TimeSlot, Booking, Payment
from app.models.wallet import Wallet, CreditTransaction

# For Alembic to discover all models
__all__ = [
    "Base",
    "User",
    "Location",
    "Branch",
    "Room",
    "Facility",
    "RoomFacility",
    "Seat",
    "TimeSlot",
    "Booking",
    "Payment",
    "Wallet",
    "CreditTransaction"
]
