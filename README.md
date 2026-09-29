# 🏢 Seat Booking App - Enterprise Workspace & Resource Management Platform

A modern, production-grade enterprise workspace booking platform built with **React 19 (TypeScript)**, **FastAPI**, **PostgreSQL**, **Microsoft Entra ID (Graph API)**, **Stripe**, and **LangChain/LangGraph AI**.

---

## 🌟 Key Features

### 1. 🔐 Enterprise Authentication & Microsoft Entra ID (SSO)
- **Single Sign-On (SSO):** Frictionless enterprise login powered by `@azure/msal-react` and Microsoft Entra ID.
- **Automated Provisioning:** Automatic user check and account creation in PostgreSQL upon first Microsoft SSO authentication.
- **Microsoft Graph Profile Synchronization:** Fetches and renders the authenticated user's real corporate profile photo (`https://graph.microsoft.com/v1.0/me/photo/$value`) in the top navigation, falling back to name initials.
- **Automated Wallet Initialization:** Each new user receives a dedicated digital corporate wallet upon account creation.
- **Role-Based Access Control (RBAC):** Strict segregation between `USER` (employees/guests) and `ADMIN` (workplace managers) roles.

### 2. 🪑 Interactive Desk & Workspace Booking
- **Visual Spatial Seat Maps:** Interactive 2D floor plans and grid representations showing real-time desk availability.
- **Published Floor Plan Integration:** Seamlessly switches to employee-facing published floor plans created via the interactive floor plan builder.
- **Multi-Slot Selection:** Book single or multiple contiguous/non-contiguous time slots dynamically.
- **Double-Booking Prevention:** Concurrency-safe reservation engine backed by PostgreSQL partial indexes on `(seat_id, booking_date, time_slot_id)` where `status IN ('PENDING', 'CONFIRMED')`.
- **Automatic Price Calculation & Wallet Settlement:** Instant debit of user wallet balance with itemized breakdown.

### 3. 🎥 Smart Meeting Rooms & Conference Halls
- **Granular Scheduling:** Book 15, 30, 45, 60, 90, 120, 180, or 240-minute slots.
- **Visual Availability Timeline:** Live room timeline visualization across working hours (08:00 to 20:00).
- **Amenity Badges & Spatial Filters:** Filter rooms by capacity, projector/smart displays, video conferencing (Teams/Zoom), whiteboard, and air conditioning.

### 4. 🎟️ Multi-Day Flex Day Passes & Group Bookings
- **Consecutive Multi-Day Access:** Book full-day campus access across single or multiple consecutive days in a single flow.
- **Multi-Day Capacity Validation:** Guarantees pass availability across every day in the selected range before confirmation.
- **Group Allocation:** Search fellow colleagues via auto-complete to assign shared passes.

### 5. 👥 Visitor & Guest Management
- **Pre-Registration:** Register external clients, partners, and candidates before their campus visit.
- **Digital Gate Passes & QR Badges:** Generate instant QR-coded visitor passes with host, campus branch, purpose, and arrival time.
- **Front-Desk Lifecycle Tracking:** Live tracking of check-in (`CHECKED_IN`), pending arrival (`PENDING`), and check-out (`CHECKED_OUT`) statuses.

### 6. 💳 Corporate Digital Wallet & Stripe Payments
- **Real-Time Balance Display:** Immediate updates across all views and navigation headers.
- **Stripe Checkout Integration:** Instant wallet top-up using Stripe hosted checkout sessions (`/wallet/checkout`).
- **Transaction History:** Comprehensive ledger tracking all top-ups, booking charges, and refunds with timestamps and reference IDs.

### 7. 🤖 AI Conversational Booking Assistant (LangChain & LangGraph)
- **Natural Language Workspace Concierge:** In-app AI assistant powered by Google Gemini (`gemini-3.1-flash-lite`).
- **Tool-Calling Architecture:** Searches live availability and generates interactive confirmation cards for bookings.

### 8. 🔌 Model Context Protocol (MCP) Server for External AI
- **Exposes 20 Tools for External Agents:** WorkPilot, Intuceo.Ai, Claude Desktop, and Antigravity can query availability and book desks/rooms on behalf of employees.
- **Dual Transport Support:** `stdio` (local subprocess) and `streamable-http` (networked service on port `8100`).

---

## 🏗️ Technical Architecture & Tech Stack

```
seat_booking_app/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # FastAPI REST endpoints (auth, bookings, rooms, floor plans, etc.)
│   │   ├── chatbot/             # LangChain & LangGraph AI agent and tools
│   │   ├── core/                # Config, security, JWT, database session
│   │   ├── models/              # SQLAlchemy async models
│   │   └── schemas/             # Pydantic v2 validation schemas
│   ├── alembic/                 # Database migrations
│   ├── scripts/                 # Seed scripts and maintenance utilities
│   ├── Dockerfile
│   └── entrypoint.sh            # Auto-runs migrations then starts gunicorn
├── frontend/
│   ├── src/
│   │   ├── components/          # UI components, FloorPlanCanvas, ChatbotWidget
│   │   ├── context/             # AuthContext, LocationContext
│   │   ├── layouts/             # MainLayout, AdminLayout
│   │   ├── pages/               # User and Admin views
│   │   └── services/            # Axios API client with automatic JWT injection
│   ├── Dockerfile               # Multi-stage: Vite build -> Nginx
│   └── nginx.conf
├── mcp_server/                  # Model Context Protocol server for external AI agents
│   ├── server.py                # 20 Tool definitions (FastMCP)
│   ├── client.py                # HTTP client to the FastAPI backend (no direct DB access)
│   ├── config.py
│   ├── test_mcp.py              # End-to-end MCP test suite
│   └── Dockerfile
├── docker-compose.yml           # Full stack: postgres + backend + frontend + mcp_server
├── setup.bat                    # 1-Click setup script for Windows
├── setup.sh                     # 1-Click setup script for Linux/macOS
├── SETUP.md                     # Local setup & installation guide
├── DEPLOYMENT.md                # Production deployment runbook
└── .env.example                 # Environment variables template
```

---

## 🚀 Quick Start (Local Development)

### 1. Automated Setup
* **Windows:** Run [`setup.bat`](setup.bat)
* **Linux / macOS:** Run `chmod +x setup.sh && ./setup.sh`

---

### 2. Manual Start

#### Backend Server:
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\Activate.ps1
# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
pip install -r ../mcp_server/requirements.txt
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000
```

#### Frontend Web App:
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

#### MCP Server for AI Agents (Optional):
```powershell
# In root directory:
$env:MCP_TRANSPORT="streamable-http"
$env:MCP_PORT="8100"
python -m mcp_server.server
```

---

## 🌐 Application URLs

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:5173](http://localhost:5173) | Vite Development Server |
| **Production Frontend** | `http://localhost:3000` | Nginx Docker container |
| **FastAPI Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API documentation |
| **Backend Health Check** | [http://localhost:8000/health](http://localhost:8000/health) | Service health check |
| **MCP Server Endpoint** | `http://localhost:8100/mcp` | Streamable HTTP for AI agents |

---

## 🐳 Docker Production Deployment

To run the complete production stack (PostgreSQL + Backend + Frontend + MCP Server):

```bash
cp .env.example .env
docker compose up -d --build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full production deployment documentation, SSL configuration, and systemd guides.

---

## 🔑 Default Test Credentials

| Role | Email | Password | Starting Credits |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@example.com` | `admin123` | ₹50,000.00 |
| **Regular User** | `user@example.com` | `user123` | ₹50,000.00 |
