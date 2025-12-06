@echo off
echo ========================================
echo Stopping Labyricorn Development Environment
echo ========================================
echo.

REM Stop Docker containers
echo [1/1] Stopping PostgreSQL database...
docker-compose down
if errorlevel 1 (
    echo [WARNING] Failed to stop database containers
) else (
    echo [OK] Database stopped
)
echo.

REM Kill backend and frontend processes
echo Stopping backend and frontend servers...
taskkill /FI "WINDOWTITLE eq Labyricorn Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Labyricorn Frontend*" /F >nul 2>&1
echo [OK] Servers stopped
echo.

echo ========================================
echo All services stopped successfully!
echo ========================================
echo.
pause
