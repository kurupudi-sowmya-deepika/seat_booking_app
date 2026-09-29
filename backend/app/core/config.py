import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional
from dotenv import load_dotenv

# Find root .env file
root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"
backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(backend_env)
load_dotenv(root_env)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Seat Booking API"
    API_V1_STR: str = "/api"

    # "development" (default) or "production". Only used to gate dev-only
    # conveniences (see main.py's CORS setup) - not a general feature flag.
    ENVIRONMENT: str = "development"

    # Database
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"
    DB_NAME: str = "seat_booking"
    
    @property
    def DATABASE_URL(self) -> str:
        from urllib.parse import quote_plus
        return f"postgresql+asyncpg://{self.DB_USER}:{quote_plus(self.DB_PASSWORD)}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Security
    JWT_SECRET: str = "seat-booking-jwt-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    # Trusted service-to-service caller (WorkPilot backend, via the Seat Booking MCP server).
    # When set, a request carrying a matching `X-Service-Token` header may act as an EXISTING,
    # ACTIVE user named by `X-On-Behalf-Of-Email`. Empty (default) = feature disabled.
    # Generate with e.g. `openssl rand -hex 32`; it must match the caller's own setting.
    WORKPILOT_SERVICE_TOKEN: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    # Wallet & Credits
    DEFAULT_INITIAL_WALLET_BALANCE: float = 50000.0
    # Lets a logged-in user top up their own wallet with no real Stripe charge -
    # a local-demo convenience only. Defaults off; set true explicitly (e.g. in
    # a local .env) for demos, never in production.
    DEMO_WALLET_MODE: bool = False
    DEMO_INITIAL_CREDIT_EMAIL: str = "sdkurupudi@intuceo.com"
    DEMO_INITIAL_CREDIT_AMOUNT: float = 50000.0
    
    # AI Chatbot (Google Gemini via langchain_google_genai.ChatGoogleGenerativeAI)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    
    # Entra ID
    ENTRA_TENANT_ID: str = ""
    ENTRA_CLIENT_ID: str = ""
    ENTRA_CLIENT_SECRET: str = ""
    ENTRA_AUTHORITY: str = ""
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        case_sensitive = True
        env_file = (
            str(Path(__file__).resolve().parent.parent.parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
            ".env",
            "../.env"
        )
        extra = "ignore"

settings = Settings()

