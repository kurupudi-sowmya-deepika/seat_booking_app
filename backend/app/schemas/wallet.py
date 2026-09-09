from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.wallet import TransactionType

class TopupRequest(BaseModel):
    amount: float

class TopupResponse(BaseModel):
    checkout_url: str

class TransactionResponse(BaseModel):
    id: UUID
    transaction_type: TransactionType
    amount: float
    balance_before: float
    balance_after: float
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class WalletResponse(BaseModel):
    id: UUID
    balance: float
    currency: str
    transactions: List[TransactionResponse] = []
    
    class Config:
        from_attributes = True
