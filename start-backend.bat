@echo off
setlocal
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Khong tim thay backend\.venv. Hay tao venv va cai requirements truoc.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
