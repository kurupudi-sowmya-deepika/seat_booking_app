"""Add system_settings singleton table for Admin > System Settings

Revision ID: 00007
Revises: 00006
Create Date: 2026-09-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '00007'
down_revision: Union[str, Sequence[str], None] = '00006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'system_settings',
        sa.Column('company_name', sa.String(), nullable=False),
        sa.Column('support_email', sa.String(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False),
        sa.Column('max_advance_booking_days', sa.Integer(), nullable=False),
        sa.Column('cancellation_window_hours', sa.Integer(), nullable=False),
        sa.Column('refund_percentage', sa.Integer(), nullable=False),
        sa.Column('enable_entra_id_sso', sa.Boolean(), nullable=False),
        sa.Column('enable_local_auth', sa.Boolean(), nullable=False),
        sa.Column('openai_assistant_enabled', sa.Boolean(), nullable=False),
        sa.Column('daily_reminder_email', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('system_settings')
