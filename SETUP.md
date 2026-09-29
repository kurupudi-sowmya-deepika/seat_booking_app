# 🛠️ Seat Booking Application - Setup & Installation Guide

This document outlines the step-by-step setup procedure for local development, testing, and production.

---

## ⚡ Quick 1-Click Automated Setup

### Windows Users
Run `setup.bat` from Command Prompt or PowerShell:
```cmd
setup.bat
```

### macOS / Linux Users
Run the setup shell script:
```bash
chmod +x setup.sh
./setup.sh
```

---

## 📋 Manual Step-by-Step Setup

### 1. Prerequisites
* **Python**: 3.10+
* **Node.js**: 18+ and `npm`
* **PostgreSQL**: 14+ running locally or in Docker

---

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure database credentials, `JWT_SECRET`, and `GEMINI_API_KEY` are configured.

---

### 3. Database Initialization (PostgreSQL)
Create the database in PostgreSQL if it doesn't exist:
```sql
CREATE DATABASE seat_booking;
```

---

### 4. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell / CMD)
.\venv\Scripts\Activate.ps1

# Linux / macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r ../mcp_server/requirements.txt

# Run migrations
alembic upgrade head

# Seed initial hubs, offices, rooms, seats, and test accounts
python scripts/seed.py

# Start FastAPI dev server
uvicorn app.main:app --reload --port 8000
```
* **Swagger API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Backend Health Endpoint:** [http://localhost:8000/health](http://localhost:8000/health)

---

### 5. Frontend Setup
In a new terminal:
```bash
cd frontend

# Install packages
npm install --legacy-peer-deps

# Start Vite dev server
npm run dev
```
* **Frontend Web Application:** [http://localhost:5173](http://localhost:5173)

---

### 6. Model Context Protocol (MCP) Server Setup
In a new terminal:

#### Streamable HTTP Mode (for WorkPilot / Network Clients):
```powershell
$env:MCP_TRANSPORT="streamable-http"
$env:MCP_PORT="8100"
python -m mcp_server.server
```
* **MCP Server Endpoint:** `http://localhost:8100/mcp`

#### Standard I/O Mode (for Claude Desktop / Antigravity IDE):
Add the configuration from `mcp_config.json` into your client configuration:
```json
{
  "mcpServers": {
    "seat-booking": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "d:/intuceo_projects/WorkPilotMcp/seat_booking_app",
      "env": {
        "SEAT_BOOKING_API_URL": "http://localhost:8000/api"
      }
    }
  }
}
```

---

## 🧪 Testing the Setup

To run automated end-to-end MCP verification:
```bash
python -m mcp_server.test_mcp
```

---

## 🔑 Default Test Accounts

| Role | Email | Password | Starting Wallet Balance |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@example.com` | `admin123` | ₹50,000.00 |
| **Regular User** | `user@example.com` | `user123` | ₹50,000.00 |
