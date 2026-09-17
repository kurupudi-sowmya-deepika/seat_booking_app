import enum
from datetime import datetime

from sqlalchemy import String, Float, ForeignKey, Integer, Boolean, JSON, Enum, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class FloorLayoutItemType(str, enum.Enum):
    SEAT = "SEAT"
    ROOM = "ROOM"
    ZONE = "ZONE"
    WALL = "WALL"
    DOOR = "DOOR"
    WINDOW = "WINDOW"
    FACILITY = "FACILITY"


class LayoutShape(str, enum.Enum):
    RECTANGLE = "RECTANGLE"
    SQUARE = "SQUARE"
    CIRCLE = "CIRCLE"
    OVAL = "OVAL"
    L_SHAPE = "L_SHAPE"
    CUSTOM = "CUSTOM"


class Floor(BaseModel):
    """A physical floor within a Branch ("Building" in the admin UI - Branch already
    models a physical office, see floor_plans.py for why no separate Building entity
    was introduced). Distinct from the pre-existing `Room.floor` int column, which is
    left untouched for backward compatibility with the existing booking UI."""
    __tablename__ = "floors"

    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    name: Mapped[str] = mapped_column(String)
    floor_number: Mapped[int] = mapped_column(Integer, default=0)
    canvas_width: Mapped[float] = mapped_column(Float, default=1200.0)
    canvas_height: Mapped[float] = mapped_column(Float, default=800.0)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")

    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(nullable=True)
    # True whenever the draft layout differs from what's currently published (or nothing
    # has ever been published yet) - drives the dashboard's "unpublished changes" badge.
    has_draft_changes: Mapped[bool] = mapped_column(Boolean, default=True)

    branch = relationship("Branch")
    items = relationship(
        "FloorLayoutItem", back_populates="floor",
        cascade="all, delete-orphan", foreign_keys="FloorLayoutItem.floor_id"
    )


class FloorLayoutItem(BaseModel):
    """One placeable object on a floor plan - a seat, room, zone, wall, door, window,
    or facility. Unified single-table design (rather than a table per object type)
    so the whole canvas is one query, z-ordering/multi-select/undo-redo are trivial,
    and adding a new placeable type later doesn't require a new table.

    Draft/publish duality: `is_draft=True` rows are what the admin edits; `is_draft=False`
    rows are the immutable snapshot employees see. Real `Seat`/`Room` business rows are
    only created/updated/deleted when a floor is published (see floor_plans.py's publish
    endpoint) - a draft SEAT/ROOM item stages its business fields in `properties` and
    leaves `seat_id`/`room_id` null until then, so an in-progress edit can never leak into
    live booking before the admin explicitly publishes it.
    """
    __tablename__ = "floor_layout_items"

    floor_id: Mapped[str] = mapped_column(ForeignKey("floors.id"))
    item_type: Mapped[FloorLayoutItemType] = mapped_column(Enum(FloorLayoutItemType))
    is_draft: Mapped[bool] = mapped_column(Boolean, default=True)

    # Self-referencing FKs (no ORM relationship() defined for these three - plain
    # columns queried directly - to avoid SQLAlchemy ambiguous-foreign-key resolution
    # across three separate self-referencing paths on the same table).
    published_counterpart_id: Mapped[str | None] = mapped_column(ForeignKey("floor_layout_items.id"), nullable=True)
    parent_item_id: Mapped[str | None] = mapped_column(ForeignKey("floor_layout_items.id"), nullable=True)
    zone_item_id: Mapped[str | None] = mapped_column(ForeignKey("floor_layout_items.id"), nullable=True)

    seat_id: Mapped[str | None] = mapped_column(ForeignKey("seats.id"), nullable=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"), nullable=True)

    label: Mapped[str | None] = mapped_column(String, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)

    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[float] = mapped_column(Float, default=60.0)
    height: Mapped[float] = mapped_column(Float, default=60.0)
    rotation: Mapped[float] = mapped_column(Float, default=0.0)
    shape: Mapped[LayoutShape] = mapped_column(Enum(LayoutShape), default=LayoutShape.RECTANGLE)
    z_index: Mapped[int] = mapped_column(Integer, default=0)
    # Visual height for the isometric render only (FloorPlanCanvas.tsx mode="isometric") -
    # has no effect on 2D edit/view/preview, on validation, or on the real Seat/Room rows.
    elevation: Mapped[float] = mapped_column(Float, default=0.0)

    # Type-specific staged/extra fields - see module docstring for the shape per item_type.
    properties: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    floor = relationship("Floor", back_populates="items", foreign_keys=[floor_id])
    seat = relationship("Seat")
    room = relationship("Room")

    __table_args__ = (
        CheckConstraint("seat_id IS NULL OR item_type = 'SEAT'", name="ck_floor_item_seat_requires_seat_type"),
        CheckConstraint("room_id IS NULL OR item_type = 'ROOM'", name="ck_floor_item_room_requires_room_type"),
        Index("ix_floor_layout_items_floor_id", "floor_id"),
        Index("ix_floor_layout_items_parent_item_id", "parent_item_id"),
        Index("ix_floor_layout_items_floor_draft", "floor_id", "is_draft"),
    )
