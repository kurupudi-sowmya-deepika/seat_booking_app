from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date, datetime, timedelta
from typing import Dict, Any

from app.db.database import get_db
from app.models.user import User
from app.models.location import Location, Branch, Room, Seat, DayPass
from app.models.booking import Booking, BookingStatus
from app.models.wallet import Wallet, CreditTransaction
from app.models.system_settings import SystemSettings
from app.schemas.system_settings import SystemSettingsResponse, SystemSettingsUpdate
from app.api.deps import get_current_admin

router = APIRouter()


async def _get_or_create_settings(db: AsyncSession) -> SystemSettings:
    """There's exactly one settings row app-wide; create it with defaults on
    first access rather than requiring a seed/migration data step."""
    result = await db.execute(select(SystemSettings).order_by(SystemSettings.created_at.asc()).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


@router.get("/settings", response_model=SystemSettingsResponse)
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return await _get_or_create_settings(db)


@router.put("/settings", response_model=SystemSettingsResponse)
async def update_system_settings(
    settings_in: SystemSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    settings = await _get_or_create_settings(db)
    for field, value in settings_in.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    await db.commit()
    await db.refresh(settings)
    return settings

@router.get("/stats")
async def get_admin_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    today = date.today()
    
    # 1. Counts
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_locations = (await db.execute(select(func.count(Location.id)))).scalar_one()
    total_branches = (await db.execute(select(func.count(Branch.id)))).scalar_one()
    total_rooms = (await db.execute(select(func.count(Room.id)))).scalar_one()
    total_seats = (await db.execute(select(func.count(Seat.id)))).scalar_one()
    total_day_passes = (await db.execute(select(func.count(DayPass.id)))).scalar_one()
    
    # 2. Bookings counts
    total_bookings = (await db.execute(select(func.count(Booking.id)))).scalar_one()
    
    today_bookings = (await db.execute(
        select(func.count(Booking.id)).where(Booking.booking_date == today)
    )).scalar_one()
    
    upcoming_bookings = (await db.execute(
        select(func.count(Booking.id)).where(
            and_(Booking.booking_date >= today, Booking.status == BookingStatus.CONFIRMED)
        )
    )).scalar_one()
    
    # 3. Revenue & Wallets
    revenue_res = await db.execute(
        select(func.sum(Booking.amount)).where(Booking.status == BookingStatus.CONFIRMED)
    )
    total_revenue = float(revenue_res.scalar_one() or 0.0)
    
    wallet_credits_res = await db.execute(select(func.sum(Wallet.balance)))
    total_wallet_credits = float(wallet_credits_res.scalar_one() or 0.0)
    
    # 4. Occupancy Rate Estimate
    # active seat bookings today vs total seats
    today_seat_bookings = (await db.execute(
        select(func.count(Booking.id)).where(
            and_(Booking.booking_date == today, Booking.seat_id.isnot(None), Booking.status == BookingStatus.CONFIRMED)
        )
    )).scalar_one()
    occupancy_rate = round((today_seat_bookings / max(1, total_seats)) * 100, 1)

    # 5. Recent 7-day bookings trend (single grouped query instead of one per day)
    range_start = today - timedelta(days=6)
    trend_res = await db.execute(
        select(Booking.booking_date, func.count(Booking.id))
        .where(Booking.booking_date >= range_start, Booking.booking_date <= today)
        .group_by(Booking.booking_date)
    )
    trend_counts = dict(trend_res.all())
    trend = [
        {"date": (range_start + timedelta(days=i)).strftime("%b %d"),
         "bookings": trend_counts.get(range_start + timedelta(days=i), 0)}
        for i in range(7)
    ]

    # 6. Branch distribution (single grouped query instead of one per branch)
    branches_res = await db.execute(select(Branch).limit(5))
    branches = branches_res.scalars().all()
    branch_ids = [b.id for b in branches]
    branch_counts: Dict[Any, int] = {}
    if branch_ids:
        counts_res = await db.execute(
            select(Booking.branch_id, func.count(Booking.id))
            .where(Booking.branch_id.in_(branch_ids))
            .group_by(Booking.branch_id)
        )
        branch_counts = dict(counts_res.all())
    popular_branches = [
        {"name": b.name, "bookings": branch_counts.get(b.id, 0)}
        for b in branches
    ]

    return {
        "total_users": total_users,
        "total_locations": total_locations,
        "total_branches": total_branches,
        "total_rooms": total_rooms,
        "total_seats": total_seats,
        "total_day_passes": total_day_passes,
        "total_bookings": total_bookings,
        "today_bookings": today_bookings,
        "upcoming_bookings": upcoming_bookings,
        "total_revenue": total_revenue,
        "total_wallet_credits": total_wallet_credits,
        "occupancy_rate": occupancy_rate,
        "booking_trends": trend,
        "popular_branches": popular_branches
    }
