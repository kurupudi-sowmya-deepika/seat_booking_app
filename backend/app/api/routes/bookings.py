import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError
from typing import List
from uuid import UUID
from datetime import date

from app.db.database import get_db
from app.models.booking import Booking, BookingStatus, TimeSlot
from app.models.location import Seat
from app.models.user import User
from app.models.wallet import Wallet, CreditTransaction, TransactionType
from app.schemas.booking import BookingCreate, BookingResponse, SeatAvailability
from app.api.deps import get_current_user
from app.core.config import settings

router = APIRouter()
stripe.api_key = settings.STRIPE_SECRET_KEY

@router.get("/availability", response_model=List[SeatAvailability])
async def get_availability(
    room_id: UUID,
    booking_date: date,
    time_slot_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    # 1. Get all seats in the room
    seats_result = await db.execute(select(Seat).where(Seat.room_id == room_id))
    seats = seats_result.scalars().all()
    
    # 2. Get active bookings for these seats on the given date and time_slot
    bookings_result = await db.execute(
        select(Booking, User).join(User).where(
            and_(
                Booking.seat_id.in_([s.id for s in seats]),
                Booking.booking_date == booking_date,
                Booking.time_slot_id == time_slot_id,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
            )
        )
    )
    booked_seats = {}
    for booking, user in bookings_result:
        booked_seats[booking.seat_id] = {
            "status": "BOOKED",
            "booked_by": user.name
        }

    # 3. Compile availability
    availability = []
    for seat in seats:
        b_info = booked_seats.get(seat.id)
        if b_info:
            availability.append(SeatAvailability(
                seat_id=seat.id,
                seat_number=seat.seat_number,
                status="BOOKED",
                booked_by=b_info["booked_by"]
            ))
        else:
            availability.append(SeatAvailability(
                seat_id=seat.id,
                seat_number=seat.seat_number,
                status="AVAILABLE"
            ))
            
    return availability

@router.post("/", response_model=BookingResponse)
async def create_booking(
    booking_in: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if seat exists and get price
    seat_result = await db.execute(select(Seat).where(Seat.id == booking_in.seat_id))
    seat = seat_result.scalar_one_or_none()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")

    try:
        # 1. Lock the wallet row to prevent concurrent deductions
        wallet_result = await db.execute(
            select(Wallet).where(Wallet.user_id == current_user.id).with_for_update()
        )
        wallet = wallet_result.scalar_one_or_none()
        
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        # 2. Check wallet balance
        if wallet.balance < seat.price:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient credits. You need ₹{seat.price} but your current balance is ₹{wallet.balance}."
            )

        # 3. Create the booking object (but not committed yet)
        booking = Booking(
            user_id=current_user.id,
            seat_id=booking_in.seat_id,
            booking_date=booking_in.booking_date,
            time_slot_id=booking_in.time_slot_id,
            amount=seat.price,
            status=BookingStatus.CONFIRMED # Instantly confirmed since paid with credits
        )
        db.add(booking)
        
        # Flush to get the booking ID (which also checks the unique index to prevent double bookings)
        await db.flush()
        
        # 4. Deduct balance and create DEBIT transaction
        balance_before = wallet.balance
        wallet.balance -= seat.price
        balance_after = wallet.balance
        
        transaction = CreditTransaction(
            wallet_id=wallet.id,
            user_id=current_user.id,
            transaction_type=TransactionType.DEBIT,
            amount=seat.price,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="BOOKING",
            reference_id=str(booking.id),
            description=f"Seat Booking - {seat.seat_number}",
            status="SUCCESS"
        )
        db.add(transaction)
        
        await db.commit()
        await db.refresh(booking)
        
        return booking

    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, 
            detail="This seat was just booked by another user. Please select another seat."
        )
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Lock booking and wallet
        booking_result = await db.execute(
            select(Booking).where(and_(Booking.id == booking_id, Booking.user_id == current_user.id)).with_for_update()
        )
        booking = booking_result.scalar_one_or_none()
        
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
            
        if booking.status != BookingStatus.CONFIRMED:
            raise HTTPException(status_code=400, detail="Only confirmed bookings can be cancelled")

        wallet_result = await db.execute(
            select(Wallet).where(Wallet.user_id == current_user.id).with_for_update()
        )
        wallet = wallet_result.scalar_one_or_none()

        # Update booking
        booking.status = BookingStatus.CANCELLED
        
        # Refund wallet
        balance_before = wallet.balance
        wallet.balance += booking.amount
        balance_after = wallet.balance
        
        transaction = CreditTransaction(
            wallet_id=wallet.id,
            user_id=current_user.id,
            transaction_type=TransactionType.REFUND,
            amount=booking.amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="BOOKING_CANCEL",
            reference_id=str(booking.id),
            description=f"Refund for cancelled booking - {booking.id}",
            status="SUCCESS"
        )
        db.add(transaction)
        
        await db.commit()
        await db.refresh(booking)
        
        return booking
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my", response_model=List[BookingResponse])
async def get_my_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Booking).where(Booking.user_id == current_user.id))
    return result.scalars().all()
