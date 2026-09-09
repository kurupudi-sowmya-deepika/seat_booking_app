from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Seat Booking API"
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str
    
    # Security
    JWT_SECRET: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    
    # Entra ID
    ENTRA_TENANT_ID: str = ""
    ENTRA_CLIENT_ID: str = ""
    ENTRA_CLIENT_SECRET: str = ""
    ENTRA_AUTHORITY: str = ""
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
