"""Add floor plan management (floors, floor_layout_items) + room_number/facility category

Revision ID: 00008
Revises: 00007
Create Date: 2026-09-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '00008'
down_revision: Union[str, Sequence[str], None] = '00007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'floors' not in existing_tables:
        op.create_table(
            'floors',
            sa.Column('branch_id', sa.UUID(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('floor_number', sa.Integer(), nullable=False),
            sa.Column('canvas_width', sa.Float(), nullable=False),
            sa.Column('canvas_height', sa.Float(), nullable=False),
            sa.Column('status', sa.String(), nullable=False),
            sa.Column('created_by', sa.UUID(), nullable=True),
            sa.Column('updated_by', sa.UUID(), nullable=True),
            sa.Column('published_by', sa.UUID(), nullable=True),
            sa.Column('published_at', sa.DateTime(), nullable=True),
            # True whenever the draft differs from what's published (or nothing has
            # published yet) - drives the admin dashboard's "unpublished changes" badge.
            sa.Column('has_draft_changes', sa.Boolean(), nullable=False),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['branch_id'], ['branches.id']),
            sa.ForeignKeyConstraint(['created_by'], ['users.id']),
            sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
            sa.ForeignKeyConstraint(['published_by'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )

    if 'floor_layout_items' not in existing_tables:
        # Single unified table for every placeable object (seat/room/zone/wall/door/
        # window/facility) - see app/models/floor_plan.py for the full rationale
        # (one query for the whole canvas, trivial z-ordering/undo-redo, no table
        # explosion for what are really just "shapes with different semantics").
        op.create_table(
            'floor_layout_items',
            sa.Column('floor_id', sa.UUID(), nullable=False),
            sa.Column('item_type', sa.Enum(
                'SEAT', 'ROOM', 'ZONE', 'WALL', 'DOOR', 'WINDOW', 'FACILITY',
                name='floorlayoutitemtype'
            ), nullable=False),
            sa.Column('is_draft', sa.Boolean(), nullable=False),
            # Self-referencing FKs: on a draft row, published_counterpart_id points to its
            # published mirror once first published; parent_item_id nests a FACILITY under
            # a ROOM for the room-internal layout editor; zone_item_id is an explicit (not
            # geometrically computed) zone assignment for SEAT/ROOM items.
            sa.Column('published_counterpart_id', sa.UUID(), nullable=True),
            sa.Column('parent_item_id', sa.UUID(), nullable=True),
            sa.Column('zone_item_id', sa.UUID(), nullable=True),
            # Real business-entity links - null while item_type=SEAT/ROOM and still only a
            # draft (see model docstring: nothing is materialized until publish).
            sa.Column('seat_id', sa.UUID(), nullable=True),
            sa.Column('room_id', sa.UUID(), nullable=True),
            sa.Column('label', sa.String(), nullable=True),
            sa.Column('color', sa.String(), nullable=True),
            sa.Column('x', sa.Float(), nullable=False),
            sa.Column('y', sa.Float(), nullable=False),
            sa.Column('width', sa.Float(), nullable=False),
            sa.Column('height', sa.Float(), nullable=False),
            sa.Column('rotation', sa.Float(), nullable=False),
            sa.Column('shape', sa.Enum(
                'RECTANGLE', 'SQUARE', 'CIRCLE', 'OVAL', 'L_SHAPE', 'CUSTOM',
                name='layoutshape'
            ), nullable=False),
            sa.Column('z_index', sa.Integer(), nullable=False),
            # Type-specific staged/extra fields (seat_number/price/etc for SEAT while in
            # draft, capacity/room_number/etc for ROOM, description for ZONE, facility_id
            # reference for FACILITY) - see app/models/floor_plan.py for the exact shape.
            sa.Column('properties', sa.JSON(), nullable=True),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['floor_id'], ['floors.id']),
            sa.ForeignKeyConstraint(['published_counterpart_id'], ['floor_layout_items.id']),
            sa.ForeignKeyConstraint(['parent_item_id'], ['floor_layout_items.id']),
            sa.ForeignKeyConstraint(['zone_item_id'], ['floor_layout_items.id']),
            sa.ForeignKeyConstraint(['seat_id'], ['seats.id']),
            sa.ForeignKeyConstraint(['room_id'], ['rooms.id']),
            sa.PrimaryKeyConstraint('id'),
            # A seat/room reference only makes sense on a row of that same item_type -
            # enforced at the DB, matching this codebase's existing pattern of catching
            # this class of invariant with a constraint rather than only in route code
            # (see ix_unique_active_booking in booking.py).
            sa.CheckConstraint("seat_id IS NULL OR item_type = 'SEAT'", name='ck_floor_item_seat_requires_seat_type'),
            sa.CheckConstraint("room_id IS NULL OR item_type = 'ROOM'", name='ck_floor_item_room_requires_room_type'),
        )

    op.create_index('ix_floor_layout_items_floor_id', 'floor_layout_items', ['floor_id'], if_not_exists=True)
    op.create_index('ix_floor_layout_items_parent_item_id', 'floor_layout_items', ['parent_item_id'], if_not_exists=True)
    op.create_index('ix_floor_layout_items_floor_draft', 'floor_layout_items', ['floor_id', 'is_draft'], if_not_exists=True)

    # Additive, nullable columns - no risk to existing Room/Facility data or the
    # existing admin CRUD screens, which simply never populate them.
    room_columns = [c['name'] for c in inspector.get_columns('rooms')]
    if 'room_number' not in room_columns:
        op.add_column('rooms', sa.Column('room_number', sa.String(), nullable=True))

    facility_columns = [c['name'] for c in inspector.get_columns('facilities')]
    if 'category' not in facility_columns:
        op.add_column('facilities', sa.Column('category', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('facilities', 'category')
    op.drop_column('rooms', 'room_number')
    op.drop_index('ix_floor_layout_items_floor_draft', table_name='floor_layout_items')
    op.drop_index('ix_floor_layout_items_parent_item_id', table_name='floor_layout_items')
    op.drop_index('ix_floor_layout_items_floor_id', table_name='floor_layout_items')
    op.drop_table('floor_layout_items')
    op.drop_table('floors')
    op.execute('DROP TYPE IF EXISTS layoutshape')
    op.execute('DROP TYPE IF EXISTS floorlayoutitemtype')
