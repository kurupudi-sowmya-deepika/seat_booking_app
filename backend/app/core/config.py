from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Seat Booking API"
    API_V1_STR: str = "/api"
    
    # Database
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: str = "5432"
    DB_NAME: str
    
    @property
    def DATABASE_URL(self) -> str:
        from urllib.parse import quote_plus
        return f"postgresql+asyncpg://{self.DB_USER}:{quote_plus(self.DB_PASSWORD)}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Security
    JWT_SECRET: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    DEMO_WALLET_MODE: bool = True
    DEMO_INITIAL_CREDIT_EMAIL: str = "sdkurupudi@intuceo.com"
    DEMO_INITIAL_CREDIT_AMOUNT: float = 10000.0
    
    # AI Chatbot (OpenRouter - an OpenAI-API-compatible gateway, reached via langchain_openai.ChatOpenAI)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    
    # Entra ID
    ENTRA_TENANT_ID: str = ""
    ENTRA_CLIENT_ID: str = ""
    ENTRA_CLIENT_SECRET: str = ""
    ENTRA_AUTHORITY: str = ""
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        case_sensitive = True
        env_file = "../.env"
        extra = "ignore"

settings = Settings()
