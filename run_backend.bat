@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "HOST=127.0.0.1"
set "PORT=8765"

if exist "venv\Scripts\python.exe" (
    set "PYTHON=venv\Scripts\python.exe"
) else (
    set "PYTHON=python"
)

echo [DeChord Backend] Using %PYTHON%
echo [DeChord Backend] Installing backend dependencies...
"%PYTHON%" -m pip install -r backend\requirements-backend.txt
if errorlevel 1 (
    echo [DeChord Backend] Dependency install failed.
    pause
    exit /b 1
)

:find_port
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>nul
if errorlevel 1 (
    echo [DeChord Backend] Port %PORT% is busy, trying next port...
    set /a PORT+=1
    goto find_port
)

set "APP_URL=http://%HOST%:%PORT%/"
echo [DeChord Backend] Starting at %APP_URL%
echo [DeChord Backend] Tester page: %APP_URL%
echo [DeChord Backend] Press Ctrl+C to stop.

"%PYTHON%" -m uvicorn backend.app.main:app --host %HOST% --port %PORT% --reload
