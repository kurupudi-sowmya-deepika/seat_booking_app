@echo off
setlocal enabledelayedexpansion

echo =====================================================================
echo  SEAT BOOKING APPLICATION - AUTOMATED SETUP SCRIPT
echo =====================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to PATH.
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)
echo [OK] Python detected.

:: 2. Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not added to PATH.
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js detected.

:: 3. Configure .env file
echo.
echo [1/4] Checking Environment Configuration (.env)...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [INFO] Created .env from .env.example.
        echo [IMPORTANT] Please configure your database credentials and API keys in .env.
    ) else (
        echo [WARNING] .env.example not found. Please create .env manually.
    )
) else (
    echo [OK] .env file already exists.
)

:: 4. Setup Backend
echo.
echo [2/4] Setting up Backend (Python Virtual Environment & Dependencies)...
cd backend
if not exist "venv" if not exist ".venv" (
    echo [INFO] Creating Python virtual environment in backend/venv...
    python -m venv venv
)

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)

echo [INFO] Installing backend Python packages...
pip install -r requirements.txt --quiet
pip install -r ..\mcp_server\requirements.txt --quiet

echo.
echo [3/4] Running Database Migrations & Initial Seed Data...
alembic upgrade head
if %errorlevel% neq 0 (
    echo [WARNING] Alembic migrations encountered an issue. Ensure PostgreSQL is running and DB_NAME exists in .env.
)

python scripts\seed.py
if %errorlevel% neq 0 (
    echo [WARNING] Database seed script encountered an issue.
)
cd ..

:: 5. Setup Frontend
echo.
echo [4/4] Setting up Frontend (Node Modules)...
cd frontend
call npm install --legacy-peer-deps
cd ..

echo.
echo =====================================================================
echo  SETUP COMPLETED SUCCESSFULLY!
echo =====================================================================
echo.
echo To start the application, open separate terminal windows:
echo.
echo 1. Backend Server:
echo    cd backend
echo    .\venv\Scripts\activate
echo    uvicorn app.main:app --reload --port 8000
echo.
echo 2. Frontend Web App:
echo    cd frontend
echo    npm run dev
echo.
echo 3. (Optional) MCP Server for AI Agents:
echo    $env:MCP_TRANSPORT="streamable-http"
echo    $env:MCP_PORT="8100"
echo    python -m mcp_server.server
echo.
echo Access URLs:
echo - Frontend Web App:  http://localhost:5173
echo - Swagger API Docs:  http://localhost:8000/docs
echo - MCP Server:        http://localhost:8100/mcp
echo.
pause
