from pydantic import BaseModel, EmailStr
from typing import Optional


class SystemSettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    support_email: Optional[EmailStr] = None
    currency: Optional[str] = None
    max_advance_booking_days: Optional[int] = None
    cancellation_window_hours: Optional[int] = None
    refund_percentage: Optional[int] = None
    enable_entra_id_sso: Optional[bool] = None
    enable_local_auth: Optional[bool] = None
    openai_assistant_enabled: Optional[bool] = None
    daily_reminder_email: Optional[bool] = None


class SystemSettingsResponse(BaseModel):
    company_name: str
    support_email: str
    currency: str
    max_advance_booking_days: int
    cancellation_window_hours: int
    refund_percentage: int
    enable_entra_id_sso: bool
    enable_local_auth: bool
    openai_assistant_enabled: bool
    daily_reminder_email: bool

    class Config:
        from_attributes = True
