@echo off
echo ===================================================
echo   Security Threat Archive - Frontend Build Script
echo ===================================================
set PATH=C:\Program Files\nodejs;%PATH%
cd frontend
echo [1/1] Building React/TypeScript production assets...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed.
    pause
    exit /b %errorlevel%
)
echo.
echo [SUCCESS] Build completed successfully!
echo Assets copied to src/main/resources/static
pause
