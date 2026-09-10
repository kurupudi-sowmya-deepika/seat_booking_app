from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.wallet import TransactionType

class TopupRequest(BaseModel):
    amount: float

class TopupResponse(BaseModel):
    checkout_url: Optional[str] = None
    balance: Optional[float] = None
    demo_credit: bool = False

class TransactionResponse(BaseModel):
    id: UUID
    transaction_type: TransactionType
    amount: float
    balance_before: float
    balance_after: float
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "SUCCESS"
    created_at: datetime
    
    class Config:
        from_attributes = True

class WalletResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    balance: float
    currency: str
    transactions: List[TransactionResponse] = []
    
    class Config:
        from_attributes = True

class AdminAdjustRequest(BaseModel):
    wallet_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    amount: float
    transaction_type: TransactionType = TransactionType.ADJUSTMENT
    reason: str

class AdminWalletDetail(BaseModel):
    id: UUID
    user_id: UUID
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    balance: float
    currency: str
    status: str
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
