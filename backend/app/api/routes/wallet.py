import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.db.database import get_db
from app.models.wallet import Wallet, CreditTransaction
from app.models.user import User
from app.schemas.wallet import WalletResponse, TopupRequest, TopupResponse, TransactionResponse
from app.api.deps import get_current_user
from app.core.config import settings

router = APIRouter()
stripe.api_key = settings.STRIPE_SECRET_KEY

@router.get("/", response_model=WalletResponse)
async def get_my_wallet(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Wallet).where(Wallet.user_id == current_user.id))
    wallet = result.scalar_one_or_none()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
        
    return wallet

@router.get("/transactions", response_model=List[TransactionResponse])
async def get_my_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .order_by(CreditTransaction.created_at.desc())
    )
    return result.scalars().all()

@router.post("/topup", response_model=TopupResponse)
async def create_topup_session(
    topup_in: TopupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if topup_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    result = await db.execute(select(Wallet).where(Wallet.user_id == current_user.id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'inr',
                    'unit_amount': int(topup_in.amount * 100),
                    'product_data': {
                        'name': 'Wallet Top-up',
                        'description': 'Add credits to your SeatSync wallet',
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{settings.FRONTEND_URL}/wallet?success=true",
            cancel_url=f"{settings.FRONTEND_URL}/wallet?canceled=true",
            client_reference_id=str(wallet.id), # Attach wallet ID to the session
        )
        
        # Note: We don't create a pending transaction here to avoid complex state management.
        # We only create a CREDIT transaction when the Stripe Webhook confirms payment.
        
        return TopupResponse(checkout_url=checkout_session.url)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
