import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Try loading .env from parent directory or current directory
root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env")

def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")

class MCPSettings(BaseSettings):
    # Base URL for Seat Booking FastAPI application
    SEAT_BOOKING_API_URL: str = os.getenv("SEAT_BOOKING_API_URL", os.getenv("VITE_API_URL", "http://localhost:8000/api"))

    # Transport this server listens on: "stdio" (spawned locally as a subprocess,
    # e.g. by Claude Desktop) or "streamable-http" (a standalone network service
    # a separate application - WorkPilot/Intuceo.Ai - can connect to over HTTP).
    MCP_TRANSPORT: str = os.getenv("MCP_TRANSPORT", "stdio")
    MCP_HOST: str = os.getenv("MCP_HOST", "0.0.0.0")
    MCP_PORT: int = int(os.getenv("MCP_PORT", "8100"))

    # Bearer token every MCP client must present (Authorization: Bearer ...) when running over
    # streamable-http. REQUIRED whenever WORKPILOT_SERVICE_TOKEN is set - see server.py.
    MCP_AUTH_TOKEN: str = os.getenv("MCP_AUTH_TOKEN", "")

    # Shared secret with the Seat Booking backend (its WORKPILOT_SERVICE_TOKEN). When set, tools
    # that receive `employee_email` act as that EXISTING employee via the backend's trusted-caller
    # path (X-Service-Token + X-On-Behalf-Of-Email) instead of needing that employee's password.
    WORKPILOT_SERVICE_TOKEN: str = os.getenv("WORKPILOT_SERVICE_TOKEN", "")

    # A single shared "default employee" identity used ONLY when a tool call
    # supplies neither `auth_token` nor `employee_email` - convenient for local/
    # Claude-Desktop testing, but must stay disabled in production so every
    # action is attributable to a real employee who authenticated via
    # `authenticate_employee` (see server.py), not a silently-shared account.
    MCP_ALLOW_DEFAULT_IDENTITY: bool = _env_bool("MCP_ALLOW_DEFAULT_IDENTITY", False)
    SEAT_BOOKING_USER_EMAIL: str = os.getenv("SEAT_BOOKING_USER_EMAIL", os.getenv("DEMO_INITIAL_CREDIT_EMAIL", ""))
    # No insecure literal default: a real password must come from the
    # environment, never be baked into source.
    SEAT_BOOKING_USER_PASSWORD: str = os.getenv("SEAT_BOOKING_USER_PASSWORD", "")
    SEAT_BOOKING_AUTH_TOKEN: str = os.getenv("SEAT_BOOKING_AUTH_TOKEN", os.getenv("MCP_AUTH_TOKEN", ""))

    # Request timeout in seconds
    REQUEST_TIMEOUT: float = float(os.getenv("MCP_REQUEST_TIMEOUT", "30.0"))

    class Config:
        case_sensitive = True
        extra = "ignore"

settings = MCPSettings()
