# 🛠️ Seat Booking Application - Setup & Installation Guide

This document outlines the step-by-step setup procedure for local development, staging, and production.

---

## ⚡ Quick 1-Click Automated Setup

### Windows Users
Double-click [`setup.bat`](file:///d:/intuceo_projects/seat_booking_app/setup.bat) or run from Command Prompt:
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

## 📋 Manual Setup Instructions

### 1. Prerequisites
- **Node.js**: v18+ & npm
- **Python**: v3.10+
- **PostgreSQL**: v14+

---

### 2. Environment Variables Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your database credentials and secret keys are configured in `.env`:
```env
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seat_booking

JWT_SECRET=your_jwt_secret_key_here
VITE_ENTRA_CLIENT_ID=your_entra_client_id
VITE_ENTRA_TENANT_ID=your_entra_tenant_id
STRIPE_SECRET_KEY=sk_test_...
OPENROUTER_API_KEY=sk-or-v1-...
FRONTEND_URL=http://localhost:3000,http://localhost:5173
VITE_API_URL=http://localhost:8000/api
SEAT_BOOKING_API_URL=http://localhost:8000/api
```

---

### 3. Database Initialization (PostgreSQL)
Create the PostgreSQL database:
```sql
CREATE DATABASE seat_booking;
```

---

### 4. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r ../mcp_server/requirements.txt

# Run migrations
alembic upgrade head

# Seed initial hubs, rooms, desks, and 50,000 initial wallet balances
python scripts/seed.py

# Launch FastAPI server
uvicorn app.main:app --reload --port 8000
```
Swagger API Documentation: **`http://localhost:8000/docs`**

---

### 5. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install --legacy-peer-deps

# Start Vite dev server
npm run dev
```
Web Application Portal: **`http://localhost:3000`**

---

### 6. Model Context Protocol (MCP) Server Setup
For connecting external AI agents (**WorkPilot**, **Intuceo.Ai**, **Claude Desktop**):
```bash
# In the root folder (with python venv active):
python -m mcp_server.server
```

To run the automated diagnostic test suite:
```bash
python -m mcp_server.test_mcp
```

---

## 🔑 Default Credentials

| Role | Email | Password | Starting Wallet Balance |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@example.com` | `admin123` | ₹50,000.00 |
| **Employee User** | `user@example.com` | `user123` | ₹50,000.00 |
| **Microsoft SSO** | *Any corporate email* | *Microsoft SSO* | ₹50,000.00 *(Auto-credited)* |
