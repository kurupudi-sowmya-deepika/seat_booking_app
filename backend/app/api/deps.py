from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Annotated, Optional
import jwt
from jwt import PyJWTError as JWTError

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User, UserStatus
from app.schemas.user import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
# auto_error=False: no/invalid token means "anonymous", not a 401 - for public
# browse endpoints that still personalize a little when a caller IS logged in
# (e.g. "is this my booking" on a public room timeline).
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        if token_data.sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.id == token_data.sub))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

async def get_current_user_optional(
    token: Annotated[Optional[str], Depends(oauth2_scheme_optional)],
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Same identity resolution as get_current_user, but returns None instead
    of raising for a missing/invalid token - for endpoints that must stay
    public but still personalize their response for a logged-in caller."""
    if not token:
        return None
    try:
        return await get_current_user(token=token, db=db)
    except HTTPException:
        return None

async def get_current_admin(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user
