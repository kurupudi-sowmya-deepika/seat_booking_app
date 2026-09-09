import enum
from sqlalchemy import String, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class AuthProvider(str, enum.Enum):
    LOCAL = "LOCAL"
    ENTRA = "ENTRA"
    BOTH = "BOTH"

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    USER = "USER"

class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"

class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String)
    entra_object_id: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    auth_provider: Mapped[AuthProvider] = mapped_column(Enum(AuthProvider), default=AuthProvider.LOCAL)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USER)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.ACTIVE)

    bookings = relationship("Booking", back_populates="user")
