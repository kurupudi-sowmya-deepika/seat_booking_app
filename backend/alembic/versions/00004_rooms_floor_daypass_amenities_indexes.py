"""Add room floor, day pass amenities, and booking search indexes

Revision ID: 00004
Revises: 00003
Create Date: 2026-09-10 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '00004'
down_revision: Union[str, Sequence[str], None] = '00003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('rooms', sa.Column('floor', sa.Integer(), nullable=True))
    op.add_column('day_passes', sa.Column('amenities', sa.JSON(), nullable=True))
    op.create_index('ix_bookings_user_id', 'bookings', ['user_id'], if_not_exists=True)
    op.create_index('ix_bookings_location_id', 'bookings', ['location_id'], if_not_exists=True)
    op.create_index('ix_bookings_branch_id', 'bookings', ['branch_id'], if_not_exists=True)
    op.create_index('ix_bookings_room_id', 'bookings', ['room_id'], if_not_exists=True)
    op.create_index('ix_bookings_booking_date', 'bookings', ['booking_date'], if_not_exists=True)
    op.create_index('ix_bookings_start_time', 'bookings', ['start_time'], if_not_exists=True)
    op.create_index('ix_bookings_end_time', 'bookings', ['end_time'], if_not_exists=True)
    op.create_index('ix_users_email', 'users', ['email'], if_not_exists=True)


def downgrade() -> None:
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_bookings_end_time', table_name='bookings')
    op.drop_index('ix_bookings_start_time', table_name='bookings')
    op.drop_index('ix_bookings_booking_date', table_name='bookings')
    op.drop_index('ix_bookings_room_id', table_name='bookings')
    op.drop_index('ix_bookings_branch_id', table_name='bookings')
    op.drop_index('ix_bookings_location_id', table_name='bookings')
    op.drop_index('ix_bookings_user_id', table_name='bookings')
    op.drop_column('day_passes', 'amenities')
    op.drop_column('rooms', 'floor')
