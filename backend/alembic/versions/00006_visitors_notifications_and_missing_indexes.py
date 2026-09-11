"""Create visitors/notifications tables (never captured by a migration) and add missing indexes

Revision ID: 00006
Revises: 00005
Create Date: 2026-09-10 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '00006'
down_revision: Union[str, Sequence[str], None] = '00005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # These two tables were already in use (SQLAlchemy models + working API routes) but
    # were never captured by a migration - on a fresh database `alembic upgrade head`
    # would leave them missing entirely. Guarded with has_table so this migration is
    # also safe to run on a database (like this one) where they already exist.
    if 'visitors' not in existing_tables:
        op.create_table(
            'visitors',
            sa.Column('host_user_id', sa.UUID(), nullable=False),
            sa.Column('branch_id', sa.UUID(), nullable=False),
            sa.Column('visitor_name', sa.String(), nullable=False),
            sa.Column('visitor_email', sa.String(), nullable=False),
            sa.Column('visitor_phone', sa.String(), nullable=True),
            sa.Column('purpose', sa.String(), nullable=False),
            sa.Column('visit_date', sa.Date(), nullable=False),
            sa.Column('expected_arrival_time', sa.Time(), nullable=True),
            sa.Column('check_in_time', sa.DateTime(), nullable=True),
            sa.Column('check_out_time', sa.DateTime(), nullable=True),
            sa.Column('status', sa.Enum('PENDING', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', name='visitorstatus'), nullable=False),
            sa.Column('notes', sa.String(), nullable=True),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
            sa.ForeignKeyConstraint(['host_user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    if 'notifications' not in existing_tables:
        op.create_table(
            'notifications',
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('title', sa.String(), nullable=False),
            sa.Column('message', sa.String(), nullable=False),
            sa.Column('type', sa.Enum(
                'BOOKING_CONFIRMATION', 'BOOKING_MODIFIED', 'BOOKING_REMINDER', 'BOOKING_CANCELLED',
                'BOOKING_EXTENDED', 'VISITOR_ARRIVED', 'WALLET_CREDIT', 'SYSTEM', name='notificationtype'
            ), nullable=False),
            sa.Column('reference_id', sa.String(), nullable=True),
            sa.Column('is_read', sa.Boolean(), nullable=False),
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    # Indexes for columns that are filtered/joined on frequently but were never indexed.
    op.create_index('ix_visitors_host_user_id', 'visitors', ['host_user_id'], if_not_exists=True)
    op.create_index('ix_visitors_branch_id', 'visitors', ['branch_id'], if_not_exists=True)
    op.create_index('ix_visitors_status', 'visitors', ['status'], if_not_exists=True)
    op.create_index('ix_visitors_visit_date', 'visitors', ['visit_date'], if_not_exists=True)
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'], if_not_exists=True)
    op.create_index('ix_bookings_status', 'bookings', ['status'], if_not_exists=True)
    op.create_index('ix_bookings_day_pass_id', 'bookings', ['day_pass_id'], if_not_exists=True)
    op.create_index('ix_credit_transactions_user_id', 'credit_transactions', ['user_id'], if_not_exists=True)
    op.create_index('ix_credit_transactions_reference_id', 'credit_transactions', ['reference_id'], if_not_exists=True)

    # Idempotency guard: a Stripe webhook can be delivered more than once for the same
    # payment_intent/session. The app already checks for an existing row before inserting,
    # but that check-then-insert has a race under concurrent deliveries; this constraint
    # makes double-crediting impossible at the database level. Scoped to STRIPE_TOPUP only
    # (via a partial index) because other reference_types legitimately reuse the same
    # reference_id across multiple rows (e.g. BOOKING_MODIFY / BOOKING_EXTEND per booking).
    op.create_index(
        'ix_unique_stripe_topup_reference',
        'credit_transactions',
        ['reference_id'],
        unique=True,
        if_not_exists=True,
        postgresql_where=sa.text("reference_type = 'STRIPE_TOPUP'")
    )


def downgrade() -> None:
    op.drop_index('ix_unique_stripe_topup_reference', table_name='credit_transactions', postgresql_where=sa.text("reference_type = 'STRIPE_TOPUP'"))
    op.drop_index('ix_credit_transactions_reference_id', table_name='credit_transactions')
    op.drop_index('ix_credit_transactions_user_id', table_name='credit_transactions')
    op.drop_index('ix_bookings_day_pass_id', table_name='bookings')
    op.drop_index('ix_bookings_status', table_name='bookings')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_index('ix_visitors_visit_date', table_name='visitors')
    op.drop_index('ix_visitors_status', table_name='visitors')
    op.drop_index('ix_visitors_branch_id', table_name='visitors')
    op.drop_index('ix_visitors_host_user_id', table_name='visitors')
    # Table drops are intentionally omitted: since this migration may not have created
    # them (if they pre-existed), dropping here on downgrade could destroy live data
    # created before this migration was ever applied.
