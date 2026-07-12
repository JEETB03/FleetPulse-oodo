@echo off
title FleetPulse Control Center
echo ====================================================================
echo                   Starting FleetPulse Full-Stack Services
echo ====================================================================
echo.

:: Check for backend dependencies
echo [1/3] Launching Python/FastAPI Backend Server...
start "FleetPulse Backend" cmd /k "python -m backend.main"

:: Check for frontend dependencies
echo [2/3] Installing Frontend Dependencies...
cd frontend
call npm install
echo.
echo [3/3] Launching React/Vite Frontend Web App...
start "FleetPulse Frontend" cmd /k "npm run dev"

echo.
echo ====================================================================
echo  Services launched successfully!
echo  - Frontend Web UI: http://localhost:5173
echo  - Backend API documentation: http://localhost:8000/docs
echo ====================================================================
echo.
pause
