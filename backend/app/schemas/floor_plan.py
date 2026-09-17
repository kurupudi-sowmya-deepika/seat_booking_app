from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

# ----------------- Floor -----------------

class FloorBase(BaseModel):
    branch_id: UUID
    name: str
    floor_number: Optional[int] = 0
    canvas_width: Optional[float] = 1200.0
    canvas_height: Optional[float] = 800.0
    status: Optional[str] = "ACTIVE"  # ACTIVE, INACTIVE

class FloorCreate(FloorBase):
    pass

class FloorUpdate(BaseModel):
    name: Optional[str] = None
    floor_number: Optional[int] = None
    canvas_width: Optional[float] = None
    canvas_height: Optional[float] = None
    status: Optional[str] = None

class FloorResponse(FloorBase):
    id: UUID
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    published_by: Optional[UUID] = None
    published_at: Optional[datetime] = None
    has_draft_changes: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FloorDashboardStats(FloorResponse):
    """FloorResponse plus the dashboard's summary counts - separate from FloorResponse
    since the plain editor/detail views don't need to pay for these joins."""
    branch_name: str
    total_seats: int = 0
    available_seats: int = 0
    meeting_rooms: int = 0
    facilities_count: int = 0

# ----------------- Floor layout items -----------------

class FloorLayoutItemBase(BaseModel):
    item_type: str  # SEAT, ROOM, ZONE, WALL, DOOR, WINDOW, FACILITY
    parent_item_id: Optional[UUID] = None
    zone_item_id: Optional[UUID] = None
    label: Optional[str] = None
    color: Optional[str] = None
    x: float
    y: float
    width: float = 60.0
    height: float = 60.0
    rotation: Optional[float] = 0.0
    shape: Optional[str] = "RECTANGLE"  # RECTANGLE, SQUARE, CIRCLE, OVAL, L_SHAPE, CUSTOM
    z_index: Optional[int] = 0
    # Visual height for the isometric render only - see FloorLayoutItem model docstring.
    elevation: Optional[float] = 0.0
    # Type-specific staged fields (see app/models/floor_plan.py docstring for the shape
    # expected per item_type - e.g. seat_number/price for SEAT, capacity/room_number for
    # ROOM, facility_id for FACILITY). Not validated here beyond being a JSON object -
    # save-time validation (bounds, duplicate numbers) happens in the route.
    properties: Optional[Dict[str, Any]] = None

class FloorLayoutItemCreate(FloorLayoutItemBase):
    # The frontend always pre-generates this (crypto.randomUUID()) for every item, new
    # or existing, rather than leaving it server-assigned. That lets a brand-new item's
    # id be used as another new item's `parent_item_id`/`zone_item_id` within the very
    # same save batch (e.g. a facility placed inside a room created moments earlier, all
    # saved together), and it's how /save tells "update this existing row" (id already
    # in the DB) apart from "insert a new row" (id not yet in the DB).
    id: Optional[UUID] = None

class FloorLayoutItemResponse(FloorLayoutItemBase):
    id: UUID
    floor_id: UUID
    is_draft: bool
    published_counterpart_id: Optional[UUID] = None
    seat_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FloorLayoutSaveRequest(BaseModel):
    """The whole draft layout, saved together in one transaction (requirement 10:
    'save the complete layout together'). Items without an `id` are new; the route
    replaces the floor's entire draft item set with exactly what's provided here."""
    items: List[FloorLayoutItemCreate]

class ValidationIssue(BaseModel):
    item_id: Optional[UUID] = None
    message: str

class FloorLayoutSaveResponse(BaseModel):
    success: bool
    issues: List[ValidationIssue] = []
    items: List[FloorLayoutItemResponse] = []

class FloorPublishResponse(BaseModel):
    success: bool
    issues: List[ValidationIssue] = []
    floor: Optional[FloorResponse] = None

class PublishedFloorLayoutItem(FloorLayoutItemResponse):
    """A published item enriched with live business data from its real Seat/Room row -
    what the employee-facing viewer actually renders (current price/status/capacity,
    not whatever was true when the floor was last published)."""
    seat_number: Optional[str] = None
    seat_type: Optional[str] = None
    price: Optional[float] = None
    seat_status: Optional[str] = None
    room_name: Optional[str] = None
    room_number: Optional[str] = None
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    price_per_hour: Optional[float] = None

class PublishedFloorResponse(BaseModel):
    floor: FloorResponse
    items: List[PublishedFloorLayoutItem]
