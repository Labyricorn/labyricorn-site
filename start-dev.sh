#!/bin/bash

echo "========================================"
echo "Starting Labyricorn Development Environment"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "[ERROR] Docker is not running. Please start Docker first."
    exit 1
fi

# Start PostgreSQL database
echo "[1/3] Starting PostgreSQL database..."
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to start database"
    exit 1
fi
echo "[OK] Database started"
echo ""

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 3

# Start backend server in background
echo "[2/3] Starting Django backend server..."
cd backend
source labyricorn/bin/activate
python run_server.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
cd ..
echo "[OK] Backend server starting at http://localhost:8000 (PID: $BACKEND_PID)"
echo ""

# Wait a moment for backend to initialize
sleep 2

# Start frontend server in background
echo "[3/3] Starting React frontend server..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
cd ..
echo "[OK] Frontend server starting at http://localhost:5173 (PID: $FRONTEND_PID)"
echo ""

echo "========================================"
echo "All services started successfully!"
echo "========================================"
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Admin:    http://localhost:8000/admin"
echo "Adminer:  http://localhost:8080"
echo ""
echo "Logs are available in the logs/ directory"
echo "To stop all services, run: ./stop-dev.sh"
echo ""

# Open browser (works on macOS and most Linux distros)
if command -v open > /dev/null; then
    open http://localhost:5173
elif command -v xdg-open > /dev/null; then
    xdg-open http://localhost:5173
fi
