"""Add elevation to floor_layout_items (isometric floor-plan visual depth)

Revision ID: 00009
Revises: 00008
Create Date: 2026-09-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '00009'
down_revision: Union[str, Sequence[str], None] = '00008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Visual height used only by the isometric render (see FloorPlanCanvas.tsx) -
    # purely additive, defaults to 0 so every existing item renders flat until an
    # admin raises it, with zero effect on the existing 2D edit/view/preview modes.
    item_columns = [c['name'] for c in inspector.get_columns('floor_layout_items')]
    if 'elevation' not in item_columns:
        op.add_column(
            'floor_layout_items',
            sa.Column('elevation', sa.Float(), nullable=False, server_default='0')
        )


def downgrade() -> None:
    op.drop_column('floor_layout_items', 'elevation')
