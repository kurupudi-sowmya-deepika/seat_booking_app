#!/usr/bin/env bash
set -e

echo "====================================================================="
echo " SEAT BOOKING APPLICATION - AUTOMATED SETUP SCRIPT"
echo "====================================================================="
echo ""

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed or not in PATH."
    exit 1
fi
echo "[OK] Python detected: $(python3 --version)"

# 2. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    exit 1
fi
echo "[OK] Node.js detected: $(node --version)"

# 3. Environment Configuration
echo ""
echo "[1/4] Checking Environment Configuration (.env)..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "[INFO] Created .env from .env.example."
        echo "[IMPORTANT] Update your PostgreSQL credentials in .env if needed."
    else
        echo "[WARNING] .env.example not found. Please create .env manually."
    fi
else
    echo "[OK] .env file already exists."
fi

# 4. Setup Backend
echo ""
echo "[2/4] Setting up Backend..."
cd backend
if [ ! -d ".venv" ]; then
    echo "[INFO] Creating Python virtual environment in backend/.venv..."
    python3 -m venv .venv
fi

source .venv/bin/activate
echo "[INFO] Installing Python dependencies..."
pip install -r requirements.txt --quiet
pip install -r ../mcp_server/requirements.txt --quiet

echo ""
echo "[3/4] Running Database Migrations & Initial Seed Data..."
alembic upgrade head || echo "[WARNING] Alembic migration failed. Ensure PostgreSQL is running."
python3 scripts/seed.py || echo "[WARNING] Seed script failed."
cd ..

# 5. Setup Frontend
echo ""
echo "[4/4] Setting up Frontend..."
cd frontend
npm install --legacy-peer-deps
cd ..

echo ""
echo "====================================================================="
echo " SETUP COMPLETED SUCCESSFULLY!"
echo "====================================================================="
echo ""
echo "To start the application, open two separate terminal windows:"
echo ""
echo "1. Backend Server:"
echo "   cd backend && source .venv/bin/activate"
echo "   uvicorn app.main:app --reload --port 8000"
echo ""
echo "2. Frontend Web App:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "3. (Optional) MCP Server for AI Agents:"
echo "   python3 -m mcp_server.server"
echo ""
echo "Access URLs:"
echo "- Frontend: http://localhost:3000"
echo "- Backend:  http://localhost:8000/docs"
echo ""
