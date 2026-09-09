from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import date
from app.models.booking import BookingStatus, PaymentStatus

class BookingBase(BaseModel):
    seat_id: UUID
    booking_date: date
    time_slot_id: UUID

class BookingCreate(BookingBase):
    pass

class BookingResponse(BookingBase):
    id: UUID
    user_id: UUID
    status: BookingStatus
    amount: float
    
    class Config:
        from_attributes = True

class SeatAvailability(BaseModel):
    seat_id: UUID
    seat_number: str
    status: str # "AVAILABLE", "BOOKED"
    booked_by: Optional[str] = None # Only populated for tooltips if needed
