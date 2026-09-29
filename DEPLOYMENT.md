# 🚀 Production Deployment Guide

This document contains the complete production runbook for deploying the **Seat Booking Application** across various deployment environments:
- **Docker Compose (Full-Stack)**
- **Cloud Virtual Machines (Linux / Ubuntu / Systemd)**
- **Cloud Containers & PaaS (AWS ECS / Azure App Service / GCP / Render / Railway)**
- **Model Context Protocol (MCP) Server for External AI (WorkPilot / Claude / Antigravity)**

---

## 1. Architecture & Port Reference

```
                             [ Internet / Users ]
                                      │
            ┌─────────────────────────┼────────────────────────┐
            ▼                         ▼                        ▼
  ┌───────────────────┐     ┌───────────────────┐    ┌───────────────────┐
  │   React Frontend  │     │  FastAPI Backend  │    │    MCP Server     │
  │  (Nginx / Static) │     │ (Gunicorn+Uvicorn)│    │ (FastMCP / SSE)   │
  │    Port: 3000     │     │    Port: 8000     │    │    Port: 8100     │
  └─────────┬─────────┘     └─────────┬─────────┘    └─────────┬─────────┘
            │                         │                        │
            └─────────────┐ ┌─────────┘                        │
                          ▼ ▼                                  ▼
                ┌───────────────────┐                ┌───────────────────┐
                │ PostgreSQL (v16)  │                │ FastAPI REST API  │
                │    Port: 5432     │◄───────────────┤ (via HTTP Client) │
                └───────────────────┘                └───────────────────┘
```

| Service | Container / Process | Port | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | `frontend` (Nginx) | `3000` (or `80`/`443`) | User Portal & Admin Web Application |
| **Backend** | `backend` (Gunicorn/Uvicorn) | `8000` | REST API, Auth, Stripe, Gemini Chatbot |
| **MCP Server** | `mcp_server` (FastMCP) | `8100` | Model Context Protocol API for AI Agents |
| **Database** | `postgres` (PostgreSQL 16) | `5432` | Relational database with asyncpg |

---

## 2. Environment Variables Reference

Create a root `.env` file (copied from `.env.example`).

```env
# ==============================================================================
# Database Configuration (PostgreSQL)
# ==============================================================================
DB_USER=postgres
DB_PASSWORD=your_secure_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seat_booking

# ==============================================================================
# Security & JWT Authentication
# ==============================================================================
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=11520

# ==============================================================================
# Microsoft Entra ID (Single Sign-On & Graph API)
# ==============================================================================
ENTRA_TENANT_ID=your_entra_tenant_id
ENTRA_CLIENT_ID=your_entra_client_id
ENTRA_CLIENT_SECRET=your_entra_client_secret
VITE_ENTRA_CLIENT_ID=your_entra_client_id
VITE_ENTRA_TENANT_ID=your_entra_tenant_id
VITE_ENTRA_REDIRECT_URI=https://your-domain.com

# ==============================================================================
# Stripe Payment Gateway
# ==============================================================================
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DEMO_WALLET_MODE=false

# ==============================================================================
# Google Gemini / LLM Integration (In-App Chatbot Concierge)
# ==============================================================================
# Generate at: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite

# ==============================================================================
# Model Context Protocol (MCP) Server for External AI (WorkPilot / Intuceo.Ai)
# ==============================================================================
SEAT_BOOKING_API_URL=http://localhost:8000/api
MCP_TRANSPORT=streamable-http
MCP_HOST=0.0.0.0
MCP_PORT=8100
MCP_ALLOW_DEFAULT_IDENTITY=false
WORKPILOT_SERVICE_TOKEN=
MCP_AUTH_TOKEN=

# ==============================================================================
# Frontend & CORS Configuration
# ==============================================================================
ENVIRONMENT=production
FRONTEND_URL=https://your-domain.com,http://localhost:3000
VITE_API_URL=https://api.your-domain.com/api
```

---

## 3. Option A: Full-Stack Deployment via Docker Compose (Recommended)

### Step 1: Clone Repository and Setup `.env`
```bash
git clone https://github.com/kurupudi-sowmya-deepika/seat_booking_app.git
cd seat_booking_app
cp .env.example .env
# Edit .env with your production values
nano .env
```

### Step 2: Build and Start Containers
```bash
docker compose up -d --build
```

### Step 3: Verify Status & Healthchecks
```bash
docker compose ps
docker compose logs -f backend
```

> **Note:** The backend container automatically executes `alembic upgrade head` on startup via `backend/entrypoint.sh`.

### Step 4: (Optional) Seed Initial Master Data
For fresh demo/staging instances:
```bash
docker compose exec backend python scripts/seed.py
```

---

## 4. Option B: Standalone Linux VM / VPS Deployment (Systemd)

If hosting the backend and MCP server on an Ubuntu/Debian Linux server:

### 1. System Packages & Python Setup
```bash
sudo apt update && sudo apt install -y python3-venv python3-pip postgresql nginx curl
git clone https://github.com/kurupudi-sowmya-deepika/seat_booking_app.git /var/www/seat_booking
cd /var/www/seat_booking

python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
pip install -r mcp_server/requirements.txt
```

### 2. Backend Systemd Service (`/etc/systemd/system/seat-booking-backend.service`)
```ini
[Unit]
Description=Seat Booking FastAPI Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/seat_booking/backend
EnvironmentFile=/var/www/seat_booking/.env
ExecStart=/var/www/seat_booking/.venv/bin/gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 3. MCP Server Systemd Service (`/etc/systemd/system/seat-booking-mcp.service`)
```ini
[Unit]
Description=Seat Booking MCP Server (Streamable HTTP)
After=network.target seat-booking-backend.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/seat_booking
EnvironmentFile=/var/www/seat_booking/.env
Environment="MCP_TRANSPORT=streamable-http"
Environment="MCP_HOST=0.0.0.0"
Environment="MCP_PORT=8100"
Environment="SEAT_BOOKING_API_URL=http://127.0.0.1:8000/api"
ExecStart=/var/www/seat_booking/.venv/bin/python -m mcp_server.server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 4. Enable and Start Services
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now seat-booking-backend
sudo systemctl enable --now seat-booking-mcp
```

---

## 5. Reverse Proxy Configuration (Nginx & SSL)

Create `/etc/nginx/sites-available/seat_booking.conf`:

```nginx
# 1. Frontend Web App
server {
    listen 80;
    server_name app.yourcompany.com;

    location / {
        root /var/www/seat_booking/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}

# 2. FastAPI Backend REST API
server {
    listen 80;
    server_name api.yourcompany.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 3. MCP Server Streamable HTTP Endpoint (for WorkPilot / AI)
server {
    listen 80;
    server_name mcp.yourcompany.com;

    location / {
        proxy_pass http://127.0.0.1:8100;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable SSL via Certbot:
```bash
sudo certbot --nginx -d app.yourcompany.com -d api.yourcompany.com -d mcp.yourcompany.com
```

---

## 6. Connecting AI Agents to the Deployed MCP Server

In **WorkPilot**, **Intuceo.Ai**, or any MCP-compatible agent:

```json
{
  "name": "seat-booking",
  "type": "streamable-http",
  "url": "https://mcp.yourcompany.com/mcp"
}
```

### Agent Authentication Flow:
1. Agent calls `authenticate_employee(email, password)` to receive a user session token.
2. Agent uses that token for tools like `search_available_seats`, `book_seat`, `get_my_bookings`, `cancel_my_booking`.
3. All bookings reflect instantly in the production database and user web dashboard.
