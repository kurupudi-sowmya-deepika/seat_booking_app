import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_, String, cast
from sqlalchemy.exc import IntegrityError
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from datetime import date, time, datetime, timedelta

from app.db.database import get_db
from app.models.booking import Booking, BookingStatus, TimeSlot, BookingType
from app.models.location import Seat, DayPass, Room, Branch, Location
from app.models.user import User
from app.models.wallet import Wallet, CreditTransaction, TransactionType
from app.models.notification import Notification, NotificationType
from app.schemas.booking import (
    BookingCreate, BookingResponse, BookingDetailResponse, BookingModifyRequest,
    BookingExtendRequest, SeatAvailability, DayPassAvailability, RoomAvailability, RoomTimelineSlot,
    RoomTimelineResponse, AlternativeResourceResponse, AlternativeResourceOption
)
from app.api.deps import get_current_user, get_current_admin
from app.core.config import settings
from sqlalchemy.orm import selectinload

router = APIRouter()
stripe.api_key = settings.STRIPE_SECRET_KEY

def map_booking_to_detail(b: Booking) -> BookingDetailResponse:
    facilities = []
    if b.room and b.room.facilities:
        facilities = [f.name for f in b.room.facilities]
    
    time_label = None
    if b.time_slot:
        time_label = f"{str(b.time_slot.start_time)[:5]} - {str(b.time_slot.end_time)[:5]}"
    elif b.start_time and b.end_time:
        time_label = f"{str(b.start_time)[:5]} - {str(b.end_time)[:5]}"
        
    return BookingDetailResponse(
        id=b.id,
        user_id=b.user_id,
        booking_type=b.booking_type,
        location_id=b.location_id,
        branch_id=b.branch_id,
        seat_id=b.seat_id,
        day_pass_id=b.day_pass_id,
        room_id=b.room_id,
        booking_date=b.booking_date,
        time_slot_id=b.time_slot_id,
        start_time=b.start_time,
        end_time=b.end_time,
        status=b.status,
        amount=float(b.amount),
        created_at=b.created_at,
        user_name=b.user.name if b.user else None,
        user_email=b.user.email if b.user else None,
        location_name=b.location.name if b.location else None,
        branch_name=b.branch.name if b.branch else None,
        room_name=b.room.name if b.room else None,
        seat_number=b.seat.seat_number if b.seat else None,
        seat_type=b.seat.seat_type if b.seat else None,
        day_pass_name=b.day_pass.name if b.day_pass else None,
        time_slot_label=time_label,
        facilities=facilities,
        amenities=(b.day_pass.amenities if b.day_pass and b.day_pass.amenities else []),
        number_of_people=b.number_of_people or 1,
        additional_users=b.additional_users,
        title=b.title,
        purpose=b.purpose,
        participant_emails=b.participant_emails
    )

async def create_system_notification(
    db: AsyncSession, 
    user_id: UUID, 
    title: str, 
    message: str, 
    notif_type: NotificationType, 
    reference_id: Optional[str] = None
):
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        reference_id=reference_id
    )
    db.add(notif)

# ----------------- Availability Endpoints -----------------

@router.get("/availability/seat", response_model=List[SeatAvailability])
async def get_seat_availability(
    room_id: UUID,
    booking_date: date,
    time_slot_id: Optional[UUID] = None,
    start_time: Optional[time] = None,
    end_time: Optional[time] = None,
    db: AsyncSession = Depends(get_db)
):
    # "AVAILABLE" is accepted alongside the original "ACTIVE" so seats created via the
    # floor-plan editor (whose status options are Available/Disabled/Maintenance) are
    # just as bookable as seats from the older Admin > Seats flow - purely additive.
    seats_result = await db.execute(select(Seat).where(Seat.room_id == room_id, Seat.status.in_(("ACTIVE", "AVAILABLE"))))
    seats = seats_result.scalars().all()
    
    condition = and_(
        Booking.room_id == room_id,
        Booking.booking_date == booking_date,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
    )
    
    if time_slot_id:
        condition = and_(condition, Booking.time_slot_id == time_slot_id)
    elif start_time and end_time:
        condition = and_(
            condition,
            Booking.start_time < end_time,
            Booking.end_time > start_time
        )
    else:
        raise HTTPException(status_code=400, detail="Must provide either time_slot_id or start_time and end_time")
        
    booked_seats_result = await db.execute(select(Booking.seat_id).where(condition))
    booked_seat_ids = set(booked_seats_result.scalars().all())
    
    res = []
    for s in seats:
        res.append(SeatAvailability(
            seat_id=s.id,
            seat_number=s.seat_number,
            seat_type=s.seat_type or "STANDARD",
            price=float(s.price or 150),
            status="BOOKED" if s.id in booked_seat_ids else "AVAILABLE"
        ))
    return res

async def _day_pass_availability(dp: DayPass, booking_date: date, db: AsyncSession) -> DayPassAvailability:
    booked_count = (await db.execute(
        select(func.coalesce(func.sum(Booking.number_of_people), 0)).where(
            and_(
                Booking.day_pass_id == dp.id,
                Booking.booking_date == booking_date,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
            )
        )
    )).scalar_one()
    booked_count = int(booked_count or 0)
    available = max(0, dp.daily_capacity - booked_count)
    return DayPassAvailability(
        day_pass_id=dp.id,
        name=dp.name,
        price=float(dp.price),
        total_capacity=dp.daily_capacity,
        booked_count=booked_count,
        available_capacity=available,
        status="SOLD_OUT" if available == 0 else "AVAILABLE",
        amenities=dp.amenities or [],
        currency="INR"
    )


@router.get("/availability/day-pass", response_model=List[DayPassAvailability])
async def get_day_pass_availability(
    booking_date: date,
    branch_id: Optional[UUID] = None,
    day_pass_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    if not branch_id and not day_pass_id:
        raise HTTPException(status_code=400, detail="Provide branch_id or day_pass_id")

    query = select(DayPass).where(DayPass.status == "ACTIVE")
    if day_pass_id:
        query = query.where(DayPass.id == day_pass_id)
    if branch_id:
        query = query.where(DayPass.branch_id == branch_id)

    passes = (await db.execute(query)).scalars().all()
    if day_pass_id and not passes:
        raise HTTPException(status_code=404, detail="Day Pass not found")
    return [await _day_pass_availability(dp, booking_date, db) for dp in passes]

@router.get("/availability/room", response_model=List[RoomAvailability])
async def get_room_availability(
    branch_id: UUID,
    booking_date: date,
    start_time: time,
    end_time: time,
    db: AsyncSession = Depends(get_db)
):
    rooms_result = await db.execute(
        select(Room).options(
            selectinload(Room.facilities),
            selectinload(Room.seats)
        ).where(
            and_(
                Room.branch_id == branch_id,
                Room.room_type.in_(["MEETING_ROOM", "CONFERENCE_ROOM", "WORKSPACE"]),
                Room.status == "ACTIVE"
            )
        )
    )
    rooms = rooms_result.scalars().all()
    
    res = []
    for r in rooms:
        overlap_query = select(Booking).where(
            and_(
                Booking.room_id == r.id,
                Booking.booking_date == booking_date,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                Booking.start_time < end_time,
                Booking.end_time > start_time
            )
        )
        overlap_res = await db.execute(overlap_query)
        overlaps = overlap_res.scalars().first()
        
        status_str = "UNAVAILABLE" if overlaps else "AVAILABLE"
        fac_names = [f.name for f in r.facilities] if r.facilities else []
        
        res.append(RoomAvailability(
            room_id=r.id,
            name=r.name,
            capacity=r.capacity,
            price_per_hour=float(r.price_per_hour or 0),
            room_type=r.room_type,
            facilities=fac_names,
            seats_count=len(r.seats) if r.seats else r.capacity,
            floor=r.floor,
            available_capacity=0 if overlaps else r.capacity,
            status=status_str,
            currency="INR"
        ))
    return res

@router.get("/availability/room/{room_id}/timeline", response_model=List[RoomTimelineSlot])
async def get_room_timeline(
    room_id: UUID,
    booking_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return a room's bookable day as 15-minute availability intervals."""
    room = (await db.execute(select(Room).where(Room.id == room_id))).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    bookings = (await db.execute(
        select(Booking).options(selectinload(Booking.user)).where(
            Booking.room_id == room_id,
            Booking.booking_date == booking_date,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
        )
    )).scalars().all()

    return _build_timeline_slots(bookings, current_user.id)


def _build_timeline_slots(bookings: List[Booking], current_user_id) -> List[RoomTimelineSlot]:
    slots = []
    for minutes in range(8 * 60, 20 * 60, 15):
        slot_start = time(minutes // 60, minutes % 60)
        end_minutes = minutes + 15
        slot_end = time(end_minutes // 60, end_minutes % 60)
        matching_booking = next(
            (
                booking for booking in bookings
                if booking.start_time and booking.end_time and booking.start_time < slot_end and booking.end_time > slot_start
            ),
            None
        )
        mine = bool(matching_booking and str(matching_booking.user_id) == str(current_user_id))
        slots.append(RoomTimelineSlot(
            start_time=slot_start,
            end_time=slot_end,
            status="BOOKED" if matching_booking else "AVAILABLE",
            is_mine=mine,
            booking_id=matching_booking.id if matching_booking else None,
            booked_by=(matching_booking.user.name if matching_booking and matching_booking.user else None),
            booking_type=matching_booking.booking_type.value if matching_booking and matching_booking.booking_type else None,
            booking_start=matching_booking.start_time if matching_booking else None,
            booking_end=matching_booking.end_time if matching_booking else None,
        ))
    return slots


@router.get("/availability/rooms/timeline", response_model=List[RoomTimelineResponse])
async def get_branch_rooms_timeline(
    branch_id: UUID,
    booking_date: date,
    room_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room_query = select(Room).options(selectinload(Room.facilities)).where(
        Room.branch_id == branch_id,
        Room.status == "ACTIVE",
        Room.room_type.in_(["MEETING_ROOM", "CONFERENCE_ROOM"])
    )
    if room_type:
        room_query = room_query.where(Room.room_type == room_type)
    rooms = (await db.execute(room_query)).scalars().all()
    if not rooms:
        return []

    room_ids = [r.id for r in rooms]
    bookings = (await db.execute(
        select(Booking).options(selectinload(Booking.user)).where(
            Booking.room_id.in_(room_ids),
            Booking.booking_date == booking_date,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
        )
    )).scalars().all()
    by_room: dict = {}
    for booking in bookings:
        by_room.setdefault(str(booking.room_id), []).append(booking)

    result = []
    for room in rooms:
        room_bookings = by_room.get(str(room.id), [])
        result.append(RoomTimelineResponse(
            room_id=room.id,
            name=room.name,
            floor=room.floor,
            capacity=room.capacity,
            room_type=room.room_type,
            price_per_hour=float(room.price_per_hour or 0),
            facilities=[f.name for f in room.facilities] if room.facilities else [],
            status="UNAVAILABLE" if room_bookings else "AVAILABLE",
            slots=_build_timeline_slots(room_bookings, current_user.id)
        ))
    return result

# ----------------- Alternative Resource Suggestions -----------------

@router.get("/alternatives", response_model=AlternativeResourceResponse)
async def get_alternative_suggestions(
    branch_id: UUID,
    booking_date: date,
    resource_type: str = "SEAT", # "SEAT" or "ROOM"
    room_id: Optional[UUID] = None,
    time_slot_id: Optional[UUID] = None,
    start_time: Optional[time] = None,
    end_time: Optional[time] = None,
    db: AsyncSession = Depends(get_db)
):
    branch_res = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = branch_res.scalar_one_or_none()
    branch_name = branch.name if branch else "Main Branch"

    alternatives = []

    if resource_type.upper() == "SEAT":
        # Find available seats in other rooms or slots at this branch
        all_seats = (await db.execute(
            select(Seat)
            .join(Room)
            .where(Room.branch_id == branch_id, Seat.status.in_(("ACTIVE", "AVAILABLE")))
            .limit(10)
        )).scalars().all()

        booked_seat_ids = set()
        if time_slot_id:
            booked = (await db.execute(
                select(Booking.seat_id).where(
                    and_(
                        Booking.branch_id == branch_id,
                        Booking.booking_date == booking_date,
                        Booking.time_slot_id == time_slot_id,
                        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
                    )
                )
            )).scalars().all()
            booked_seat_ids = set(booked)

        for s in all_seats:
            if s.id not in booked_seat_ids:
                alternatives.append(AlternativeResourceOption(
                    id=s.id,
                    name=f"Desk {s.seat_number} ({s.seat_type})",
                    type="SEAT",
                    branch_id=branch_id,
                    branch_name=branch_name,
                    price=float(s.price),
                    facilities=["Power Outlets", "Ergonomic Setup", "WiFi"],
                    reason="Adjacent desk available in same branch"
                ))
            if len(alternatives) >= 3:
                break

    else: # ROOM
        target_st = start_time or time(9, 0)
        target_et = end_time or time(10, 0)
        available_rooms = (await db.execute(
            select(Room).options(selectinload(Room.facilities)).where(
                and_(
                    Room.branch_id == branch_id,
                    Room.room_type.in_(["MEETING_ROOM", "CONFERENCE_ROOM"]),
                    Room.status == "ACTIVE"
                )
            )
        )).scalars().all()

        for r in available_rooms:
            overlap = (await db.execute(
                select(Booking).where(
                    and_(
                        Booking.room_id == r.id,
                        Booking.booking_date == booking_date,
                        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                        Booking.start_time < target_et,
                        Booking.end_time > target_st
                    )
                )
            )).scalars().first()

            if not overlap:
                facs = [f.name for f in r.facilities] if r.facilities else []
                alternatives.append(AlternativeResourceOption(
                    id=r.id,
                    name=r.name,
                    type="ROOM",
                    branch_id=branch_id,
                    branch_name=branch_name,
                    capacity=r.capacity,
                    price=float(r.price_per_hour or 0),
                    facilities=facs,
                    reason=f"Available room with {r.capacity} capacity and presentation amenities"
                ))
            if len(alternatives) >= 3:
                break

    return AlternativeResourceResponse(
        conflict_detected=len(alternatives) > 0,
        message="Alternative available workspaces suggested below." if alternatives else "No matching alternatives found.",
        alternatives=alternatives
    )

# ----------------- Core Booking CRUD & Flow -----------------

@router.post("/", response_model=BookingResponse)
async def create_booking(
    booking_in: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    price = Decimal("0.0")
    desc = ""
    if booking_in.booking_type == BookingType.SEAT:
        if not booking_in.seat_id:
            raise HTTPException(status_code=400, detail="seat_id required for SEAT booking")
            
        condition = and_(
            Booking.seat_id == booking_in.seat_id,
            Booking.booking_date == booking_in.booking_date,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
        )
        if booking_in.time_slot_id:
            condition = and_(condition, Booking.time_slot_id == booking_in.time_slot_id)
        elif booking_in.start_time and booking_in.end_time:
            condition = and_(
                condition,
                Booking.start_time < booking_in.end_time,
                Booking.end_time > booking_in.start_time
            )
        else:
            raise HTTPException(status_code=400, detail="Time slot or start/end time required for SEAT booking")
            
        overlap = (await db.execute(select(Booking).where(condition))).scalars().first()
        if overlap:
            raise HTTPException(status_code=409, detail="Seat is already booked for this time range")

        seat = (await db.execute(select(Seat).where(Seat.id == booking_in.seat_id))).scalar_one_or_none()
        if not seat: raise HTTPException(status_code=404, detail="Seat not found")
        price = Decimal(str(seat.price))
        desc = f"Seat Booking - Desk {seat.seat_number}"
        
    elif booking_in.booking_type == BookingType.DAY_PASS:
        if not booking_in.day_pass_id:
            raise HTTPException(status_code=400, detail="day_pass_id required for DAY_PASS booking")
        dp = (await db.execute(select(DayPass).where(DayPass.id == booking_in.day_pass_id))).scalar_one_or_none()
        if not dp: raise HTTPException(status_code=404, detail="Day Pass not found")
        
        # Calculate total people and check capacity
        number_of_people = booking_in.number_of_people or 1
        if number_of_people < 1 or number_of_people > 4:
            raise HTTPException(status_code=400, detail="Number of people must be between 1 and 4")
        extra = booking_in.additional_users or []
        if number_of_people > 1 and len(extra) != number_of_people - 1:
            raise HTTPException(status_code=400, detail="Please add all additional users before confirming")

        seen_emails = {current_user.email.strip().lower()}
        for attendee in extra:
            name = (attendee.get("name") or "").strip()
            email = (attendee.get("email") or "").strip().lower()
            if not name or not email or "@" not in email:
                raise HTTPException(status_code=400, detail="Each additional attendee needs a valid name and email address")
            if email in seen_emails:
                raise HTTPException(status_code=400, detail=f"Duplicate attendee email: {email}")
            seen_emails.add(email)

        existing_people = (await db.execute(select(func.coalesce(func.sum(Booking.number_of_people), 0)).where(
            and_(Booking.day_pass_id == dp.id, Booking.booking_date == booking_in.booking_date, Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]))
        ))).scalar_one()
        existing_people = int(existing_people or 0)
        total_people_after_booking = existing_people + number_of_people
        
        if total_people_after_booking > dp.daily_capacity:
            raise HTTPException(status_code=400, detail=f"Day Pass capacity reached. Available: {dp.daily_capacity - existing_people}, Requested: {number_of_people}")
        
        # Calculate total price based on number of people
        price = Decimal(str(dp.price)) * Decimal(str(number_of_people))
        desc = f"Day Pass - {dp.name} ({number_of_people} person{'s' if number_of_people > 1 else ''})"
        
    elif booking_in.booking_type in [BookingType.MEETING_ROOM, BookingType.CONFERENCE_ROOM]:
        if not booking_in.room_id or not booking_in.start_time or not booking_in.end_time:
            raise HTTPException(status_code=400, detail="room_id, start_time, end_time required for ROOM booking")
        if booking_in.start_time.minute % 15 or booking_in.end_time.minute % 15 or booking_in.start_time.second or booking_in.end_time.second:
            raise HTTPException(status_code=400, detail="Room bookings must start and end on 15-minute boundaries")
        room = (await db.execute(select(Room).options(selectinload(Room.facilities)).where(Room.id == booking_in.room_id))).scalar_one_or_none()
        if not room: raise HTTPException(status_code=404, detail="Room not found")
        if room.branch_id != booking_in.branch_id:
            raise HTTPException(status_code=400, detail="Selected room does not belong to this branch")
        if room.room_type != booking_in.booking_type.value:
            raise HTTPException(status_code=400, detail="Selected room does not match the requested booking type")

        attendees = booking_in.number_of_people or 1
        if attendees > room.capacity:
            raise HTTPException(
                status_code=400,
                detail=f"{room.name} seats {room.capacity} people, which is below the requested {attendees} attendees."
            )

        if booking_in.required_amenities:
            room_facility_names = {f.name.lower() for f in room.facilities} if room.facilities else set()
            missing = [a for a in booking_in.required_amenities if a.lower() not in room_facility_names]
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail=f"{room.name} does not have the requested amenities: {', '.join(missing)}."
                )

        duration_hrs = (booking_in.end_time.hour - booking_in.start_time.hour) + (booking_in.end_time.minute - booking_in.start_time.minute) / 60.0
        if duration_hrs <= 0: raise HTTPException(status_code=400, detail="Invalid time range")

        price = Decimal(str(room.price_per_hour or 0)) * Decimal(str(duration_hrs))
        desc = f"{'Conference' if booking_in.booking_type == BookingType.CONFERENCE_ROOM else 'Meeting'} Room - {room.name}"

        overlap = (await db.execute(select(Booking).where(
            and_(Booking.room_id == room.id, Booking.booking_date == booking_in.booking_date, Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]), Booking.start_time < booking_in.end_time, Booking.end_time > booking_in.start_time)
        ))).scalars().first()
        if overlap:
            raise HTTPException(status_code=409, detail="Room is already booked for this time range")

    try:
        wallet_result = await db.execute(
            select(Wallet).where(Wallet.user_id == current_user.id).with_for_update()
        )
        wallet = wallet_result.scalar_one_or_none()
        if not wallet: raise HTTPException(status_code=404, detail="Wallet not found")

        if wallet.balance < price:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. Required: ₹{price:.2f}, Balance: ₹{wallet.balance:.2f}."
            )

        booking = Booking(
            user_id=current_user.id,
            booking_type=booking_in.booking_type,
            location_id=booking_in.location_id,
            branch_id=booking_in.branch_id,
            seat_id=booking_in.seat_id,
            day_pass_id=booking_in.day_pass_id,
            room_id=booking_in.room_id,
            booking_date=booking_in.booking_date,
            time_slot_id=booking_in.time_slot_id,
            start_time=booking_in.start_time,
            end_time=booking_in.end_time,
            amount=price,
            status=BookingStatus.CONFIRMED,
            number_of_people=booking_in.number_of_people or 1,
            additional_users=booking_in.additional_users,
            title=booking_in.title,
            purpose=booking_in.purpose,
            participant_emails=booking_in.participant_emails
        )
        db.add(booking)
        await db.flush()
        
        balance_before = wallet.balance
        wallet.balance -= price
        balance_after = wallet.balance
        
        transaction = CreditTransaction(
            wallet_id=wallet.id,
            user_id=current_user.id,
            transaction_type=TransactionType.DEBIT,
            amount=float(price),
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="BOOKING",
            reference_id=str(booking.id),
            description=desc,
            status="SUCCESS"
        )
        db.add(transaction)

        # In-app notification
        await create_system_notification(
            db=db,
            user_id=current_user.id,
            title="Booking Confirmed!",
            message=f"Your {desc} on {booking.booking_date} is confirmed. ₹{price:.2f} was deducted from your wallet.",
            notif_type=NotificationType.BOOKING_CONFIRMATION,
            reference_id=str(booking.id)
        )

        await db.commit()
        await db.refresh(booking)
        return booking

    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Conflict! Workspace resource is already booked.")
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Booking Modification -----------------

@router.put("/{booking_id}/modify", response_model=BookingResponse)
async def modify_booking(
    booking_id: UUID,
    modify_in: BookingModifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        booking_query = select(Booking).where(Booking.id == booking_id).with_for_update()
        if current_user.role != "ADMIN":
            booking_query = booking_query.where(Booking.user_id == current_user.id)
            
        booking = (await db.execute(booking_query)).scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.status != BookingStatus.CONFIRMED:
            raise HTTPException(status_code=400, detail="Only confirmed bookings can be modified")

        # Determine new price
        new_price = booking.amount
        if modify_in.seat_id:
            new_seat = (await db.execute(select(Seat).where(Seat.id == modify_in.seat_id))).scalar_one_or_none()
            if not new_seat: raise HTTPException(status_code=404, detail="Seat not found")
            new_price = Decimal(str(new_seat.price))
            booking.seat_id = new_seat.id
            booking.room_id = new_seat.room_id
            if modify_in.booking_date:
                booking.booking_date = modify_in.booking_date
            if modify_in.time_slot_id:
                booking.time_slot_id = modify_in.time_slot_id

        elif booking.room_id and (modify_in.start_time or modify_in.end_time or modify_in.booking_date):
            # Rescheduling a Meeting/Conference Room booking: re-validate the new slot
            # and recompute the price for the new duration before committing.
            room = (await db.execute(select(Room).where(Room.id == booking.room_id))).scalar_one_or_none()
            if not room: raise HTTPException(status_code=404, detail="Room not found")

            new_date = modify_in.booking_date or booking.booking_date
            new_start = modify_in.start_time or booking.start_time
            new_end = modify_in.end_time or booking.end_time
            if not new_start or not new_end or new_end <= new_start:
                raise HTTPException(status_code=400, detail="Invalid time range")

            overlap = (await db.execute(select(Booking).where(
                and_(
                    Booking.room_id == room.id,
                    Booking.booking_date == new_date,
                    Booking.id != booking.id,
                    Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                    Booking.start_time < new_end,
                    Booking.end_time > new_start
                )
            ))).scalars().first()
            if overlap:
                raise HTTPException(status_code=409, detail="Room is already booked for the requested time range")

            duration_hrs = (new_end.hour - new_start.hour) + (new_end.minute - new_start.minute) / 60.0
            new_price = Decimal(str(room.price_per_hour or 0)) * Decimal(str(duration_hrs))
            booking.booking_date = new_date
            booking.start_time = new_start
            booking.end_time = new_end

        else:
            if modify_in.booking_date:
                booking.booking_date = modify_in.booking_date
            if modify_in.time_slot_id:
                booking.time_slot_id = modify_in.time_slot_id
            if modify_in.start_time:
                booking.start_time = modify_in.start_time
            if modify_in.end_time:
                booking.end_time = modify_in.end_time

        # Calculate differential against user wallet
        price_diff = Decimal(str(new_price)) - booking.amount
        wallet = (await db.execute(select(Wallet).where(Wallet.user_id == booking.user_id).with_for_update())).scalar_one_or_none()
        if not wallet: raise HTTPException(status_code=404, detail="Wallet not found")

        if price_diff > 0: # Additional debit
            if wallet.balance < price_diff:
                raise HTTPException(status_code=400, detail=f"Insufficient balance to upgrade. Need additional ₹{price_diff:.2f}")
            wallet.balance -= price_diff
            db.add(CreditTransaction(
                wallet_id=wallet.id,
                user_id=booking.user_id,
                transaction_type=TransactionType.DEBIT,
                amount=float(price_diff),
                balance_before=wallet.balance + price_diff,
                balance_after=wallet.balance,
                reference_type="BOOKING_MODIFY",
                reference_id=str(booking.id),
                description=f"Modification adjustment for booking {booking.id}",
                status="SUCCESS"
            ))
        elif price_diff < 0: # Refund excess
            refund_amt = abs(price_diff)
            wallet.balance += refund_amt
            db.add(CreditTransaction(
                wallet_id=wallet.id,
                user_id=booking.user_id,
                transaction_type=TransactionType.REFUND,
                amount=float(refund_amt),
                balance_before=wallet.balance - refund_amt,
                balance_after=wallet.balance,
                reference_type="BOOKING_MODIFY",
                reference_id=str(booking.id),
                description=f"Refund difference for booking modification {booking.id}",
                status="SUCCESS"
            ))

        booking.amount = Decimal(str(new_price))

        await create_system_notification(
            db=db,
            user_id=booking.user_id,
            title="Booking Modified",
            message=f"Your booking on {booking.booking_date} has been updated successfully.",
            notif_type=NotificationType.BOOKING_MODIFIED,
            reference_id=str(booking.id)
        )

        await db.commit()
        await db.refresh(booking)
        return booking

    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Conflict! Selected date/time/seat is already taken.")
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Booking Extension -----------------

@router.post("/{booking_id}/extend", response_model=BookingResponse)
async def extend_booking(
    booking_id: UUID,
    extend_in: BookingExtendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        booking = (await db.execute(
            select(Booking).where(Booking.id == booking_id, Booking.user_id == current_user.id).with_for_update()
        )).scalar_one_or_none()
        
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.status != BookingStatus.CONFIRMED:
            raise HTTPException(status_code=400, detail="Only confirmed room bookings can be extended")
        if not booking.end_time or not booking.room_id:
            raise HTTPException(status_code=400, detail="Only hourly room reservations support duration extension")

        room = (await db.execute(select(Room).where(Room.id == booking.room_id))).scalar_one_or_none()
        if not room: raise HTTPException(status_code=404, detail="Room not found")

        # Compute new end time
        current_end = datetime.combine(booking.booking_date, booking.end_time)
        new_end_dt = current_end + timedelta(hours=extend_in.additional_hours)
        new_end_time = new_end_dt.time()

        # Check overlap
        overlap = (await db.execute(
            select(Booking).where(
                and_(
                    Booking.room_id == booking.room_id,
                    Booking.booking_date == booking.booking_date,
                    Booking.id != booking.id,
                    Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                    Booking.start_time < new_end_time,
                    Booking.end_time > booking.end_time
                )
            )
        )).scalars().first()

        if overlap:
            raise HTTPException(status_code=409, detail="Cannot extend: Room is booked by another member immediately after your slot.")

        additional_cost = Decimal(str(room.price_per_hour or 0)) * Decimal(str(extend_in.additional_hours))

        wallet = (await db.execute(select(Wallet).where(Wallet.user_id == current_user.id).with_for_update())).scalar_one_or_none()
        if not wallet or wallet.balance < additional_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient balance to extend by {extend_in.additional_hours}hr. Need ₹{additional_cost:.2f}")

        wallet.balance -= additional_cost
        booking.end_time = new_end_time
        booking.amount += additional_cost

        db.add(CreditTransaction(
            wallet_id=wallet.id,
            user_id=current_user.id,
            transaction_type=TransactionType.DEBIT,
            amount=float(additional_cost),
            balance_before=wallet.balance + additional_cost,
            balance_after=wallet.balance,
            reference_type="BOOKING_EXTEND",
            reference_id=str(booking.id),
            description=f"Extension (+{extend_in.additional_hours}hr) for Room {room.name}",
            status="SUCCESS"
        ))

        await create_system_notification(
            db=db,
            user_id=current_user.id,
            title="Booking Extended!",
            message=f"Extended reservation for {room.name} until {new_end_time.strftime('%H:%M')}. ₹{additional_cost:.2f} charged.",
            notif_type=NotificationType.BOOKING_EXTENDED,
            reference_id=str(booking.id)
        )

        await db.commit()
        await db.refresh(booking)
        return booking

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- Outlook / iCal Calendar Export -----------------

@router.get("/{booking_id}/ical")
async def get_booking_ical(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.branch),
            selectinload(Booking.location),
            selectinload(Booking.room),
            selectinload(Booking.seat),
            selectinload(Booking.time_slot)
        )
        .where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if current_user.role != "ADMIN" and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    st = booking.start_time or (booking.time_slot.start_time if booking.time_slot else time(9, 0))
    et = booking.end_time or (booking.time_slot.end_time if booking.time_slot else time(18, 0))

    start_dt = datetime.combine(booking.booking_date, st)
    end_dt = datetime.combine(booking.booking_date, et)

    summary = f"Seat Booking App: {booking.booking_type}"
    if booking.seat: summary = f"Desk {booking.seat.seat_number} - Seat Booking App"
    elif booking.room: summary = f"{booking.room.name} - Seat Booking App"

    location_str = f"{booking.branch.name if booking.branch else 'Workspace'}, {booking.location.city if booking.location else ''}"

    ics_content = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//Seat Booking App//Workspace Booking//EN\r\n"
        "CALSCALE:GREGORIAN\r\n"
        "METHOD:REQUEST\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{booking.id}@seatbooking.app\r\n"
        f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}\r\n"
        f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%SZ')}\r\n"
        f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%SZ')}\r\n"
        f"SUMMARY:{summary}\r\n"
        f"DESCRIPTION:Seat Booking App reservation: {summary}. Status: CONFIRMED. Total: INR {booking.amount}\r\n"
        f"LOCATION:{location_str}\r\n"
        "STATUS:CONFIRMED\r\n"
        "BEGIN:VALARM\r\n"
        "TRIGGER:-PT15M\r\n"
        "ACTION:DISPLAY\r\n"
        "DESCRIPTION:Seat Booking App reservation starts in 15 minutes\r\n"
        "END:VALARM\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )

    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="seat_booking_{booking.id}.ics"'
        }
    )

# ----------------- Cancellation & Master Queries -----------------

@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # A reservation belongs to its creator. Administrators may view bookings,
        # but cannot release another employee's room slot through this endpoint.
        query = select(Booking).where(
            Booking.id == booking_id,
            Booking.user_id == current_user.id
        ).with_for_update()
            
        booking = (await db.execute(query)).scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found or unauthorized")
            
        if booking.status != BookingStatus.CONFIRMED:
            raise HTTPException(status_code=400, detail="Only confirmed bookings can be cancelled")

        wallet = (await db.execute(select(Wallet).where(Wallet.user_id == booking.user_id).with_for_update())).scalar_one_or_none()
        if not wallet:
            raise HTTPException(status_code=404, detail="User wallet not found")

        booking.status = BookingStatus.CANCELLED
        
        balance_before = wallet.balance
        wallet.balance += booking.amount
        balance_after = wallet.balance
        
        transaction = CreditTransaction(
            wallet_id=wallet.id,
            user_id=booking.user_id,
            transaction_type=TransactionType.REFUND,
            amount=float(booking.amount),
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="BOOKING_CANCEL",
            reference_id=str(booking.id),
            description=f"Refund for cancelled booking - {booking.id}",
            status="SUCCESS"
        )
        db.add(transaction)

        await create_system_notification(
            db=db,
            user_id=booking.user_id,
            title="Booking Cancelled & Refunded",
            message=f"Booking {booking.id} was cancelled. 100% refund of ₹{booking.amount:.2f} credited to your wallet.",
            notif_type=NotificationType.BOOKING_CANCELLED,
            reference_id=str(booking.id)
        )
        
        await db.commit()
        await db.refresh(booking)
        return booking
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my", response_model=List[BookingDetailResponse])
async def get_my_bookings(
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        select(Booking)
        .options(
            selectinload(Booking.user),
            selectinload(Booking.location),
            selectinload(Booking.branch),
            selectinload(Booking.room).selectinload(Room.facilities),
            selectinload(Booking.seat),
            selectinload(Booking.day_pass),
            selectinload(Booking.time_slot)
        )
        .where(Booking.user_id == current_user.id)
    )
    if status:
        query = query.where(Booking.status == status)
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                cast(Booking.id, String).ilike(like),
                cast(Booking.booking_date, String).ilike(like),
            )
        )
    result = await db.execute(query.order_by(Booking.created_at.desc()).offset(skip).limit(limit))
    bookings = result.scalars().all()
    return [map_booking_to_detail(b) for b in bookings]

@router.get("/admin/all", response_model=List[BookingDetailResponse])
async def get_all_bookings_admin(
    booking_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    user_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = select(Booking).options(
        selectinload(Booking.user),
        selectinload(Booking.location),
        selectinload(Booking.branch),
        selectinload(Booking.room).selectinload(Room.facilities),
        selectinload(Booking.seat),
        selectinload(Booking.day_pass),
        selectinload(Booking.time_slot)
    )
    if booking_type:
        query = query.where(Booking.booking_type == booking_type)
    if status:
        query = query.where(Booking.status == status)
    if user_id:
        query = query.where(Booking.user_id == user_id)
    if search:
        like = f"%{search}%"
        query = query.join(User, Booking.user_id == User.id).outerjoin(
            Location, Booking.location_id == Location.id
        ).outerjoin(Branch, Booking.branch_id == Branch.id).where(
            or_(
                User.name.ilike(like),
                User.email.ilike(like),
                Location.name.ilike(like),
                Branch.name.ilike(like),
                cast(Booking.id, String).ilike(like),
            )
        )

    # Pagination must run after every filter (including search) so a page
    # reflects the full filtered result set instead of truncating first.
    query = query.order_by(Booking.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    bookings = result.scalars().all()

    return [map_booking_to_detail(b) for b in bookings]

@router.get("/{booking_id}", response_model=BookingDetailResponse)
async def get_booking_by_id(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.user),
            selectinload(Booking.location),
            selectinload(Booking.branch),
            selectinload(Booking.room).selectinload(Room.facilities),
            selectinload(Booking.seat),
            selectinload(Booking.day_pass),
            selectinload(Booking.time_slot)
        )
        .where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if current_user.role != "ADMIN" and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return map_booking_to_detail(booking)
