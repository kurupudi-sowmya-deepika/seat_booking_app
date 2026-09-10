import enum
from datetime import date, time, datetime
from sqlalchemy import String, ForeignKey, Date, Time, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class VisitorStatus(str, enum.Enum):
    PENDING = "PENDING"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"
    CANCELLED = "CANCELLED"

class Visitor(BaseModel):
    __tablename__ = "visitors"

    host_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    branch_id: Mapped[str] = mapped_column(ForeignKey("branches.id"))
    
    visitor_name: Mapped[str] = mapped_column(String)
    visitor_email: Mapped[str] = mapped_column(String)
    visitor_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    purpose: Mapped[str] = mapped_column(String, default="Meeting / Collaboration")
    
    visit_date: Mapped[date] = mapped_column(Date)
    expected_arrival_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    check_in_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    check_out_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    status: Mapped[VisitorStatus] = mapped_column(Enum(VisitorStatus), default=VisitorStatus.PENDING)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)

    host = relationship("User", backref="hosted_visitors")
    branch = relationship("Branch", backref="visitors")
