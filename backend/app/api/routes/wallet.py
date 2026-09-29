import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from app.db.database import get_db
from app.models.wallet import Wallet, CreditTransaction, TransactionType
from app.models.user import User
from app.models.notification import Notification, NotificationType
from app.schemas.wallet import (
    WalletResponse, TopupRequest, TopupResponse, TransactionResponse,
    AdminAdjustRequest, AdminWalletDetail
)
from app.api.deps import get_current_user, get_current_admin
from app.core.config import settings

router = APIRouter()
stripe.api_key = settings.STRIPE_SECRET_KEY

@router.get("/", response_model=WalletResponse)
@router.get("/balance", response_model=WalletResponse)
async def get_my_wallet(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Wallet)
        .options(selectinload(Wallet.transactions))
        .where(Wallet.user_id == current_user.id)
    )
    wallet = result.scalar_one_or_none()
    
    if not wallet:
        # Create wallet automatically if missing with default 50,000 credit
        initial_balance = Decimal(str(settings.DEFAULT_INITIAL_WALLET_BALANCE))
        wallet = Wallet(user_id=current_user.id, balance=initial_balance)
        db.add(wallet)
        await db.flush()
        db.add(CreditTransaction(
            wallet_id=wallet.id,
            user_id=current_user.id,
            transaction_type=TransactionType.CREDIT,
            amount=float(initial_balance),
            balance_before=0.0,
            balance_after=float(initial_balance),
            reference_type="WELCOME_BONUS",
            reference_id=None,
            description="Default welcome wallet credit",
            status="SUCCESS"
        ))
        await db.commit()
        result = await db.execute(
            select(Wallet)
            .options(selectinload(Wallet.transactions))
            .where(Wallet.id == wallet.id)
        )
        wallet = result.scalar_one()
    elif wallet.balance == Decimal("0.0") and len(wallet.transactions) == 0:
        # If user has an empty wallet with no transaction history, seed the 50,000 default balance
        initial_balance = Decimal(str(settings.DEFAULT_INITIAL_WALLET_BALANCE))
        wallet.balance = initial_balance
        db.add(CreditTransaction(
            wallet_id=wallet.id,
            user_id=current_user.id,
            transaction_type=TransactionType.CREDIT,
            amount=float(initial_balance),
            balance_before=0.0,
            balance_after=float(initial_balance),
            reference_type="WELCOME_BONUS",
            reference_id=None,
            description="Default welcome wallet credit",
            status="SUCCESS"
        ))
        await db.commit()
        await db.refresh(wallet)

    return wallet

@router.get("/transactions", response_model=List[TransactionResponse])
async def get_my_transactions(
    transaction_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(CreditTransaction).where(CreditTransaction.user_id == current_user.id)
    if transaction_type:
        query = query.where(CreditTransaction.transaction_type == transaction_type)
    query = query.order_by(CreditTransaction.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
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
        wallet = Wallet(user_id=current_user.id, balance=0.0)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)

    if settings.DEMO_WALLET_MODE:
        balance_before = wallet.balance
        wallet.balance += Decimal(str(topup_in.amount))
        db.add(CreditTransaction(
            wallet_id=wallet.id,
            user_id=current_user.id,
            transaction_type=TransactionType.CREDIT,
            amount=topup_in.amount,
            balance_before=balance_before,
            balance_after=wallet.balance,
            reference_type="DEMO_TOPUP",
            reference_id=None,
            description="Demo wallet credit",
            status="SUCCESS"
        ))
        db.add(Notification(
            user_id=current_user.id,
            title="Wallet Top-up Successful",
            message=f"₹{topup_in.amount:.2f} was added to your wallet. New balance: ₹{wallet.balance:.2f}.",
            type=NotificationType.WALLET_CREDIT
        ))
        await db.commit()
        await db.refresh(wallet)
        return TopupResponse(balance=float(wallet.balance), demo_credit=True)

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'inr',
                    'unit_amount': int(topup_in.amount * 100),
                    'product_data': {
                        'name': 'Wallet Top-up',
                        'description': 'Add credits to your Seat Booking App wallet',
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{settings.FRONTEND_URL}/wallet?success=true",
            cancel_url=f"{settings.FRONTEND_URL}/wallet?canceled=true",
            client_reference_id=str(wallet.id),
        )
        
        return TopupResponse(checkout_url=checkout_session.url)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/all", response_model=List[AdminWalletDetail])
async def get_all_wallets_admin(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    result = await db.execute(
        select(Wallet, User)
        .join(User, Wallet.user_id == User.id)
        .offset(skip).limit(limit)
    )
    
    res = []
    for wallet, user in result:
        res.append(AdminWalletDetail(
            id=wallet.id,
            user_id=user.id,
            user_name=user.name,
            user_email=user.email,
            balance=float(wallet.balance),
            currency=wallet.currency,
            status=wallet.status,
            updated_at=wallet.updated_at
        ))
    return res

@router.post("/admin/adjust")
async def adjust_wallet_admin(
    adjust_in: AdminAdjustRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if not adjust_in.reason or len(adjust_in.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="A valid justification reason is required for adjustments")
        
    try:
        if adjust_in.wallet_id:
            wallet_query = select(Wallet).where(Wallet.id == adjust_in.wallet_id).with_for_update()
        elif adjust_in.user_id:
            wallet_query = select(Wallet).where(Wallet.user_id == adjust_in.user_id).with_for_update()
        else:
            raise HTTPException(status_code=400, detail="Either wallet_id or user_id must be provided")

        wallet_result = await db.execute(wallet_query)
        wallet = wallet_result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")

        balance_before = wallet.balance
        adj_amount = Decimal(str(adjust_in.amount))
        
        if adjust_in.transaction_type == TransactionType.DEBIT:
            if wallet.balance < adj_amount:
                raise HTTPException(status_code=400, detail="Insufficient balance for debit adjustment")
            wallet.balance -= adj_amount
        else: # CREDIT or ADJUSTMENT
            wallet.balance += adj_amount
            
        balance_after = wallet.balance
        
        transaction = CreditTransaction(
            wallet_id=wallet.id,
            user_id=wallet.user_id,
            transaction_type=adjust_in.transaction_type,
            amount=adjust_in.amount,
            balance_before=balance_before,
            balance_after=balance_after,
            reference_type="ADMIN_ADJUSTMENT",
            reference_id=str(current_admin.id),
            description=f"Admin Adjustment: {adjust_in.reason.strip()}",
            status="SUCCESS"
        )
        db.add(transaction)
        await db.commit()
        await db.refresh(wallet)
        
        return {
            "status": "success",
            "wallet_id": str(wallet.id),
            "balance_before": float(balance_before),
            "balance_after": float(balance_after),
            "transaction_id": str(transaction.id)
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
