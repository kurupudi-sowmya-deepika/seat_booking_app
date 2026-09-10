from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import date, time, datetime
from app.models.visitor import VisitorStatus

class VisitorBase(BaseModel):
    branch_id: UUID
    visitor_name: str
    visitor_email: str
    visitor_phone: Optional[str] = None
    purpose: Optional[str] = "Meeting / Collaboration"
    visit_date: date
    expected_arrival_time: Optional[time] = None
    notes: Optional[str] = None

class VisitorCreate(VisitorBase):
    pass

class VisitorUpdate(BaseModel):
    visitor_name: Optional[str] = None
    visitor_email: Optional[str] = None
    visitor_phone: Optional[str] = None
    purpose: Optional[str] = None
    visit_date: Optional[date] = None
    expected_arrival_time: Optional[time] = None
    notes: Optional[str] = None
    status: Optional[VisitorStatus] = None

class VisitorResponse(VisitorBase):
    id: UUID
    host_user_id: UUID
    host_name: Optional[str] = None
    branch_name: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: VisitorStatus
    created_at: datetime

    class Config:
        from_attributes = True
