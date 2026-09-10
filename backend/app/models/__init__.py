from app.models.base import Base
from app.models.user import User
from app.models.location import Location, Branch, Room, Facility, RoomFacility, Seat, DayPass
from app.models.booking import TimeSlot, Booking, Payment
from app.models.wallet import Wallet, CreditTransaction
from app.models.visitor import Visitor, VisitorStatus
from app.models.notification import Notification, NotificationType

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
    "DayPass",
    "TimeSlot",
    "Booking",
    "Payment",
    "Wallet",
    "CreditTransaction",
    "Visitor",
    "VisitorStatus",
    "Notification",
    "NotificationType"
]
