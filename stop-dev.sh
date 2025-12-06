#!/bin/bash

echo "========================================"
echo "Stopping Labyricorn Development Environment"
echo "========================================"
echo ""

# Stop Docker containers
echo "[1/3] Stopping PostgreSQL database..."
docker-compose down
if [ $? -ne 0 ]; then
    echo "[WARNING] Failed to stop database containers"
else
    echo "[OK] Database stopped"
fi
echo ""

# Stop backend server
echo "[2/3] Stopping backend server..."
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    kill $BACKEND_PID 2>/dev/null
    rm logs/backend.pid
    echo "[OK] Backend stopped (PID: $BACKEND_PID)"
else
    echo "[WARNING] Backend PID file not found"
fi
echo ""

# Stop frontend server
echo "[3/3] Stopping frontend server..."
if [ -f logs/frontend.pid ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    kill $FRONTEND_PID 2>/dev/null
    rm logs/frontend.pid
    echo "[OK] Frontend stopped (PID: $FRONTEND_PID)"
else
    echo "[WARNING] Frontend PID file not found"
fi
echo ""

echo "========================================"
echo "All services stopped successfully!"
echo "========================================"
echo ""
