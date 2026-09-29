import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Try loading .env from parent directory or current directory
root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env")

class MCPSettings(BaseSettings):
    # Base URL for Seat Booking FastAPI application
    SEAT_BOOKING_API_URL: str = os.getenv("SEAT_BOOKING_API_URL", os.getenv("VITE_API_URL", "http://localhost:8000/api"))
    
    # Default employee credentials for MCP authentication
    SEAT_BOOKING_USER_EMAIL: str = os.getenv("SEAT_BOOKING_USER_EMAIL", os.getenv("DEMO_INITIAL_CREDIT_EMAIL", "sdkurupudi@intuceo.com"))
    SEAT_BOOKING_USER_PASSWORD: str = os.getenv("SEAT_BOOKING_USER_PASSWORD", "user123")
    SEAT_BOOKING_AUTH_TOKEN: str = os.getenv("SEAT_BOOKING_AUTH_TOKEN", os.getenv("MCP_AUTH_TOKEN", ""))
    
    # Optional Entra ID Object ID / Name for seamless SSO provisioning via API
    SEAT_BOOKING_ENTRA_OBJECT_ID: str = os.getenv("SEAT_BOOKING_ENTRA_OBJECT_ID", "mcp-service-principal")
    SEAT_BOOKING_USER_NAME: str = os.getenv("SEAT_BOOKING_USER_NAME", "Intuceo Employee")
    
    # Request timeout in seconds
    REQUEST_TIMEOUT: float = float(os.getenv("MCP_REQUEST_TIMEOUT", "30.0"))

    class Config:
        case_sensitive = True
        extra = "ignore"

settings = MCPSettings()
