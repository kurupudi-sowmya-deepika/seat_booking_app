import enum
from sqlalchemy import String, ForeignKey, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class NotificationType(str, enum.Enum):
    BOOKING_CONFIRMATION = "BOOKING_CONFIRMATION"
    BOOKING_MODIFIED = "BOOKING_MODIFIED"
    BOOKING_REMINDER = "BOOKING_REMINDER"
    BOOKING_CANCELLED = "BOOKING_CANCELLED"
    BOOKING_EXTENDED = "BOOKING_EXTENDED"
    VISITOR_ARRIVED = "VISITOR_ARRIVED"
    WALLET_CREDIT = "WALLET_CREDIT"
    SYSTEM = "SYSTEM"

class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String)
    message: Mapped[str] = mapped_column(String)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), default=NotificationType.SYSTEM)
    reference_id: Mapped[str | None] = mapped_column(String, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    user = relationship("User", backref="notifications")
