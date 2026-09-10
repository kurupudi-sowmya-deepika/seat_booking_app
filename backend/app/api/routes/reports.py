import io
import csv
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import date, datetime, timedelta

from app.db.database import get_db
from app.models.booking import Booking, BookingStatus, BookingType
from app.models.location import Location, Branch, Room, Seat, DayPass
from app.models.user import User
from app.models.wallet import CreditTransaction
from app.api.deps import get_current_admin

router = APIRouter()

@router.get("/revenue")
async def get_revenue_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    branch_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    if not end_date: end_date = date.today()
    if not start_date: start_date = end_date - timedelta(days=30)

    query = select(Booking).options(
        selectinload(Booking.branch),
        selectinload(Booking.location)
    ).where(
        and_(
            Booking.booking_date >= start_date,
            Booking.booking_date <= end_date,
            Booking.status == BookingStatus.CONFIRMED
        )
    )
    if branch_id:
        query = query.where(Booking.branch_id == branch_id)

    res = await db.execute(query)
    bookings = res.scalars().all()

    total_revenue = sum(float(b.amount) for b in bookings)
    total_bookings = len(bookings)

    # Breakdown by booking type
    by_type = {
        "SEAT": {"count": 0, "revenue": 0.0},
        "DAY_PASS": {"count": 0, "revenue": 0.0},
        "MEETING_ROOM": {"count": 0, "revenue": 0.0},
        "CONFERENCE_ROOM": {"count": 0, "revenue": 0.0},
    }
    for b in bookings:
        btype = str(b.booking_type).split(".")[-1]
        if btype in by_type:
            by_type[btype]["count"] += 1
            by_type[btype]["revenue"] += float(b.amount)

    # Breakdown by branch
    by_branch: Dict[str, Dict[str, Any]] = {}
    for b in bookings:
        b_name = b.branch.name if b.branch else "Unknown Branch"
        if b_name not in by_branch:
            by_branch[b_name] = {"count": 0, "revenue": 0.0}
        by_branch[b_name]["count"] += 1
        by_branch[b_name]["revenue"] += float(b.amount)

    # 7-day daily trend
    daily_trend = []
    curr = start_date
    while curr <= end_date:
        day_bookings = [b for b in bookings if b.booking_date == curr]
        daily_trend.append({
            "date": curr.strftime("%Y-%m-%d"),
            "revenue": sum(float(b.amount) for b in day_bookings),
            "bookings": len(day_bookings)
        })
        curr += timedelta(days=1)

    return {
        "start_date": str(start_date),
        "end_date": str(end_date),
        "total_revenue": round(total_revenue, 2),
        "total_confirmed_bookings": total_bookings,
        "average_booking_value": round(total_revenue / max(1, total_bookings), 2),
        "breakdown_by_type": by_type,
        "breakdown_by_branch": by_branch,
        "daily_trend": daily_trend
    }

@router.get("/occupancy")
async def get_occupancy_report(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    today = date.today()
    
    total_seats = (await db.execute(select(func.count(Seat.id)).where(Seat.status == "ACTIVE"))).scalar_one()
    today_seats_booked = (await db.execute(
        select(func.count(Booking.id)).where(
            and_(
                Booking.booking_date == today,
                Booking.seat_id.isnot(None),
                Booking.status == BookingStatus.CONFIRMED
            )
        )
    )).scalar_one()

    total_rooms = (await db.execute(select(func.count(Room.id)).where(Room.status == "ACTIVE"))).scalar_one()
    today_rooms_booked = (await db.execute(
        select(func.count(Booking.id)).where(
            and_(
                Booking.booking_date == today,
                Booking.room_id.isnot(None),
                Booking.status == BookingStatus.CONFIRMED
            )
        )
    )).scalar_one()

    # Branch-wise utilization
    branches = (await db.execute(select(Branch).where(Branch.status == "ACTIVE"))).scalars().all()
    branch_stats = []
    for br in branches:
        br_seats = (await db.execute(select(func.count(Seat.id)).join(Room).where(Room.branch_id == br.id))).scalar_one()
        br_booked = (await db.execute(
            select(func.count(Booking.id)).where(
                and_(
                    Booking.branch_id == br.id,
                    Booking.booking_date == today,
                    Booking.status == BookingStatus.CONFIRMED
                )
            )
        )).scalar_one()
        rate = round((br_booked / max(1, br_seats)) * 100, 1) if br_seats > 0 else 0
        branch_stats.append({
            "branch_id": str(br.id),
            "branch_name": br.name,
            "total_desks": br_seats,
            "booked_today": br_booked,
            "utilization_rate": rate
        })

    return {
        "report_date": str(today),
        "overall_seat_occupancy": round((today_seats_booked / max(1, total_seats)) * 100, 1),
        "overall_room_utilization": round((today_rooms_booked / max(1, total_rooms)) * 100, 1),
        "total_seats": total_seats,
        "today_seats_booked": today_seats_booked,
        "total_rooms": total_rooms,
        "today_rooms_booked": today_rooms_booked,
        "branch_breakdown": branch_stats
    }

@router.get("/export")
async def export_bookings_csv(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = select(Booking).options(
        selectinload(Booking.user),
        selectinload(Booking.branch),
        selectinload(Booking.location),
        selectinload(Booking.room),
        selectinload(Booking.seat),
        selectinload(Booking.time_slot)
    )
    if start_date:
        query = query.where(Booking.booking_date >= start_date)
    if end_date:
        query = query.where(Booking.booking_date <= end_date)
        
    query = query.order_by(Booking.booking_date.desc())
    res = await db.execute(query)
    bookings = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Booking ID", "Date", "Booking Type", "Status", "Amount (INR)",
        "User Name", "User Email", "Location", "Branch", "Room", "Seat", "Time Window", "Created At"
    ])

    for b in bookings:
        slot = f"{b.start_time}-{b.end_time}" if b.start_time else (f"{b.time_slot.start_time}-{b.time_slot.end_time}" if b.time_slot else "Full Day")
        writer.writerow([
            str(b.id),
            str(b.booking_date),
            str(b.booking_type),
            str(b.status),
            float(b.amount),
            b.user.name if b.user else "N/A",
            b.user.email if b.user else "N/A",
            b.location.name if b.location else "N/A",
            b.branch.name if b.branch else "N/A",
            b.room.name if b.room else "N/A",
            b.seat.seat_number if b.seat else "N/A",
            slot,
            b.created_at.strftime("%Y-%m-%d %H:%M:%S") if b.created_at else "N/A"
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="seatsync_revenue_report_{date.today()}.csv"'}
    )
