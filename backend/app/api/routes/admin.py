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
from app.api.deps import get_current_admin

router = APIRouter()

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

    # 5. Recent 7-day bookings trend
    trend = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        cnt = (await db.execute(
            select(func.count(Booking.id)).where(Booking.booking_date == d)
        )).scalar_one()
        trend.append({
            "date": d.strftime("%b %d"),
            "bookings": cnt
        })

    # 6. Branch distribution
    branches_res = await db.execute(select(Branch).limit(5))
    branches = branches_res.scalars().all()
    popular_branches = []
    for b in branches:
        b_cnt = (await db.execute(
            select(func.count(Booking.id)).where(Booking.branch_id == b.id)
        )).scalar_one()
        popular_branches.append({
            "name": b.name,
            "bookings": b_cnt
        })

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
