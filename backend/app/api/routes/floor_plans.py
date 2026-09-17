"""Admin Floor-Plan Management.

Core invariant enforced throughout this file: a DRAFT `FloorLayoutItem` never
implies a real, bookable `Seat`/`Room` row exists. Real business rows are only
created/updated/deleted inside `publish_floor()`. This is what makes "employees
only ever see the Published version" true rather than aspirational - see
app/models/floor_plan.py's module docstring for the full rationale.

SEAT items always nest under a ROOM item via `parent_item_id` (mirroring the
existing `Seat.room_id` FK, which is mandatory on the Seat model and predates
this feature) - the editor is expected to auto-create/reuse a default "Open
Workspace" ROOM item covering the floor the first time a seat is added, so an
admin placing individual desks isn't forced to think about "rooms" explicitly.
"""
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_admin, get_current_user
from app.db.database import get_db
from app.models.floor_plan import Floor, FloorLayoutItem, FloorLayoutItemType, LayoutShape
from app.models.location import Branch, Facility, Room, Seat
from app.models.user import User
from app.utils.geometry import aabb_overlap, rotated_aabb
from app.schemas.floor_plan import (
    FloorCreate,
    FloorDashboardStats,
    FloorLayoutItemCreate,
    FloorLayoutItemResponse,
    FloorLayoutSaveRequest,
    FloorLayoutSaveResponse,
    FloorPublishResponse,
    FloorResponse,
    FloorUpdate,
    PublishedFloorLayoutItem,
    PublishedFloorResponse,
    ValidationIssue,
)

router = APIRouter()

# Seat statuses that count as "still bookable" for dashboard/canvas display purposes
# (bookings.py's availability query additionally accepts "AVAILABLE" as a synonym for
# the pre-existing "ACTIVE" - see that file for the one-line, additive change).
_BOOKABLE_SEAT_STATUSES = ("ACTIVE", "AVAILABLE")


# ----------------- Validation helpers -----------------

def _contains(outer: tuple, inner: tuple, tolerance: float = 0.5) -> bool:
    """True if AABB `inner` sits fully inside AABB `outer` (with a small tolerance
    for floating-point/snap rounding)."""
    return (
        inner[0] >= outer[0] - tolerance and inner[1] >= outer[1] - tolerance
        and inner[2] <= outer[2] + tolerance and inner[3] <= outer[3] + tolerance
    )


def _validate_items(items: List[FloorLayoutItemCreate], canvas_width: float, canvas_height: float) -> List[ValidationIssue]:
    """Requirement 10: bounds + duplicate-number/name + overlap/containment validation,
    scoped to the items being saved together (this floor's draft) - not a blanket
    DB-wide constraint, since no such constraint exists on the pre-existing,
    unconstrained Seat/Room tables today."""
    issues: List[ValidationIssue] = []
    seen_seat_numbers: Dict[str, bool] = {}
    seen_room_numbers: Dict[str, bool] = {}
    seen_room_names: Dict[str, bool] = {}
    seat_aabbs: List[tuple] = []   # (item, aabb) - collected for the overlap pass below
    room_aabbs_by_id: Dict[UUID, tuple] = {}

    for item in items:
        min_x, min_y, max_x, max_y = rotated_aabb(item.x, item.y, item.width, item.height, item.rotation or 0)
        if min_x < -0.01 or min_y < -0.01 or max_x > canvas_width + 0.01 or max_y > canvas_height + 0.01:
            issues.append(ValidationIssue(
                item_id=item.id,
                message=f"'{item.label or item.item_type}' is placed outside the floor boundary."
            ))

        props = item.properties or {}
        if item.item_type == "SEAT":
            if not item.parent_item_id:
                issues.append(ValidationIssue(item_id=item.id, message="Seat must be placed inside a workspace room area."))
            seat_number = str(props.get("seat_number") or "").strip()
            if not seat_number:
                issues.append(ValidationIssue(item_id=item.id, message="Seat is missing a seat number."))
            elif seat_number in seen_seat_numbers:
                issues.append(ValidationIssue(item_id=item.id, message=f"Duplicate seat number '{seat_number}' on this floor."))
            else:
                seen_seat_numbers[seat_number] = True
            seat_aabbs.append((item, (min_x, min_y, max_x, max_y)))
        elif item.item_type == "ROOM":
            room_number = str(props.get("room_number") or "").strip()
            if room_number:
                if room_number in seen_room_numbers:
                    issues.append(ValidationIssue(item_id=item.id, message=f"Duplicate room number '{room_number}' on this floor."))
                else:
                    seen_room_numbers[room_number] = True
            room_name = str(props.get("name") or "").strip()
            if room_name:
                if room_name.lower() in seen_room_names:
                    issues.append(ValidationIssue(item_id=item.id, message=f"Duplicate room name '{room_name}' on this floor."))
                else:
                    seen_room_names[room_name.lower()] = True
            if item.id is not None:
                room_aabbs_by_id[item.id] = (min_x, min_y, max_x, max_y)

    # Seat-vs-seat overlap: two desks can never legitimately occupy the same space.
    for i in range(len(seat_aabbs)):
        seat_a, aabb_a = seat_aabbs[i]
        for j in range(i + 1, len(seat_aabbs)):
            seat_b, aabb_b = seat_aabbs[j]
            if aabb_overlap(aabb_a, aabb_b):
                issues.append(ValidationIssue(
                    item_id=seat_a.id,
                    message=f"Seat '{(seat_a.properties or {}).get('seat_number', '')}' overlaps seat '{(seat_b.properties or {}).get('seat_number', '')}'."
                ))

    # Seats outside allowed areas: a seat's footprint must sit fully inside its own
    # parent room's footprint (not just avoid other rooms) - nesting via parent_item_id
    # is how a seat is logically assigned to a room in the first place.
    for seat, seat_aabb in seat_aabbs:
        if not seat.parent_item_id:
            continue
        parent_aabb = room_aabbs_by_id.get(seat.parent_item_id)
        if parent_aabb and not _contains(parent_aabb, seat_aabb):
            issues.append(ValidationIssue(
                item_id=seat.id,
                message=f"Seat '{(seat.properties or {}).get('seat_number', '')}' is placed outside its room's boundary."
            ))

    return issues


def _to_create_schema(item: FloorLayoutItem) -> FloorLayoutItemCreate:
    """Round-trip a persisted FloorLayoutItem back into its Create schema, for
    re-validating the current draft state at publish time (defense in depth - the
    frontend already gates Publish on a successful Save, but state could have moved
    since, e.g. a concurrent admin edit)."""
    return FloorLayoutItemCreate(
        id=item.id,
        item_type=item.item_type.value,
        parent_item_id=item.parent_item_id,
        zone_item_id=item.zone_item_id,
        label=item.label,
        color=item.color,
        x=item.x, y=item.y, width=item.width, height=item.height,
        rotation=item.rotation, shape=item.shape.value, z_index=item.z_index,
        elevation=item.elevation, properties=item.properties,
    )


async def _get_floor_or_404(db: AsyncSession, floor_id: UUID) -> Floor:
    floor = await db.get(Floor, floor_id)
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    return floor


# ----------------- Floors: dashboard + CRUD -----------------

@router.get("/floors", response_model=List[FloorDashboardStats])
async def list_floors(
    branch_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Floor).options(selectinload(Floor.items)).order_by(Floor.floor_number.asc())
    if branch_id:
        query = query.where(Floor.branch_id == branch_id)
    floors = (await db.execute(query)).scalars().unique().all()

    branch_ids = {f.branch_id for f in floors}
    branches = {}
    if branch_ids:
        b_res = await db.execute(select(Branch).where(Branch.id.in_(branch_ids)))
        branches = {str(b.id): b.name for b in b_res.scalars().all()}

    results = []
    for floor in floors:
        published_items = [i for i in floor.items if not i.is_draft]
        seat_ids = [i.seat_id for i in published_items if i.item_type == FloorLayoutItemType.SEAT and i.seat_id]
        available_seats = 0
        if seat_ids:
            seat_res = await db.execute(
                select(func.count(Seat.id)).where(Seat.id.in_(seat_ids), Seat.status.in_(_BOOKABLE_SEAT_STATUSES))
            )
            available_seats = seat_res.scalar_one()

        results.append(FloorDashboardStats(
            id=floor.id, branch_id=floor.branch_id, name=floor.name, floor_number=floor.floor_number,
            canvas_width=floor.canvas_width, canvas_height=floor.canvas_height, status=floor.status,
            created_by=floor.created_by, updated_by=floor.updated_by, published_by=floor.published_by,
            published_at=floor.published_at, has_draft_changes=floor.has_draft_changes,
            created_at=floor.created_at, updated_at=floor.updated_at,
            branch_name=branches.get(str(floor.branch_id), "Unknown"),
            total_seats=len(seat_ids),
            available_seats=available_seats,
            # Only count actual meeting/conference rooms, not the auto-created default
            # "Open Workspace" WORKSPACE-type room that holds directly-placed seats.
            meeting_rooms=len([
                i for i in published_items
                if i.item_type == FloorLayoutItemType.ROOM and (i.properties or {}).get("room_type") in ("MEETING_ROOM", "CONFERENCE_ROOM")
            ]),
            facilities_count=len([i for i in published_items if i.item_type == FloorLayoutItemType.FACILITY]),
        ))
    return results


@router.post("/floors", response_model=FloorResponse)
async def create_floor(
    floor_in: FloorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    floor = Floor(**floor_in.model_dump(), created_by=current_user.id, updated_by=current_user.id)
    db.add(floor)
    await db.commit()
    await db.refresh(floor)
    return floor


@router.put("/floors/{floor_id}", response_model=FloorResponse)
async def update_floor(
    floor_id: UUID,
    floor_in: FloorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    floor = await _get_floor_or_404(db, floor_id)
    for field, value in floor_in.model_dump(exclude_unset=True).items():
        setattr(floor, field, value)
    floor.updated_by = current_user.id
    await db.commit()
    await db.refresh(floor)
    return floor


@router.delete("/floors/{floor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_floor(
    floor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    floor = await _get_floor_or_404(db, floor_id)
    published_count = (await db.execute(
        select(func.count(FloorLayoutItem.id)).where(FloorLayoutItem.floor_id == floor_id, FloorLayoutItem.is_draft == False)
    )).scalar_one()
    if published_count > 0:
        raise HTTPException(status_code=400, detail="This floor has been published and has live seats/rooms - deactivate it instead of deleting.")
    await db.delete(floor)
    await db.commit()


@router.post("/floors/{floor_id}/duplicate", response_model=FloorResponse)
async def duplicate_floor(
    floor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    source = await _get_floor_or_404(db, floor_id)
    new_floor = Floor(
        branch_id=source.branch_id,
        name=f"{source.name} (Copy)",
        floor_number=source.floor_number,
        canvas_width=source.canvas_width,
        canvas_height=source.canvas_height,
        status="ACTIVE",
        created_by=current_user.id,
        updated_by=current_user.id,
        has_draft_changes=True,
    )
    db.add(new_floor)
    await db.flush()

    draft_items = (await db.execute(
        select(FloorLayoutItem).where(FloorLayoutItem.floor_id == floor_id, FloorLayoutItem.is_draft == True)
    )).scalars().all()

    # Two passes: insert copies first (fresh ids, never-materialized business links),
    # then remap parent/zone references onto the new copies' ids.
    id_map: Dict[UUID, UUID] = {}
    new_items = []
    for src in draft_items:
        copy = FloorLayoutItem(
            floor_id=new_floor.id, item_type=src.item_type, is_draft=True,
            label=src.label, color=src.color, x=src.x, y=src.y, width=src.width, height=src.height,
            rotation=src.rotation, shape=src.shape, z_index=src.z_index, properties=src.properties,
        )
        db.add(copy)
        new_items.append((src, copy))
    await db.flush()
    for src, copy in new_items:
        id_map[src.id] = copy.id
    for src, copy in new_items:
        if src.parent_item_id in id_map:
            copy.parent_item_id = id_map[src.parent_item_id]
        if src.zone_item_id in id_map:
            copy.zone_item_id = id_map[src.zone_item_id]

    await db.commit()
    await db.refresh(new_floor)
    return new_floor


# ----------------- Layout: get / save -----------------

@router.get("/floors/{floor_id}/layout", response_model=List[FloorLayoutItemResponse])
async def get_floor_layout(
    floor_id: UUID,
    draft: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_floor_or_404(db, floor_id)
    items = (await db.execute(
        select(FloorLayoutItem).where(FloorLayoutItem.floor_id == floor_id, FloorLayoutItem.is_draft == draft)
    )).scalars().all()
    return items


@router.post("/floors/{floor_id}/save", response_model=FloorLayoutSaveResponse)
async def save_floor_layout(
    floor_id: UUID,
    payload: FloorLayoutSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """Requirement 10: the whole draft layout is saved together, after validation.
    Existing rows (item has a real `id` already in the DB) are updated in place -
    preserving `published_counterpart_id`/`seat_id`/`room_id` so a later publish can
    tell "already published, needs updating" apart from "brand new". Rows that exist
    in the DB but are absent from the payload were deleted by the admin in this
    session and are removed here too."""
    floor = await _get_floor_or_404(db, floor_id)

    issues = _validate_items(payload.items, floor.canvas_width, floor.canvas_height)
    if issues:
        return FloorLayoutSaveResponse(success=False, issues=issues)

    existing = (await db.execute(
        select(FloorLayoutItem).where(FloorLayoutItem.floor_id == floor_id, FloorLayoutItem.is_draft == True)
    )).scalars().all()
    existing_by_id = {item.id: item for item in existing}
    incoming_ids = {item.id for item in payload.items if item.id is not None}

    # Delete rows the admin removed in the editor.
    for item_id, item in existing_by_id.items():
        if item_id not in incoming_ids:
            await db.delete(item)
    await db.flush()

    saved: List[FloorLayoutItem] = []
    for item_in in payload.items:
        if item_in.id and item_in.id in existing_by_id:
            row = existing_by_id[item_in.id]
            row.item_type = FloorLayoutItemType(item_in.item_type)
            row.parent_item_id = item_in.parent_item_id
            row.zone_item_id = item_in.zone_item_id
            row.label = item_in.label
            row.color = item_in.color
            row.x, row.y = item_in.x, item_in.y
            row.width, row.height = item_in.width, item_in.height
            row.rotation = item_in.rotation or 0
            row.shape = LayoutShape(item_in.shape or "RECTANGLE")
            row.z_index = item_in.z_index or 0
            row.elevation = item_in.elevation or 0.0
            row.properties = item_in.properties
        else:
            row = FloorLayoutItem(
                id=item_in.id, floor_id=floor_id, is_draft=True,
                item_type=FloorLayoutItemType(item_in.item_type),
                parent_item_id=item_in.parent_item_id, zone_item_id=item_in.zone_item_id,
                label=item_in.label, color=item_in.color,
                x=item_in.x, y=item_in.y, width=item_in.width, height=item_in.height,
                rotation=item_in.rotation or 0, shape=LayoutShape(item_in.shape or "RECTANGLE"),
                z_index=item_in.z_index or 0, elevation=item_in.elevation or 0.0, properties=item_in.properties,
            )
            db.add(row)
        saved.append(row)

    floor.has_draft_changes = True
    floor.updated_by = current_user.id
    await db.commit()
    for row in saved:
        await db.refresh(row)

    return FloorLayoutSaveResponse(success=True, items=saved)


# ----------------- Publish -----------------

async def _ensure_default_workspace_room(db: AsyncSession, floor: Floor, draft_items: List[FloorLayoutItem]) -> Optional[FloorLayoutItem]:
    """Seats with no explicit parent ROOM item are not expected in practice - the
    editor auto-creates/reuses a default 'Open Workspace' ROOM item covering the
    floor the moment the first seat is added - but this is a defensive fallback so
    publish never crashes if that invariant is somehow violated."""
    for item in draft_items:
        if item.item_type == FloorLayoutItemType.ROOM and (item.properties or {}).get("is_default_workspace"):
            return item
    return None


@router.post("/floors/{floor_id}/publish", response_model=FloorPublishResponse)
async def publish_floor(
    floor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    floor = await _get_floor_or_404(db, floor_id)

    draft_items = (await db.execute(
        select(FloorLayoutItem).where(FloorLayoutItem.floor_id == floor_id, FloorLayoutItem.is_draft == True)
    )).scalars().all()
    published_items = (await db.execute(
        select(FloorLayoutItem).where(FloorLayoutItem.floor_id == floor_id, FloorLayoutItem.is_draft == False)
    )).scalars().all()

    # Re-validate the current draft state (defense in depth against drift since the last /save).
    issues = _validate_items([_to_create_schema(d) for d in draft_items], floor.canvas_width, floor.canvas_height)
    if issues:
        return FloorPublishResponse(success=False, issues=issues)

    draft_by_id = {d.id: d for d in draft_items}
    claimed_published_ids = {d.published_counterpart_id for d in draft_items if d.published_counterpart_id}

    # Step 1: remove published items whose draft counterpart was deleted.
    for pub in published_items:
        if pub.id in claimed_published_ids:
            continue
        # Capture display info before any DB work, in case we need it after a rollback
        # (ORM attribute access on `pub` after rollback triggers a lazy-reload that
        # fails outside the current transaction/greenlet context).
        pub_id, pub_label = pub.id, (pub.label or pub.item_type.value)
        try:
            # Delete the referencing FloorLayoutItem row FIRST - it has FKs to
            # seats.id/rooms.id, so it must go before the row it points to, not after.
            seat_id, room_id = pub.seat_id, pub.room_id
            await db.delete(pub)
            await db.flush()
            if pub.item_type == FloorLayoutItemType.SEAT and seat_id:
                seat = await db.get(Seat, seat_id)
                if seat:
                    await db.delete(seat)
                    await db.flush()
            elif pub.item_type == FloorLayoutItemType.ROOM and room_id:
                room = await db.get(Room, room_id)
                if room:
                    await db.delete(room)
                    await db.flush()
        except IntegrityError:
            await db.rollback()
            return FloorPublishResponse(success=False, issues=[ValidationIssue(
                item_id=pub_id,
                message=f"Cannot remove '{pub_label}' - it has existing booking history. Deactivate it instead of deleting, then publish again."
            )])

    # Step 2: materialize/update in dependency order - ROOM before SEAT (seats need
    # their parent room's real room_id), everything else has no business row at all.
    draft_to_published: Dict[UUID, FloorLayoutItem] = {}

    def _mirror_fields(dst: FloorLayoutItem, src: FloorLayoutItem):
        dst.label, dst.color = src.label, src.color
        dst.x, dst.y, dst.width, dst.height = src.x, src.y, src.width, src.height
        dst.rotation, dst.shape, dst.z_index = src.rotation, src.shape, src.z_index
        dst.elevation = src.elevation

    room_items = [d for d in draft_items if d.item_type == FloorLayoutItemType.ROOM]
    seat_items = [d for d in draft_items if d.item_type == FloorLayoutItemType.SEAT]
    other_items = [d for d in draft_items if d.item_type not in (FloorLayoutItemType.ROOM, FloorLayoutItemType.SEAT)]

    for draft in room_items:
        props = draft.properties or {}
        if draft.room_id is None:
            room = Room(
                branch_id=floor.branch_id,
                name=props.get("name") or draft.label or "Room",
                room_number=props.get("room_number"),
                room_type=props.get("room_type", "WORKSPACE"),
                capacity=props.get("capacity", 1),
                floor=floor.floor_number,
                price_per_hour=props.get("price_per_hour"),
                status="ACTIVE",
            )
            db.add(room)
            await db.flush()
            draft.room_id = room.id
        else:
            room = await db.get(Room, draft.room_id)
            if room:
                room.name = props.get("name") or draft.label or room.name
                room.room_number = props.get("room_number", room.room_number)
                room.room_type = props.get("room_type", room.room_type)
                room.capacity = props.get("capacity", room.capacity)
                room.price_per_hour = props.get("price_per_hour", room.price_per_hour)

        if draft.published_counterpart_id and draft.published_counterpart_id in {p.id for p in published_items}:
            pub = next(p for p in published_items if p.id == draft.published_counterpart_id)
            _mirror_fields(pub, draft)
            pub.room_id = draft.room_id
        else:
            pub = FloorLayoutItem(
                floor_id=floor_id, item_type=FloorLayoutItemType.ROOM, is_draft=False,
                room_id=draft.room_id, properties=draft.properties,
            )
            _mirror_fields(pub, draft)
            db.add(pub)
            await db.flush()
            draft.published_counterpart_id = pub.id
        draft_to_published[draft.id] = pub

    for draft in seat_items:
        props = draft.properties or {}
        parent_pub_room_id = None
        if draft.parent_item_id and draft.parent_item_id in draft_to_published:
            parent_pub_room_id = draft_to_published[draft.parent_item_id].room_id
        if not parent_pub_room_id:
            # Defensive fallback: reuse whatever room the draft was last published against.
            existing_pub = next((p for p in published_items if p.id == draft.published_counterpart_id), None)
            parent_pub_room_id = existing_pub.room_id if existing_pub else None
        if not parent_pub_room_id:
            return FloorPublishResponse(success=False, issues=[ValidationIssue(
                item_id=draft.id, message=f"Seat '{props.get('seat_number', '')}' has no workspace room to belong to."
            )])

        if draft.seat_id is None:
            seat = Seat(
                room_id=parent_pub_room_id,
                seat_number=str(props.get("seat_number")),
                seat_type=props.get("seat_type", "STANDARD"),
                status=props.get("status", "AVAILABLE"),
                price=props.get("price", 0),
            )
            db.add(seat)
            await db.flush()
            draft.seat_id = seat.id
        else:
            seat = await db.get(Seat, draft.seat_id)
            if seat:
                seat.room_id = parent_pub_room_id
                seat.seat_number = str(props.get("seat_number", seat.seat_number))
                seat.seat_type = props.get("seat_type", seat.seat_type)
                seat.status = props.get("status", seat.status)
                seat.price = props.get("price", seat.price)

        if draft.published_counterpart_id and draft.published_counterpart_id in {p.id for p in published_items}:
            pub = next(p for p in published_items if p.id == draft.published_counterpart_id)
            _mirror_fields(pub, draft)
            pub.seat_id = draft.seat_id
            pub.parent_item_id = draft_to_published.get(draft.parent_item_id, pub).id if draft.parent_item_id in draft_to_published else pub.parent_item_id
        else:
            pub = FloorLayoutItem(
                floor_id=floor_id, item_type=FloorLayoutItemType.SEAT, is_draft=False,
                seat_id=draft.seat_id, properties=draft.properties,
                parent_item_id=draft_to_published.get(draft.parent_item_id).id if draft.parent_item_id in draft_to_published else None,
            )
            _mirror_fields(pub, draft)
            db.add(pub)
            await db.flush()
            draft.published_counterpart_id = pub.id
        draft_to_published[draft.id] = pub

    # ZONE/WALL/DOOR/WINDOW/FACILITY: purely visual (FACILITY may reference a Facility
    # library row via properties.facility_id, but that's a read-only reference, not a
    # row this module owns) - just mirror position/shape, no Seat/Room involved.
    for draft in other_items:
        parent_pub_id = draft_to_published[draft.parent_item_id].id if draft.parent_item_id in draft_to_published else draft.parent_item_id
        zone_pub_id = draft_to_published[draft.zone_item_id].id if draft.zone_item_id in draft_to_published else draft.zone_item_id
        if draft.published_counterpart_id and draft.published_counterpart_id in {p.id for p in published_items}:
            pub = next(p for p in published_items if p.id == draft.published_counterpart_id)
            _mirror_fields(pub, draft)
            pub.properties = draft.properties
            pub.parent_item_id = parent_pub_id
            pub.zone_item_id = zone_pub_id
        else:
            pub = FloorLayoutItem(
                floor_id=floor_id, item_type=draft.item_type, is_draft=False,
                properties=draft.properties, parent_item_id=parent_pub_id, zone_item_id=zone_pub_id,
            )
            _mirror_fields(pub, draft)
            db.add(pub)
            await db.flush()
            draft.published_counterpart_id = pub.id
        draft_to_published[draft.id] = pub

    # Fix up zone_item_id on ROOM/SEAT published mirrors now that all published ids exist.
    for draft in room_items + seat_items:
        if draft.zone_item_id and draft.zone_item_id in draft_to_published:
            draft_to_published[draft.id].zone_item_id = draft_to_published[draft.zone_item_id].id

    # Sync Room.facilities (existing M2M, already read by RoomCard/AmenityBadge) from
    # each room's child FACILITY items, so the visual room-internal editor and the
    # existing amenity-badge UI never diverge.
    for draft in room_items:
        room = await db.get(Room, draft.room_id) if draft.room_id else None
        if not room:
            continue
        child_facility_ids = [
            (d.properties or {}).get("facility_id")
            for d in other_items
            if d.item_type == FloorLayoutItemType.FACILITY and d.parent_item_id == draft.id
        ]
        child_facility_ids = [fid for fid in child_facility_ids if fid]
        if child_facility_ids:
            fac_res = await db.execute(select(Facility).where(Facility.id.in_(child_facility_ids)))
            room_full = (await db.execute(
                select(Room).options(selectinload(Room.facilities)).where(Room.id == room.id)
            )).scalar_one()
            room_full.facilities = list(fac_res.scalars().all())

    floor.published_by = current_user.id
    floor.updated_by = current_user.id
    floor.has_draft_changes = False
    from datetime import datetime as _dt
    floor.published_at = _dt.utcnow()

    await db.commit()
    await db.refresh(floor)
    return FloorPublishResponse(success=True, floor=floor)


# ----------------- Published read (employee-facing) -----------------

@router.get("/floors/{floor_id}/published", response_model=PublishedFloorResponse)
async def get_published_floor(
    floor_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    floor = await _get_floor_or_404(db, floor_id)
    items = (await db.execute(
        select(FloorLayoutItem).where(FloorLayoutItem.floor_id == floor_id, FloorLayoutItem.is_draft == False)
    )).scalars().all()

    seat_ids = [i.seat_id for i in items if i.seat_id]
    room_ids = [i.room_id for i in items if i.room_id]
    seats_by_id = {}
    rooms_by_id = {}
    if seat_ids:
        seats_by_id = {s.id: s for s in (await db.execute(select(Seat).where(Seat.id.in_(seat_ids)))).scalars().all()}
    if room_ids:
        rooms_by_id = {r.id: r for r in (await db.execute(select(Room).where(Room.id.in_(room_ids)))).scalars().all()}

    enriched = []
    for item in items:
        extra = {}
        if item.seat_id and item.seat_id in seats_by_id:
            seat = seats_by_id[item.seat_id]
            extra = {
                "seat_number": seat.seat_number, "seat_type": seat.seat_type,
                "price": float(seat.price), "seat_status": seat.status,
            }
        elif item.room_id and item.room_id in rooms_by_id:
            room = rooms_by_id[item.room_id]
            extra = {
                "room_name": room.name, "room_number": room.room_number,
                "room_type": room.room_type, "capacity": room.capacity,
                "price_per_hour": float(room.price_per_hour) if room.price_per_hour is not None else None,
            }
        enriched.append(PublishedFloorLayoutItem(
            id=item.id, floor_id=item.floor_id, is_draft=item.is_draft,
            published_counterpart_id=item.published_counterpart_id,
            seat_id=item.seat_id, room_id=item.room_id,
            item_type=item.item_type.value, parent_item_id=item.parent_item_id, zone_item_id=item.zone_item_id,
            label=item.label, color=item.color, x=item.x, y=item.y, width=item.width, height=item.height,
            rotation=item.rotation, shape=item.shape.value, z_index=item.z_index, elevation=item.elevation,
            properties=item.properties,
            created_at=item.created_at, updated_at=item.updated_at,
            **extra,
        ))

    return PublishedFloorResponse(floor=floor, items=enriched)
