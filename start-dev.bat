@echo off
echo ========================================
echo Starting Labyricorn Development Environment
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start PostgreSQL database
echo [1/3] Starting PostgreSQL database...
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Failed to start database
    pause
    exit /b 1
)
echo [OK] Database started
echo.

REM Wait for database to be ready
echo Waiting for database to be ready...
timeout /t 3 /nobreak >nul

REM Start backend server in new window
echo [2/3] Starting Django backend server...
start "Labyricorn Backend" cmd /k "cd backend && labyricorn\Scripts\activate && python run_server.py"
echo [OK] Backend server starting at http://localhost:8000
echo.

REM Wait a moment for backend to initialize
timeout /t 2 /nobreak >nul

REM Start frontend server in new window
echo [3/3] Starting React frontend server...
start "Labyricorn Frontend" cmd /k "cd frontend && npm run dev"
echo [OK] Frontend server starting at http://localhost:5173
echo.

echo ========================================
echo All services started successfully!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo Admin:    http://localhost:8000/admin
echo Adminer:  http://localhost:8080
echo.
echo Press any key to open the site in your browser...
pause >nul

REM Open browser
start http://localhost:5173

echo.
echo To stop all services, close the terminal windows
echo or run: stop-dev.bat
echo.
