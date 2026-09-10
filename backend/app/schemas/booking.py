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
    branch_id: UUID
    seat_id: Optional[UUID] = None
    day_pass_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    booking_date: date
    time_slot_id: Optional[UUID] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: BookingStatus
    amount: float
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

class RoomAvailability(BaseModel):
    room_id: UUID
    name: str
    capacity: int
    price_per_hour: float
    room_type: Optional[str] = "WORKSPACE"
    facilities: Optional[List[str]] = []
    seats_count: Optional[int] = 0
    status: str # "AVAILABLE", "UNAVAILABLE"

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
