from sqlalchemy import String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class SystemSettings(BaseModel):
    """Singleton row of org-wide settings edited from Admin > System Settings.

    There is intentionally no foreign key or uniqueness scheme enforcing a
    single row - the API layer always reads/creates the first row by
    creation order (see get_or_create in app/api/routes/admin.py), the same
    pattern used for other admin-managed singletons in this app.
    """
    __tablename__ = "system_settings"

    company_name: Mapped[str] = mapped_column(String, default="Acme Enterprise Workspaces")
    support_email: Mapped[str] = mapped_column(String, default="workspace-support@acme.com")
    currency: Mapped[str] = mapped_column(String, default="INR (₹)")
    max_advance_booking_days: Mapped[int] = mapped_column(Integer, default=30)
    cancellation_window_hours: Mapped[int] = mapped_column(Integer, default=2)
    refund_percentage: Mapped[int] = mapped_column(Integer, default=100)
    enable_entra_id_sso: Mapped[bool] = mapped_column(Boolean, default=True)
    enable_local_auth: Mapped[bool] = mapped_column(Boolean, default=True)
    openai_assistant_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_reminder_email: Mapped[bool] = mapped_column(Boolean, default=True)
