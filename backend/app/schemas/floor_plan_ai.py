from pydantic import BaseModel
from typing import Optional, List, Literal
from app.schemas.floor_plan import FloorLayoutItemCreate, ValidationIssue

# ----------------- Request -----------------

class GenerateRoomsRequest(BaseModel):
    """Structured fields and `nl_request` are not mutually exclusive - both are folded
    into the same generation prompt (see app/services/floor_plan_ai.py). Filling in
    only one, or a mix of both, is expected and supported."""
    meeting_room_count: Optional[int] = None
    conference_room_count: Optional[int] = None
    available_area_sqft: Optional[float] = None
    capacity_min: Optional[int] = None
    capacity_max: Optional[int] = None
    required_amenities: Optional[List[str]] = None
    style: Optional[str] = None
    nl_request: Optional[str] = None

    # Single-room regeneration within an unsaved, in-progress proposal. Nothing is
    # persisted server-side between calls, so the client resends the other pending
    # rooms (as context to avoid re-overlapping them) plus which one to replace.
    pending_rooms: Optional[List["GeneratedRoomSpec"]] = None
    regenerate_room_name: Optional[str] = None


# ----------------- LLM structured-output target -----------------

class GeneratedRoomSpec(BaseModel):
    """One room as proposed directly by the LLM (including its own x/y/width/height/
    rotation - see plan doc for why room geometry is LLM-driven while door/window/
    amenity placement inside it is deterministic)."""
    name: str
    room_number: str
    capacity: int
    # CUSTOM is excluded - it has no well-defined default geometry to place furniture
    # against (see design note on shape-aware placement in floor_plan_ai.py).
    shape: Literal["RECTANGLE", "SQUARE", "CIRCLE", "OVAL", "L_SHAPE"]
    x: float
    y: float
    width: float
    height: float
    rotation: float = 0.0
    amenities: List[str] = []
    door_side: Literal["NORTH", "SOUTH", "EAST", "WEST"]
    has_window: bool = False


class GeneratedRoomsPlan(BaseModel):
    """The with_structured_output() target - always a list, even when regenerating
    a single room, so one code path serves both cases."""
    rooms: List[GeneratedRoomSpec]
    notes: Optional[str] = None


GenerateRoomsRequest.model_rebuild()


# ----------------- Response -----------------

class GenerationValidationIssue(ValidationIssue):
    """Extends the existing ValidationIssue (item_id, message) with a severity used
    only to style the AI-proposal preview UI. Severity is advisory: the generation
    endpoint never blocks on it - nothing is auto-published (requirement 5), and
    Accept & Save must stay available even with warnings shown. The real gate remains
    the existing, unmodified `_validate_items()` inside POST /floor-plans/floors/{id}/save."""
    severity: Literal["error", "warning"] = "warning"


class ProposedRoomBundle(BaseModel):
    spec: GeneratedRoomSpec                     # raw LLM spec, kept for lossless round-trip on regenerate-one
    room: FloorLayoutItemCreate                 # id pre-assigned server-side
    children: List[FloorLayoutItemCreate] = []  # DOOR (required) + optional WINDOW + FACILITY markers


class GenerateRoomsResponse(BaseModel):
    rooms: List[ProposedRoomBundle]
    issues: List[GenerationValidationIssue] = []
    notes: Optional[str] = None
