"""Add meeting title, purpose, and participant emails to bookings

Revision ID: 00005
Revises: 00004
Create Date: 2026-09-10 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '00005'
down_revision: Union[str, Sequence[str], None] = '00004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('title', sa.String(), nullable=True))
    op.add_column('bookings', sa.Column('purpose', sa.String(), nullable=True))
    op.add_column('bookings', sa.Column('participant_emails', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('bookings', 'participant_emails')
    op.drop_column('bookings', 'purpose')
    op.drop_column('bookings', 'title')
