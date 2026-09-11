import enum
from datetime import date, time
from sqlalchemy import String, ForeignKey, Date, Time, Numeric, Enum, UniqueConstraint, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"

class BookingType(str, enum.Enum):
    SEAT = "SEAT"
    DAY_PASS = "DAY_PASS"
    MEETING_ROOM = "MEETING_ROOM"
    CONFERENCE_ROOM = "CONFERENCE_ROOM"

class TimeSlot(BaseModel):
    __tablename__ = "time_slots"

    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")

    bookings = relationship("Booking", back_populates="time_slot")

class Booking(BaseModel):
    __tablename__ = "bookings"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    booking_type: Mapped[BookingType] = mapped_column(Enum(BookingType), default=BookingType.SEAT)
    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"))
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    
    seat_id: Mapped[str | None] = mapped_column(ForeignKey("seats.id"), nullable=True)
    day_pass_id: Mapped[str | None] = mapped_column(ForeignKey("day_passes.id"), nullable=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"), nullable=True)
    
    booking_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    time_slot_id: Mapped[str | None] = mapped_column(ForeignKey("time_slots.id"), nullable=True)
    
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.PENDING)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    stripe_session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    
    # Additional fields for multi-user bookings
    number_of_people: Mapped[int] = mapped_column(default=1)
    additional_users: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Store additional user info

    # Meeting/conference room metadata
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    purpose: Mapped[str | None] = mapped_column(String, nullable=True)
    participant_emails: Mapped[list | None] = mapped_column(JSON, nullable=True)

    user = relationship("User", back_populates="bookings")
    seat = relationship("Seat", back_populates="bookings")
    day_pass = relationship("DayPass", back_populates="bookings")
    room = relationship("Room", back_populates="bookings")
    time_slot = relationship("TimeSlot", back_populates="bookings")
    location = relationship("Location", back_populates="bookings")
    branch = relationship("Branch", back_populates="bookings")
    payment = relationship("Payment", back_populates="booking", uselist=False)

    __table_args__ = (
        # Partial unique index to prevent double booking of active bookings
        Index(
            "ix_unique_active_booking",
            "seat_id", "booking_date", "time_slot_id",
            unique=True,
            postgresql_where=status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED])
        ),
        Index("ix_bookings_user_id", "user_id"),
        Index("ix_bookings_location_id", "location_id"),
        Index("ix_bookings_branch_id", "branch_id"),
        Index("ix_bookings_room_id", "room_id"),
        Index("ix_bookings_booking_date", "booking_date"),
        Index("ix_bookings_start_time", "start_time"),
        Index("ix_bookings_end_time", "end_time"),
    )

class Payment(BaseModel):
    __tablename__ = "payments"

    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"))
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)

    booking = relationship("Booking", back_populates="payment")
