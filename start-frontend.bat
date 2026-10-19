@echo off
setlocal
cd /d "%~dp0frontend"
if not exist "node_modules" (
  echo [INFO] Dang cai npm packages...
  npm install
)
npm run dev
pause
