from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    user = User(
        email=user_in.email,
        name=user_in.name,
        password_hash=get_password_hash(user_in.password),
        auth_provider=AuthProvider.LOCAL,
    )
    db.add(user)
    await db.flush()  # get user.id
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
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer",
    }

from sqlalchemy import select, func, or_

@router.post("/login/entra", response_model=Token)
async def login_entra(
    entra_in: EntraLogin,
    db: AsyncSession = Depends(get_db)
):
    try:
        claims = {}
        try:
            import jwt as pyjwt
            claims = pyjwt.decode(entra_in.token, options={"verify_signature": False})
        except Exception:
            pass

        email = entra_in.email or claims.get("preferred_username") or claims.get("email") or claims.get("upn") or claims.get("unique_name")
        name = entra_in.name or claims.get("name") or (f"{claims.get('given_name', '')} {claims.get('family_name', '')}".strip() if (claims.get('given_name') or claims.get('family_name')) else None)
        oid = entra_in.oid or claims.get("oid") or claims.get("sub")

        if not email and not oid:
            raise HTTPException(status_code=400, detail="Unable to extract user identity from Microsoft token or Graph API")

        # Standardize email
        email_clean = email.strip().lower() if email else f"{oid}@azure.intuceo.com"
        display_name = name.strip() if name and name.strip() else email_clean.split('@')[0]

        # Check if user exists in the database
        query_conditions = []
        if oid:
            query_conditions.append(User.entra_object_id == oid)
        if email_clean:
            query_conditions.append(func.lower(User.email) == email_clean)

        result = await db.execute(select(User).where(or_(*query_conditions)))
        user = result.scalar_one_or_none()

        if user:
            # User exists: update details if necessary
            updated = False
            if oid and user.entra_object_id != oid:
                user.entra_object_id = oid
                updated = True
            if display_name and user.name in ["Entra User", "User", ""] and display_name not in ["Entra User", "User", ""]:
                user.name = display_name
                updated = True
            if user.auth_provider == AuthProvider.LOCAL:
                user.auth_provider = AuthProvider.BOTH
                updated = True
            if updated:
                await db.commit()
                await db.refresh(user)
        else:
            # User does NOT exist: automatically add user to users table
            user = User(
                email=email_clean,
                name=display_name,
                entra_object_id=oid,
                auth_provider=AuthProvider.ENTRA,
            )
            db.add(user)
            await db.flush()  # assign user.id

            # Create default corporate wallet for the new user
            wallet = Wallet(user_id=user.id, balance=0.0)
            db.add(wallet)
            await db.commit()
            await db.refresh(user)

        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return {
            "access_token": create_access_token(user.id, expires_delta=access_token_expires),
            "token_type": "bearer",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid authentication credentials: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
