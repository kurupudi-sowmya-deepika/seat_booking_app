# 🏢 Seat Booking App - Enterprise Workspace & Resource Management Platform

A modern, production-grade enterprise workspace booking platform built with **React 19 (TypeScript)**, **FastAPI**, **PostgreSQL**, **Microsoft Entra ID (Graph API)**, **Stripe**, and **LangChain/LangGraph AI**.

---

## 🌟 Key Functionalities & Features

### 1. 🔐 Enterprise Authentication & Microsoft Entra ID (SSO)
- **Single Sign-On (SSO):** Frictionless enterprise login powered by `@azure/msal-react` and Microsoft Entra ID.
- **Automated Provisioning:** Automatic user check and account creation in PostgreSQL upon first Microsoft SSO authentication.
- **Microsoft Graph Profile Synchronization:** Fetches and renders the authenticated user's real corporate profile photo (`https://graph.microsoft.com/v1.0/me/photo/$value`) in the top navigation and profile views, falling back to name initials.
- **Automated Wallet Initialization:** Each new user receives a dedicated digital corporate wallet upon account creation.
- **Role-Based Access Control (RBAC):** Strict segregation between `USER` (employees/guests) and `ADMIN` (workplace managers) roles.

### 2. 🪑 Interactive Desk & Workspace Booking
- **Visual Spatial Seat Maps:** Interactive 2D floor plans and grid representations showing real-time desk availability.
- **Published Floor Plan Integration:** Seamlessly switches to employee-facing published floor plans created via the interactive floor plan builder.
- **Multi-Slot Selection:** Book single or multiple contiguous/non-contiguous time slots (sourced dynamically from the active administrative Time Slots).
- **Double-Booking Prevention:** Concurrency-safe reservation engine backed by PostgreSQL partial indexes on `(seat_id, booking_date, time_slot_id)` where `status IN ('PENDING', 'CONFIRMED')`.
- **Automatic Price Calculation & Wallet Settlement:** Instant debit of user wallet balance with itemized breakdown.

### 3. 🎥 Smart Meeting Rooms & Conference Halls
- **Granular Hourly & Custom Duration Scheduling:** Book 15, 30, 45, 60, 90, 120, 180, or 240-minute slots.
- **Visual Availability Timeline:** Live room timeline visualization across working hours (08:00 to 20:00).
- **Amenity Badges & Spatial Filters:** Filter rooms by capacity, projector/smart displays, video conferencing (Teams/Zoom), whiteboard, and air conditioning.
- **Expandable Amenity Details:** Clean badge presentation with structured modal exploration for full room specs.

### 4. 🎟️ Multi-Day Flex Day Passes & Group Bookings
- **Consecutive Multi-Day Access:** Book full-day campus access across single or multiple consecutive days in a single flow.
- **Multi-Day Capacity Validation:** Guarantees pass availability across every day in the selected range before confirmation.
- **Group & Additional Attendee Allocation:** Search fellow colleagues via auto-complete to assign shared passes with digital pass issuance.
- **Comprehensive Amenities Included:** High-speed Wi-Fi, ergonomic lounges, cafeteria access, and power backups.

### 5. 👥 Visitor & Guest Management
- **Pre-Registration:** Register external clients, partners, and candidates before their campus visit.
- **Digital Gate Passes & QR Badges:** Generate instant QR-coded visitor passes with host, campus branch, purpose, and arrival time.
- **Printable Reception Badges:** One-click print format for on-site security check-in.
- **Front-Desk Lifecycle Tracking:** Live tracking of check-in (`CHECKED_IN`), pending arrival (`PENDING`), and check-out (`CHECKED_OUT`) statuses.

### 6. 💳 Corporate Digital Wallet & Stripe Payments
- **Real-Time Balance Display:** Immediate updates across all views and navigation headers.
- **Stripe Checkout Integration:** Instant wallet top-up using Stripe hosted checkout sessions (`/wallet/checkout`).
- **Webhook Verification:** Cryptographically signed Stripe webhook listener (`/payments/webhook`) for zero-touch wallet balance credits.
- **Transaction History:** Comprehensive ledger tracking all top-ups, booking charges, and refunds with timestamps and reference IDs.

### 7. 🤖 AI Conversational Booking Assistant (LangChain & LangGraph)
- **Natural Language Workspace Concierge:** Conversational chatbot widget accessible anywhere in the app.
- **Tool-Calling Architecture:** Built with `langchain.agents.create_agent` and `ChatGoogleGenerativeAI` communicating with Google Gemini (default: `gemini-3.1-flash-lite`).
- **Safe Execution Pattern:** AI searches availability and returns interactive confirmation cards; transactions are executed through validated API endpoints upon user confirmation.

### 8. 🛠️ Administrative Command Center & Resource Master
- **Executive Analytics Dashboard:** Confirmed revenue, wallet credit liability, real-time occupancy rates, 7-day reservation trajectory charts, and campus distribution.
- **Location & Branch Hierarchy:** Multi-hub management across international campuses (**Jacksonville, McLean, London, Bangalore, Hyderabad**) with geo-coordinates and time zones.
- **Interactive Floor Plan Designer & AI Room Generator:**
  - Drag-and-drop spatial canvas for rooms, walls, doors, desks, and zones.
  - One-click **Auto-Generate Floor** / **AI Room Generator** powered by `/floor-plans/floors/{floor_id}/generate-rooms`.
  - Draft vs. Published versioning (employees only see published layouts).
- **Facilities & Equipment Master:** Manage AV equipment, ergonomic furniture, and room amenities with categorized specs.
- **Time Slot Engine:** Configurable slot templates with custom start/end times and peak pricing rules.
- **Enterprise System Settings:** Single-row database settings for corporate booking policies, max active bookings, lead times, and SSO toggles.

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
│   ├── tests/                   # Standalone end-to-end test scripts (no pytest)
│   ├── Dockerfile
│   └── entrypoint.sh            # Runs `alembic upgrade head` then starts gunicorn
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components, FloorPlanCanvas, Chatbot
│   │   ├── context/             # AuthContext, LocationContext
│   │   ├── layouts/             # MainLayout, AdminLayout
│   │   ├── pages/               # User and Admin views
│   │   └── services/            # Axios API client with automatic JWT injection
│   ├── Dockerfile               # Multi-stage: Vite build -> nginx
│   └── nginx.conf
├── mcp_server/                  # Model Context Protocol server for external AI agents
│   ├── server.py                # Tool definitions (FastMCP)
│   ├── client.py                # HTTP client to the FastAPI backend (no direct DB access)
│   ├── config.py
│   └── Dockerfile
├── docker-compose.yml           # Full stack: postgres + backend + frontend + mcp_server
├── DEPLOYMENT.md                # Production deployment runbook
└── .env                         # Centralized environment variables (git-ignored)
```

### Stack Components:
- **Frontend:** React 19, TypeScript, Vite, React Router v6, Tailwind CSS, `@azure/msal-react`, Axios, Lucide React, Framer Motion.
- **Backend:** FastAPI, Python 3.10+, SQLAlchemy 2.0 (Async), `asyncpg`, Alembic, PyJWT, Pydantic v2, Uvicorn.
- **Database:** PostgreSQL with partial unique constraints.
- **AI / LLM:** LangChain, LangGraph, Google Gemini (`gemini-3.1-flash-lite`).
- **Payments:** Stripe Checkout & Webhooks.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18+ & npm
- **Python**: 3.10+
- **PostgreSQL**: 14+

### 2. Database Initialization
Create the PostgreSQL database:
```sql
CREATE DATABASE seat_booking;
```

### 3. Environment Variables
Create a `.env` file in the project root:
```env
# Database
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seat_booking

# Security
JWT_SECRET=your_super_secret_jwt_key_here

# Microsoft Entra ID (SSO)
VITE_ENTRA_CLIENT_ID=your_entra_client_id
VITE_ENTRA_TENANT_ID=your_entra_tenant_id
VITE_ENTRA_REDIRECT_URI=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI Chatbot (Google Gemini)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite

# Frontend & CORS
FRONTEND_URL=http://localhost:3000,http://localhost:5173
VITE_API_URL=http://localhost:8000/api

# MCP Server for External AI (WorkPilot / Intuceo.Ai)
SEAT_BOOKING_API_URL=http://localhost:8000/api
MCP_TRANSPORT=stdio
```
See [`.env.example`](.env.example) for the complete, authoritative list of
variables (including `ENVIRONMENT`, `DEMO_WALLET_MODE`, and the rest of the
MCP config) - the block above is just the minimum to get started locally.

### 4. Backend Setup
```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000
```

### 5. Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
Open `http://localhost:3000` in your browser.

### 6. Model Context Protocol (MCP) Server Setup
For connecting external AI agents (**WorkPilot**, **Intuceo.Ai**, **Claude Desktop**):
```bash
# Local subprocess (e.g. Claude Desktop), stdio transport:
python -m mcp_server.server

# Standalone network service another application connects to over HTTP:
MCP_TRANSPORT=streamable-http python -m mcp_server.server
```
Every tool that touches an employee's own data requires a real per-employee
token: call `authenticate_employee(email, password)` first, then pass the
returned `auth_token` to every other tool call. See
[`mcp_server/README.md`](mcp_server/README.md) and
[`mcp_config.json`](mcp_config.json) for the full tool list, authentication
model, and connection manifests for both transports.

Run the end-to-end test (real login, browse, book, verify via REST, cancel)
against a running backend:
```bash
python -m mcp_server.test_mcp
```

---

## 🐳 Docker Deployment

For a full containerized deployment (Postgres + backend + frontend + MCP
server), see [`DEPLOYMENT.md`](DEPLOYMENT.md) for the complete guide. Quick
start:
```bash
# from the repo root, with a real .env in place
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs (health check: `/health`)
- MCP server: http://localhost:8100/mcp

Database migrations run automatically on backend startup
(`backend/entrypoint.sh`); rerun manually with
`docker compose exec backend alembic upgrade head` if needed.

---

## 🔒 Security & Concurrency Highlights
- **Zero Double-Bookings:** Enforced at the relational engine level using PostgreSQL partial indexes.
- **JWT & Bearer Tokens:** Auto-injected in all requests via Axios interceptors and MCP client headers.
- **Verified Microsoft Entra ID Tokens:** `POST /auth/login/entra` cryptographically verifies the incoming token's signature, issuer, and audience against Microsoft's real JWKS (`backend/app/api/routes/auth.py`) - identity is derived only from the verified token, never from client-supplied fields.
- **Zero Direct Database Access for AI Agents:** External agents interact strictly via authenticated MCP tool calls routing through FastAPI business logic; every MCP action is tied to a real employee's own token via `authenticate_employee`, not a shared default account.
- **Stripe Webhook Signatures:** Verified using `stripe.Webhook.construct_event`.
- **Microsoft Graph Avatar Caching:** Cached in local state to minimize roundtrips while preserving real-time synchronization.


