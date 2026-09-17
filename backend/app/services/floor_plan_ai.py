"""AI-assisted room generation for Floor Plan Management.

`generate_rooms_for_floor()` is a plain, framework-agnostic async function (no
`Depends()`/`HTTPException`) so it can be called directly from a FastAPI route
today and, later, from a chatbot tool without any new architecture - that's the
only groundwork laid for the (deferred) chatbot integration.

Nothing here is persisted. The caller gets back a set of proposed
`FloorLayoutItemCreate` objects plus advisory validation issues; turning a
proposal into real draft rows is the existing `POST /floor-plans/floors/{id}/save`
endpoint, unchanged - see the plan doc for why no new persistence path exists.
"""
import math
from typing import Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.chatbot.langchain_service import get_model
from app.models.floor_plan import Floor, FloorLayoutItem, FloorLayoutItemType
from app.models.location import Facility
from app.models.user import User
from app.schemas.floor_plan import FloorLayoutItemCreate
from app.schemas.floor_plan_ai import (
    GenerateRoomsRequest,
    GenerateRoomsResponse,
    GeneratedRoomSpec,
    GeneratedRoomsPlan,
    GenerationValidationIssue,
    ProposedRoomBundle,
)
from app.utils.geometry import aabb_overlap, rotated_aabb

PROFESSIONAL_ROOM_NAMES = [
    "Nova", "Orion", "Aurora", "Vertex", "Horizon",
    "Nexus", "Atlas", "Summit", "Zenith", "Infinity",
]

# A small, reviewed catalog the generator may get-or-create from when the LLM names
# a common amenity that isn't yet in the admin's Facility library. Bounded on purpose -
# see plan doc §"Amenity resolution" for why this isn't "create anything the LLM names".
SEED_FACILITY_CATALOG: Dict[str, str] = {
    "Projector": "Equipment",
    "TV/Display": "Equipment",
    "Whiteboard": "Furniture",
    "Video Conferencing Unit": "Equipment",
    "Coffee Machine": "Facilities",
    "Water Dispenser": "Facilities",
    "Meeting Table": "Furniture",
    "Round Table": "Furniture",
    "Chairs": "Furniture",
    "Camera": "Equipment",
    "Microphone": "Equipment",
    "Speaker": "Equipment",
    "Charging Station": "Equipment",
}

# Table variants - never placed more than one per room, and swapped for the shape-
# appropriate variant (see expand_furniture) rather than trusting the LLM to pick
# the "right" one for a shape it may not reason carefully about.
_TABLE_NAMES = {"Meeting Table", "Round Table"}
_MAX_VISIBLE_CHAIRS = 8  # representative seating, not literal one-marker-per-seat

_DOOR_SIZE = 24.0
_WINDOW_THICKNESS = 10.0
_AMENITY_MARKER_SIZE = 30.0
_EDGE_TOLERANCE = 15.0  # how close to a canvas edge counts as "exterior wall"


def classify_room(capacity: int) -> Tuple[str, Optional[str]]:
    """Capacity -> (room_type, size_tier), per the spec's bracket table. Authoritative -
    the LLM's own room_type intuition (it isn't even asked for one) is never trusted,
    which makes "room type must match capacity" structurally impossible to violate
    rather than merely validated."""
    if capacity <= 4:
        return "MEETING_ROOM", "SMALL"
    if capacity <= 8:
        return "MEETING_ROOM", "MEDIUM"
    if capacity <= 15:
        return "MEETING_ROOM", "LARGE"
    return "CONFERENCE_ROOM", None


def place_door(x: float, y: float, width: float, height: float, side: str) -> dict:
    """A DOOR item straddling the middle of the chosen wall, so it reads as an
    opening rather than a floating rectangle inside/outside the room."""
    if side == "NORTH":
        return dict(x=x + width / 2 - _DOOR_SIZE / 2, y=y - _DOOR_SIZE / 4, width=_DOOR_SIZE, height=_DOOR_SIZE / 2, rotation=0)
    if side == "SOUTH":
        return dict(x=x + width / 2 - _DOOR_SIZE / 2, y=y + height - _DOOR_SIZE / 4, width=_DOOR_SIZE, height=_DOOR_SIZE / 2, rotation=0)
    if side == "WEST":
        return dict(x=x - _DOOR_SIZE / 4, y=y + height / 2 - _DOOR_SIZE / 2, width=_DOOR_SIZE / 2, height=_DOOR_SIZE, rotation=0)
    return dict(x=x + width - _DOOR_SIZE / 4, y=y + height / 2 - _DOOR_SIZE / 2, width=_DOOR_SIZE / 2, height=_DOOR_SIZE, rotation=0)  # EAST


def place_window(x: float, y: float, width: float, height: float, canvas_width: float, canvas_height: float) -> Optional[dict]:
    """Only returns a WINDOW spec if the room actually touches a canvas edge -
    makes "windows where appropriate" (spec item 2) mechanically true instead of
    merely trusted. Returns None otherwise (caller emits a warning and drops it)."""
    if x <= _EDGE_TOLERANCE:
        return dict(x=x - _WINDOW_THICKNESS / 2, y=y + height * 0.25, width=_WINDOW_THICKNESS, height=height * 0.5, rotation=0)
    if y <= _EDGE_TOLERANCE:
        return dict(x=x + width * 0.25, y=y - _WINDOW_THICKNESS / 2, width=width * 0.5, height=_WINDOW_THICKNESS, rotation=0)
    if x + width >= canvas_width - _EDGE_TOLERANCE:
        return dict(x=x + width - _WINDOW_THICKNESS / 2, y=y + height * 0.25, width=_WINDOW_THICKNESS, height=height * 0.5, rotation=0)
    if y + height >= canvas_height - _EDGE_TOLERANCE:
        return dict(x=x + width * 0.25, y=y + height - _WINDOW_THICKNESS / 2, width=width * 0.5, height=_WINDOW_THICKNESS, rotation=0)
    return None


def expand_furniture(amenities: List[str], capacity: int, shape: str) -> List[str]:
    """Turns the LLM's flat amenity-name list into the actual list of furniture
    markers to place, applying two shape/capacity-aware rules the LLM is not trusted
    to get right on its own:

    1. At most one table, and its variant matches the room's geometry (a Round Table
       for CIRCLE/OVAL rooms even if the model said "Meeting Table", and vice versa) -
       "furniture follows room shape", not whatever word the model happened to use.
       A capacity-1 room gets no table at all (a compact single workstation instead,
       matching "Focus -> compact workstation").
    2. "Chairs" expands into one marker per seat, capped at _MAX_VISIBLE_CHAIRS - a
       representative arrangement rather than literal one-icon-per-seat, which would
       clutter a 20-person conference room's canvas footprint.
    """
    has_table = any(a in _TABLE_NAMES for a in amenities)
    has_chairs = any(a.strip().lower() == "chairs" for a in amenities)
    rest = [a for a in amenities if a not in _TABLE_NAMES and a.strip().lower() != "chairs"]

    result: List[str] = []
    if has_table and capacity > 1:
        result.append("Round Table" if shape in ("CIRCLE", "OVAL") else "Meeting Table")
    if has_chairs:
        result.extend(["Chairs"] * max(1, min(capacity, _MAX_VISIBLE_CHAIRS)))
    result.extend(rest)
    return result


def place_furniture_rectangular(x: float, y: float, width: float, height: float, names: List[str]) -> List[dict]:
    """Grid/linear layout: the table (if any) gets its own centered row near the top,
    everything else wraps in a grid below it - "Rectangle -> grid/linear furniture"."""
    markers: List[dict] = []
    rest = list(names)
    if rest and rest[0] in _TABLE_NAMES:
        table_size = min(width * 0.5, height * 0.35, 70)
        markers.append(dict(x=x + width / 2 - table_size / 2, y=y + 10, width=table_size, height=table_size * 0.5, rotation=0))
        rest = rest[1:]
        grid_top = y + 10 + table_size * 0.5 + 10
    else:
        grid_top = y + 8

    per_row = max(1, int(width // (_AMENITY_MARKER_SIZE + 6)))
    for i, _name in enumerate(rest):
        row, col = divmod(i, per_row)
        mx = x + 8 + col * (_AMENITY_MARKER_SIZE + 6)
        my = grid_top + row * (_AMENITY_MARKER_SIZE + 6)
        markers.append(dict(x=mx, y=my, width=_AMENITY_MARKER_SIZE, height=_AMENITY_MARKER_SIZE, rotation=0))
    return markers


def place_furniture_radial(x: float, y: float, width: float, height: float, names: List[str]) -> List[dict]:
    """Radial layout for CIRCLE/OVAL rooms: a table at the center, everything else
    (chairs and equipment alike) spaced evenly around it on a ring inset from the
    room's boundary - "furniture follows the circular geometry"."""
    cx, cy = x + width / 2, y + height / 2
    markers: List[dict] = []
    rest = list(names)
    if rest and rest[0] in _TABLE_NAMES:
        table_w, table_h = width * 0.35, height * 0.35
        markers.append(dict(x=cx - table_w / 2, y=cy - table_h / 2, width=table_w, height=table_h, rotation=0))
        rest = rest[1:]

    n = len(rest)
    if n == 0:
        return markers
    radius_x = width / 2 - _AMENITY_MARKER_SIZE * 0.9
    radius_y = height / 2 - _AMENITY_MARKER_SIZE * 0.9
    for i in range(n):
        angle = (2 * math.pi * i) / n - math.pi / 2  # start at the top, go clockwise
        mx = cx + radius_x * math.cos(angle) - _AMENITY_MARKER_SIZE / 2
        my = cy + radius_y * math.sin(angle) - _AMENITY_MARKER_SIZE / 2
        markers.append(dict(x=mx, y=my, width=_AMENITY_MARKER_SIZE, height=_AMENITY_MARKER_SIZE, rotation=0))
    return markers


def place_furniture_l_shape(x: float, y: float, width: float, height: float, names: List[str]) -> List[dict]:
    """Segmented layout for L_SHAPE rooms: the table + most furniture goes in the
    main arm, remaining equipment in the secondary arm - matching the L polygon
    FloorPlanCanvas.tsx already renders (full box minus the top-right quadrant, see
    that file's ItemShape) so nothing is ever placed in the cut-out notch."""
    main_w, main_h = width * 0.6, height
    secondary_x, secondary_y, secondary_w, secondary_h = x + width * 0.6, y + height * 0.4, width * 0.4, height * 0.6

    if not names:
        return []
    split = 1 if names[0] in _TABLE_NAMES else 0
    split = max(split, (len(names) + 1) // 2)
    main_names, secondary_names = names[:split], names[split:]

    markers = place_furniture_rectangular(x, y, main_w, main_h, main_names)
    markers += place_furniture_rectangular(secondary_x, secondary_y, secondary_w, secondary_h, secondary_names)
    return markers


def place_furniture(spec_shape: str, x: float, y: float, width: float, height: float, names: List[str]) -> List[dict]:
    """Dispatches to the shape-aware layout - the single entry point _flatten_children
    uses, so adding a new shape later means adding one branch here."""
    if spec_shape in ("CIRCLE", "OVAL"):
        return place_furniture_radial(x, y, width, height, names)
    if spec_shape == "L_SHAPE":
        return place_furniture_l_shape(x, y, width, height, names)
    return place_furniture_rectangular(x, y, width, height, names)


async def resolve_amenity(
    db: AsyncSession, name: str, existing_by_lower: Dict[str, Facility]
) -> Tuple[Optional[UUID], Optional[str]]:
    """(facility_id, warning). Prefers a real library match; falls back to
    get-or-create from the fixed SEED_FACILITY_CATALOG; otherwise drops the
    amenity with a warning rather than fabricating an arbitrary new facility."""
    key = name.strip().lower()
    if not key:
        return None, None
    existing = existing_by_lower.get(key)
    if existing:
        return existing.id, None

    seed_match = next((n for n in SEED_FACILITY_CATALOG if n.lower() == key), None)
    if not seed_match:
        return None, f"'{name}' is not a recognized facility - add it to the Facility Library first."

    try:
        facility = Facility(name=seed_match, category=SEED_FACILITY_CATALOG[seed_match])
        db.add(facility)
        await db.flush()
    except IntegrityError:
        # Concurrent generation requests both tried to seed the same catalog entry -
        # Facility.name is unique, so re-select the row the other request just created.
        await db.rollback()
        result = await db.execute(select(Facility).where(Facility.name == seed_match))
        facility = result.scalar_one()
    existing_by_lower[key] = facility
    return facility.id, None


def _build_prompt(
    floor: Floor,
    request: GenerateRoomsRequest,
    existing_items: List[FloorLayoutItem],
    available_names: List[str],
    amenity_vocabulary: List[str],
) -> str:
    existing_desc = "\n".join(
        f"- {it.item_type.value} '{it.label or ''}' at x={it.x:.0f}, y={it.y:.0f}, "
        f"width={it.width:.0f}, height={it.height:.0f}"
        for it in existing_items
    ) or "(none - the floor is currently empty)"

    lines = [
        "You are designing new meeting/conference rooms for one floor of an office "
        "workspace-booking application. Respond only with the structured room list "
        "requested - do not invent fields outside the schema.",
        "",
        f"Floor canvas size: {floor.canvas_width:.0f} x {floor.canvas_height:.0f} (arbitrary units, "
        "origin top-left). Every proposed room's bounding box must stay fully within "
        "these bounds and must not overlap any existing item listed below.",
        "",
        "Existing items already on this floor (avoid overlapping these):",
        existing_desc,
        "",
        f"Room names already in use on this floor: {', '.join(available_names) or '(none)'}. "
        f"Choose professional, distinct names from this pool, skipping any already in use: "
        f"{', '.join(PROFESSIONAL_ROOM_NAMES)}. Do not use generic names like 'Meeting Room 1' "
        "unless every name in the pool is already taken.",
        "",
        f"Amenities you may request per room (choose only from this list, by exact name): "
        f"{', '.join(amenity_vocabulary)}.",
        "",
        "Requirements:",
    ]
    if request.meeting_room_count is not None:
        lines.append(f"- Meeting rooms needed: {request.meeting_room_count}")
    if request.conference_room_count is not None:
        lines.append(f"- Conference rooms needed: {request.conference_room_count}")
    if request.available_area_sqft is not None:
        lines.append(f"- Approximate available area: {request.available_area_sqft} sq ft (soft sizing guidance only)")
    if request.capacity_min is not None or request.capacity_max is not None:
        lines.append(f"- Preferred capacity range: {request.capacity_min or '?'} to {request.capacity_max or '?'} people")
    if request.required_amenities:
        lines.append(f"- Required amenities: {', '.join(request.required_amenities)}")
    if request.style:
        lines.append(f"- Preferred style: {request.style}")
    if request.nl_request:
        lines.append(f"- Admin's own description: \"{request.nl_request}\"")

    lines.append(
        "\nUse capacity brackets to guide room sizing (1-4 small, 5-8 medium, 9-15 large "
        "meeting rooms; 16+ conference rooms) - larger capacity needs a larger footprint."
    )
    lines.append(
        "\nAvailable shapes: RECTANGLE, SQUARE, CIRCLE, OVAL, L_SHAPE. For CIRCLE/OVAL rooms, "
        "width and height should be close to equal (a circle needs width ~= height; an oval "
        "can be wider than tall). Favor a realistic mixture of shapes across rooms rather than "
        "making every room a rectangle - circular rooms suit huddle/collaboration/brainstorm "
        "purposes, ovals suit larger special-purpose or executive rooms, and L_SHAPE suits a "
        "larger training/multi-purpose room. Furniture layout inside each room is handled "
        "automatically based on the shape you choose - just pick amenities, not positions for them."
    )

    if request.regenerate_room_name and request.pending_rooms:
        others = "\n".join(
            f"- '{r.name}' at x={r.x:.0f}, y={r.y:.0f}, width={r.width:.0f}, height={r.height:.0f}"
            for r in request.pending_rooms if r.name != request.regenerate_room_name
        )
        lines.append(
            f"\nThis is a single-room regeneration. Replace only the room named "
            f"'{request.regenerate_room_name}'. These other rooms are already decided - "
            f"do not overlap them:\n{others or '(none)'}\nReturn exactly one room."
        )

    return "\n".join(lines)


def _flatten_children(spec: GeneratedRoomSpec, room_id: UUID, resolved_furniture: List[Tuple[str, UUID]]) -> List[FloorLayoutItemCreate]:
    """DOOR (always) + one FACILITY marker per resolved furniture item, laid out by
    `place_furniture` according to the room's shape (§"Furniture Must Follow Room
    Shape"). WINDOW placement needs the floor's canvas bounds, so the caller
    (generate_rooms_for_floor) appends it separately after calling this."""
    children: List[FloorLayoutItemCreate] = []

    door_geom = place_door(spec.x, spec.y, spec.width, spec.height, spec.door_side)
    children.append(FloorLayoutItemCreate(
        id=uuid4(), item_type="DOOR", parent_item_id=room_id,
        label="Door", shape="RECTANGLE", z_index=2, **door_geom,
    ))

    names = [name for name, _fid in resolved_furniture]
    markers = place_furniture(spec.shape, spec.x, spec.y, spec.width, spec.height, names)
    for (name, fid), marker in zip(resolved_furniture, markers):
        children.append(FloorLayoutItemCreate(
            id=uuid4(), item_type="FACILITY", parent_item_id=room_id,
            label=name, shape="RECTANGLE", z_index=3,
            properties={"facility_id": str(fid)}, **marker,
        ))

    return children


async def validate_proposed_rooms(
    proposed: List[ProposedRoomBundle],
    existing_items: List[FloorLayoutItem],
    canvas_width: float,
    canvas_height: float,
    existing_room_names: set,
    existing_room_numbers: set,
) -> List[GenerationValidationIssue]:
    issues: List[GenerationValidationIssue] = []
    existing_aabbs = [
        (it.id, rotated_aabb(it.x, it.y, it.width, it.height, it.rotation or 0))
        for it in existing_items
        # SEAT included - a proposed room must not silently swallow someone's existing
        # desk, not just avoid other rooms/zones/walls.
        if it.item_type in (FloorLayoutItemType.ROOM, FloorLayoutItemType.ZONE, FloorLayoutItemType.WALL, FloorLayoutItemType.SEAT)
    ]

    seen_names: Dict[str, bool] = {}
    seen_numbers: Dict[str, bool] = {}
    proposed_aabbs = []

    for bundle in proposed:
        spec = bundle.spec
        room = bundle.room
        aabb = rotated_aabb(room.x, room.y, room.width, room.height, room.rotation or 0)
        proposed_aabbs.append((room.id, aabb))

        min_x, min_y, max_x, max_y = aabb
        if min_x < -0.01 or min_y < -0.01 or max_x > canvas_width + 0.01 or max_y > canvas_height + 0.01:
            issues.append(GenerationValidationIssue(item_id=room.id, severity="error",
                          message=f"'{spec.name}' is placed outside the floor boundary."))

        if room.width <= 0 or room.height <= 0:
            issues.append(GenerationValidationIssue(item_id=room.id, severity="error",
                          message=f"'{spec.name}' has an invalid width/height."))

        if spec.capacity <= 0:
            issues.append(GenerationValidationIssue(item_id=room.id, severity="error",
                          message=f"'{spec.name}' has an invalid capacity."))
        elif spec.capacity > 200:
            issues.append(GenerationValidationIssue(item_id=room.id, severity="warning",
                          message=f"'{spec.name}' has an unusually large capacity ({spec.capacity}) - verify."))

        name_key = spec.name.strip().lower()
        number_key = spec.room_number.strip().lower()
        if name_key in existing_room_names or name_key in seen_names:
            issues.append(GenerationValidationIssue(item_id=room.id, severity="error",
                          message=f"Duplicate room name '{spec.name}'."))
        else:
            seen_names[name_key] = True
        if number_key and (number_key in existing_room_numbers or number_key in seen_numbers):
            issues.append(GenerationValidationIssue(item_id=room.id, severity="error",
                          message=f"Duplicate room number '{spec.room_number}'."))
        else:
            seen_numbers[number_key] = True

        if not any(c.item_type == "DOOR" for c in bundle.children):
            issues.append(GenerationValidationIssue(item_id=room.id, severity="error",
                          message=f"'{spec.name}' has no door."))

        for other_id, other_aabb in existing_aabbs:
            if aabb_overlap(aabb, other_aabb):
                issues.append(GenerationValidationIssue(item_id=room.id, severity="warning",
                              message=f"'{spec.name}' overlaps an existing item on this floor."))
                break

    for i in range(len(proposed_aabbs)):
        for j in range(i + 1, len(proposed_aabbs)):
            if aabb_overlap(proposed_aabbs[i][1], proposed_aabbs[j][1]):
                issues.append(GenerationValidationIssue(
                    item_id=proposed_aabbs[i][0], severity="warning",
                    message=f"'{proposed[i].spec.name}' overlaps proposed room '{proposed[j].spec.name}'.",
                ))

    return issues


async def generate_rooms_for_floor(
    db: AsyncSession,
    floor: Floor,
    request: GenerateRoomsRequest,
    admin: User,
) -> GenerateRoomsResponse:
    draft_result = await db.execute(
        select(FloorLayoutItem).where(FloorLayoutItem.floor_id == floor.id, FloorLayoutItem.is_draft == True)
    )
    existing_items = list(draft_result.scalars().all())

    facility_result = await db.execute(select(Facility))
    existing_facilities = list(facility_result.scalars().all())
    existing_by_lower = {f.name.strip().lower(): f for f in existing_facilities}

    existing_room_names = set()
    existing_room_numbers = set()
    for it in existing_items:
        if it.item_type == FloorLayoutItemType.ROOM:
            props = it.properties or {}
            if props.get("name"):
                existing_room_names.add(str(props["name"]).strip().lower())
            if props.get("room_number"):
                existing_room_numbers.add(str(props["room_number"]).strip().lower())

    amenity_vocabulary = sorted(set(SEED_FACILITY_CATALOG.keys()) | {f.name for f in existing_facilities})
    available_names = sorted(existing_room_names)

    prompt = _build_prompt(floor, request, existing_items, available_names, amenity_vocabulary)

    model = get_model()
    # method="function_calling" (not the newer default "json_schema") because OpenRouter
    # proxies plain tool/function calling far more broadly across non-native-OpenAI models
    # than OpenAI's strict Structured Output response_format - the same reliability
    # tradeoff already documented for the chat agent's tool-calling loop.
    plan: GeneratedRoomsPlan = await model.with_structured_output(
        GeneratedRoomsPlan, method="function_calling"
    ).ainvoke(prompt)

    bundles: List[ProposedRoomBundle] = []
    issues: List[GenerationValidationIssue] = []
    for spec in plan.rooms:
        room_id = uuid4()
        room_type, size_tier = classify_room(spec.capacity)

        furniture_names = expand_furniture(spec.amenities, spec.capacity, spec.shape)
        resolved_furniture: List[Tuple[str, UUID]] = []
        for name in furniture_names:
            fid, warning = await resolve_amenity(db, name, existing_by_lower)
            if fid:
                resolved_furniture.append((name, fid))
            if warning:
                issues.append(GenerationValidationIssue(item_id=room_id, severity="warning", message=warning))
        await db.commit()

        room_item = FloorLayoutItemCreate(
            id=room_id, item_type="ROOM", label=spec.name,
            x=spec.x, y=spec.y, width=spec.width, height=spec.height,
            rotation=spec.rotation, shape=spec.shape, z_index=0,
            properties={
                "name": spec.name, "room_number": spec.room_number,
                "room_type": room_type, "capacity": spec.capacity,
                "size_tier": size_tier, "price_per_hour": None,
            },
        )

        children = _flatten_children(spec, room_id, resolved_furniture)

        if spec.has_window:
            window_geom = place_window(spec.x, spec.y, spec.width, spec.height, floor.canvas_width, floor.canvas_height)
            if window_geom:
                children.append(FloorLayoutItemCreate(
                    id=uuid4(), item_type="WINDOW", parent_item_id=room_id,
                    label="Window", shape="RECTANGLE", z_index=2, **window_geom,
                ))
            else:
                issues.append(GenerationValidationIssue(
                    item_id=room_id, severity="warning",
                    message=f"'{spec.name}' isn't adjacent to an exterior wall - window omitted.",
                ))

        # Zone assignment: does the room's center fall inside an existing ZONE item?
        cx, cy = spec.x + spec.width / 2, spec.y + spec.height / 2
        zone_item_id = None
        for it in existing_items:
            if it.item_type != FloorLayoutItemType.ZONE:
                continue
            if it.x <= cx <= it.x + it.width and it.y <= cy <= it.y + it.height:
                zone_item_id = it.id
                break
        room_item.zone_item_id = zone_item_id

        bundle = ProposedRoomBundle(spec=spec, room=room_item, children=children)
        bundles.append(bundle)

    issues.extend(await validate_proposed_rooms(
        bundles, existing_items, floor.canvas_width, floor.canvas_height,
        existing_room_names, existing_room_numbers,
    ))

    return GenerateRoomsResponse(rooms=bundles, issues=issues, notes=plan.notes)
