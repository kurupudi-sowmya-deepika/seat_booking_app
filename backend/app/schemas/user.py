from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from app.models.user import UserRole, AuthProvider, UserStatus

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class EntraLogin(BaseModel):
    token: str
    email: Optional[str] = None
    name: Optional[str] = None
    oid: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    role: UserRole
    auth_provider: AuthProvider
    status: UserStatus
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
