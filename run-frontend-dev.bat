@echo off
echo ===================================================
echo   Security Threat Archive - Frontend Dev Server (Vite)
echo ===================================================
set PATH=C:\Program Files\nodejs;%PATH%
cd frontend
echo [INFO] Launching Vite development server (Port 3000)...
echo [INFO] Proxied to backend at http://localhost:8082
call npm run dev
pause
