import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.wallet import Wallet, CreditTransaction, TransactionType
from app.core.config import settings

router = APIRouter()

@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        wallet_id = session.get("client_reference_id")
        payment_intent_id = session.get("payment_intent") or session.get("id")
        
        # Determine the topup amount (amount_total is in cents/paise)
        amount = session.get("amount_total", 0) / 100.0
        
        if wallet_id and amount > 0:
            # Check idempotency
            existing_tx = await db.execute(
                select(CreditTransaction).where(CreditTransaction.reference_id == str(payment_intent_id))
            )
            if existing_tx.scalar_one_or_none():
                return {"status": "success", "message": "Already processed"}
                
            wallet_result = await db.execute(
                select(Wallet).where(Wallet.id == wallet_id).with_for_update()
            )
            wallet = wallet_result.scalar_one_or_none()
            if wallet:
                balance_before = wallet.balance
                wallet.balance += amount
                balance_after = wallet.balance
                
                transaction = CreditTransaction(
                    wallet_id=wallet.id,
                    user_id=wallet.user_id,
                    transaction_type=TransactionType.CREDIT,
                    amount=amount,
                    balance_before=balance_before,
                    balance_after=balance_after,
                    reference_type="STRIPE_TOPUP",
                    reference_id=str(payment_intent_id),
                    description="Wallet Recharge via Stripe Checkout",
                    status="SUCCESS"
                )
                db.add(transaction)
                await db.commit()

    return {"status": "success"}

