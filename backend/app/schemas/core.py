from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import time, date

# ----------------- Base schemas -----------------
class LocationBase(BaseModel):
    name: str
    address: str
    city: str
    state: str
    country: str
    postal_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = "ACTIVE"

class BranchBase(BaseModel):
    location_id: UUID
    name: str
    address: str
    description: Optional[str] = None
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None
    is_24x7: Optional[bool] = False
    status: Optional[str] = "ACTIVE"

class RoomBase(BaseModel):
    branch_id: UUID
    name: str
    description: Optional[str] = None
    room_type: Optional[str] = "WORKSPACE" # WORKSPACE, MEETING_ROOM, CONFERENCE_ROOM
    capacity: int
    price_per_hour: Optional[float] = None
    status: Optional[str] = "ACTIVE"

class DayPassBase(BaseModel):
    branch_id: UUID
    name: str
    description: Optional[str] = None
    price: float
    daily_capacity: int
    status: Optional[str] = "ACTIVE"

class FacilityBase(BaseModel):
    name: str
    description: Optional[str] = None

class SeatBase(BaseModel):
    room_id: UUID
    seat_number: str
    seat_type: Optional[str] = "STANDARD"
    description: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    price: float

class TimeSlotBase(BaseModel):
    start_time: time
    end_time: time
    status: Optional[str] = "ACTIVE"

# ----------------- Create schemas -----------------
class LocationCreate(LocationBase): pass
class BranchCreate(BranchBase): pass
class RoomCreate(RoomBase):
    facility_ids: Optional[List[UUID]] = []

class DayPassCreate(DayPassBase): pass
class FacilityCreate(FacilityBase): pass
class SeatCreate(SeatBase): pass
class TimeSlotCreate(TimeSlotBase): pass

# ----------------- Update schemas -----------------
class LocationUpdate(LocationBase): pass
class BranchUpdate(BranchBase): pass
class RoomUpdate(RoomBase):
    facility_ids: Optional[List[UUID]] = None

class DayPassUpdate(DayPassBase): pass
class FacilityUpdate(FacilityBase): pass
class SeatUpdate(SeatBase): pass
class TimeSlotUpdate(TimeSlotBase): pass

# ----------------- Response schemas -----------------
class FacilityResponse(FacilityBase):
    id: UUID
    class Config:
        from_attributes = True

class SeatResponse(SeatBase):
    id: UUID
    class Config:
        from_attributes = True

class RoomResponse(RoomBase):
    id: UUID
    facilities: List[FacilityResponse] = []
    class Config:
        from_attributes = True

class DayPassResponse(DayPassBase):
    id: UUID
    class Config:
        from_attributes = True

class BranchResponse(BranchBase):
    id: UUID
    class Config:
        from_attributes = True

class LocationResponse(LocationBase):
    id: UUID
    class Config:
        from_attributes = True

class TimeSlotResponse(TimeSlotBase):
    id: UUID
    class Config:
        from_attributes = True

