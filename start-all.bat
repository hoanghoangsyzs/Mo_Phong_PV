@echo off
setlocal
cd /d "%~dp0"
start "Backend FastAPI" cmd /k start-backend.bat
start "Frontend Vite" cmd /k start-frontend.bat
