import hmac

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
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

SERVICE_TOKEN_HEADER = "x-service-token"
ON_BEHALF_HEADER = "x-on-behalf-of-email"


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _service_token_matches(supplied: str) -> bool:
    configured = settings.WORKPILOT_SERVICE_TOKEN
    # Constant-time compare; a disabled (empty) token never matches anything.
    return bool(configured) and hmac.compare_digest(supplied.encode("utf-8"), configured.encode("utf-8"))


async def _user_from_trusted_caller(request: Request, db: AsyncSession) -> Optional[User]:
    """Resolve the acting user for a trusted service call (WorkPilot via the MCP server).

    Returns None when the request is not a service call. Otherwise the shared secret must match
    and the named user must ALREADY exist - this path never creates accounts and never elevates a
    role: the caller acts with exactly that user's own role and permissions.
    """
    supplied = request.headers.get(SERVICE_TOKEN_HEADER)
    if supplied is None:
        return None
    if not _service_token_matches(supplied):
        raise _credentials_error()
    email = (request.headers.get(ON_BEHALF_HEADER) or "").strip().lower()
    if not email:
        raise _credentials_error()
    result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise _credentials_error()
    return user


async def get_current_user(
    request: Request,
    token: Annotated[Optional[str], Depends(oauth2_scheme_optional)],
    db: AsyncSession = Depends(get_db)
) -> User:
    user = await _user_from_trusted_caller(request, db)
    if user is None:
        if not token:
            raise _credentials_error()
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
            token_data = TokenPayload(**payload)
            if token_data.sub is None:
                raise _credentials_error()
        except JWTError:
            raise _credentials_error()

        result = await db.execute(select(User).where(User.id == token_data.sub))
        user = result.scalar_one_or_none()

    if user is None:
        raise _credentials_error()
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

async def get_current_user_optional(
    request: Request,
    token: Annotated[Optional[str], Depends(oauth2_scheme_optional)],
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Same identity resolution as get_current_user, but returns None instead
    of raising for a missing/invalid token - for endpoints that must stay
    public but still personalize their response for a logged-in caller."""
    if not token:
        return None
    try:
        return await get_current_user(request=request, token=token, db=db)
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
