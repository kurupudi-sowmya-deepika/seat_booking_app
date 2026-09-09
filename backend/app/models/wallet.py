import enum
from sqlalchemy import String, ForeignKey, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class TransactionType(str, enum.Enum):
    CREDIT = "CREDIT"
    DEBIT = "DEBIT"
    REFUND = "REFUND"
    ADJUSTMENT = "ADJUSTMENT"

class Wallet(BaseModel):
    __tablename__ = "wallets"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    balance: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00)
    currency: Mapped[str] = mapped_column(String, default="INR")
    status: Mapped[str] = mapped_column(String, default="ACTIVE")

    user = relationship("User")
    transactions = relationship("CreditTransaction", back_populates="wallet", cascade="all, delete-orphan")

class CreditTransaction(BaseModel):
    __tablename__ = "credit_transactions"

    wallet_id: Mapped[str] = mapped_column(ForeignKey("wallets.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    balance_before: Mapped[float] = mapped_column(Numeric(10, 2))
    balance_after: Mapped[float] = mapped_column(Numeric(10, 2))
    reference_type: Mapped[str | None] = mapped_column(String, nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="SUCCESS")

    wallet = relationship("Wallet", back_populates="transactions")
    user = relationship("User")
