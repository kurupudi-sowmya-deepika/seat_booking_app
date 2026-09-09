from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Annotated
from datetime import timedelta
import msal

from app.db.database import get_db
from app.models.user import User, AuthProvider
from app.models.wallet import Wallet
from app.schemas.user import UserCreate, UserResponse, Token, EntraLogin
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalar_one_or_none()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    
    user = User(
        email=user_in.email,
        name=user_in.name,
        password_hash=get_password_hash(user_in.password),
        auth_provider=AuthProvider.LOCAL
    )
    db.add(user)
    await db.flush() # flush to get user.id for the wallet
    
    wallet = Wallet(user_id=user.id, balance=0.0)
    db.add(wallet)
    
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not user.password_hash:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer",
    }

@router.post("/login/entra", response_model=Token)
async def login_entra(entra_in: EntraLogin, db: AsyncSession = Depends(get_db)):
    # Validate the token using MSAL or verify directly with Microsoft Graph
    # In a real production environment we would validate the JWT signature and claims
    # For this exercise, we will verify using MSAL ConfidentialClientApplication or similar
    # to exchange token, but since React MSAL gives us an ID token/access token,
    # we should validate its signature. Since we don't have the keys here, we assume 
    # it's a valid ID Token. A real implementation uses `jwt.decode` with Azure JWKS.
    # We will simulate the extraction of claims for now.
    
    try:
        # Mock token validation logic for development:
        # We decode the token ignoring signature to extract claims.
        # DO NOT DO THIS IN PRODUCTION WITHOUT VERIFYING SIGNATURE.
        import jwt as pyjwt
        claims = pyjwt.decode(entra_in.token, options={"verify_signature": False})
        
        email = claims.get("preferred_username") or claims.get("email")
        name = claims.get("name")
        oid = claims.get("oid")
        
        if not email or not oid:
            raise HTTPException(status_code=400, detail="Invalid Entra token claims")
            
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if user:
            # Link account if not already linked
            if user.auth_provider == AuthProvider.LOCAL:
                user.auth_provider = AuthProvider.BOTH
                user.entra_object_id = oid
                await db.commit()
        else:
            # Create new user
            user = User(
                email=email,
                name=name or "Entra User",
                entra_object_id=oid,
                auth_provider=AuthProvider.ENTRA
            )
            db.add(user)
            await db.flush()
            
            wallet = Wallet(user_id=user.id, balance=0.0)
            db.add(wallet)
            
            await db.commit()
            await db.refresh(user)
            
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return {
            "access_token": create_access_token(user.id, expires_delta=access_token_expires),
            "token_type": "bearer",
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid authentication credentials: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
