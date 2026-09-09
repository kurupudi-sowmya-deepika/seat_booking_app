from sqlalchemy import String, Float, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel
from typing import List

class Location(BaseModel):
    __tablename__ = "locations"

    name: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String)
    state: Mapped[str] = mapped_column(String)
    country: Mapped[str] = mapped_column(String)
    postal_code: Mapped[str] = mapped_column(String)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")

    branches = relationship("Branch", back_populates="location", cascade="all, delete-orphan")

class Branch(BaseModel):
    __tablename__ = "branches"

    location_id: Mapped[str] = mapped_column(ForeignKey("locations.id"))
    name: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")

    location = relationship("Location", back_populates="branches")
    rooms = relationship("Room", back_populates="branch", cascade="all, delete-orphan")

class Room(BaseModel):
    __tablename__ = "rooms"

    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    capacity: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")

    branch = relationship("Branch", back_populates="rooms")
    seats = relationship("Seat", back_populates="room", cascade="all, delete-orphan")
    facilities = relationship("Facility", secondary="room_facilities", back_populates="rooms")

class Facility(BaseModel):
    __tablename__ = "facilities"

    name: Mapped[str] = mapped_column(String, unique=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)

    rooms = relationship("Room", secondary="room_facilities", back_populates="facilities")

class RoomFacility(BaseModel):
    __tablename__ = "room_facilities"

    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id"))
    facility_id: Mapped[str] = mapped_column(ForeignKey("facilities.id"))

class Seat(BaseModel):
    __tablename__ = "seats"

    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id"))
    seat_number: Mapped[str] = mapped_column(String)
    seat_type: Mapped[str] = mapped_column(String, default="STANDARD")
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE")
    price: Mapped[float] = mapped_column(Numeric(10, 2))

    room = relationship("Room", back_populates="seats")
    bookings = relationship("Booking", back_populates="seat")
