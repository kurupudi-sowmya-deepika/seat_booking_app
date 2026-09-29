from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date, time, datetime
from app.models.booking import BookingStatus, PaymentStatus, BookingType

class BookingCreate(BaseModel):
    booking_type: BookingType
    location_id: UUID
    branch_id: UUID
    booking_date: date
    
    # Optional fields depending on booking_type
    seat_id: Optional[UUID] = None
    day_pass_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    
    time_slot_id: Optional[UUID] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    
    # For Day Pass - multiple users support
    number_of_people: Optional[int] = 1
    additional_users: Optional[List[Dict[str, str]]] = None  # List of {name, email}

    # Meeting/conference room metadata
    title: Optional[str] = None
    purpose: Optional[str] = None
    participant_emails: Optional[List[str]] = None

    # Validation-only: not persisted. If set, the chosen room must have all of these
    # facilities or the booking is rejected (used by the chatbot booking flow).
    required_amenities: Optional[List[str]] = None

class BookingModifyRequest(BaseModel):
    booking_date: Optional[date] = None
    seat_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    time_slot_id: Optional[UUID] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None

class BookingExtendRequest(BaseModel):
    additional_hours: int = 1
    new_end_time: Optional[time] = None

class BookingResponse(BaseModel):
    id: UUID
    user_id: UUID
    booking_type: BookingType
    location_id: UUID
    # Nullable in the DB (migration 00002 added bookings.branch_id with nullable=True, so older
    # bookings have none) - a strict UUID here made GET /bookings/my return 500 for any such user.
    branch_id: Optional[UUID] = None
    seat_id: Optional[UUID] = None
    day_pass_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    booking_date: date
    time_slot_id: Optional[UUID] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: BookingStatus
    amount: float
    number_of_people: Optional[int] = 1
    additional_users: Optional[List[Dict[str, str]]] = None
    title: Optional[str] = None
    purpose: Optional[str] = None
    participant_emails: Optional[List[str]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BookingDetailResponse(BookingResponse):
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    location_name: Optional[str] = None
    branch_name: Optional[str] = None
    room_name: Optional[str] = None
    seat_number: Optional[str] = None
    seat_type: Optional[str] = None
    day_pass_name: Optional[str] = None
    time_slot_label: Optional[str] = None
    facilities: Optional[List[str]] = []
    amenities: Optional[List[str]] = []
    
    class Config:
        from_attributes = True

class SeatAvailability(BaseModel):
    seat_id: UUID
    seat_number: str
    seat_type: Optional[str] = "STANDARD"
    price: float = 150.0
    status: str # "AVAILABLE", "BOOKED"
    booked_by: Optional[str] = None

class DayPassAvailability(BaseModel):
    day_pass_id: UUID
    name: str
    price: float
    total_capacity: int
    booked_count: int
    available_capacity: int
    status: str # "AVAILABLE", "SOLD_OUT"
    amenities: Optional[List[str]] = []
    currency: Optional[str] = "INR"

class RoomAvailability(BaseModel):
    room_id: UUID
    name: str
    capacity: int
    price_per_hour: float
    room_type: Optional[str] = "WORKSPACE"
    facilities: Optional[List[str]] = []
    seats_count: Optional[int] = 0
    floor: Optional[int] = None
    available_capacity: Optional[int] = None
    status: str # "AVAILABLE", "UNAVAILABLE"
    currency: Optional[str] = "INR"

class RoomTimelineSlot(BaseModel):
    start_time: time
    end_time: time
    status: str # "AVAILABLE", "BOOKED"
    is_mine: bool = False
    booking_id: Optional[UUID] = None
    booked_by: Optional[str] = None
    booking_type: Optional[str] = None
    booking_start: Optional[time] = None
    booking_end: Optional[time] = None


class RoomTimelineResponse(BaseModel):
    room_id: UUID
    name: str
    floor: Optional[int] = None
    capacity: int
    room_type: str
    price_per_hour: float
    facilities: List[str] = []
    status: str
    slots: List[RoomTimelineSlot]

class AlternativeResourceOption(BaseModel):
    id: UUID
    name: str
    type: str # "SEAT" or "ROOM"
    branch_id: UUID
    branch_name: str
    capacity: Optional[int] = None
    price: float
    facilities: List[str] = []
    reason: str

class AlternativeResourceResponse(BaseModel):
    requested_resource_id: Optional[str] = None
    conflict_detected: bool
    message: str
    alternatives: List[AlternativeResourceOption]
