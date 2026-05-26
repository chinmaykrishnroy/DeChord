@echo off
setlocal EnableExtensions

set "PROJECT_DIR=%~dp0"
pushd "%PROJECT_DIR%"

set "HOST=127.0.0.1"
set "PORT=8765"
set "BACKEND_URL=http://%HOST%:%PORT%"

set "PYTHON_EXE=%PROJECT_DIR%venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
  echo [DeChord] Creating shared virtual environment...
  py -3 -m venv "%PROJECT_DIR%venv" 2>nul || python -m venv "%PROJECT_DIR%venv"
  if errorlevel 1 (
    echo [DeChord] ERROR: shared virtual environment creation failed.
    popd
    exit /b 1
  )
)

where /q npm
if errorlevel 1 (
  echo [DeChord] ERROR: npm was not found in PATH.
  popd
  exit /b 1
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalAddress %HOST% -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo [DeChord] Starting local backend at %BACKEND_URL%...
  "%PYTHON_EXE%" -m pip install -r backend\requirements-backend.txt
  if errorlevel 1 (
    echo [DeChord] ERROR: backend dependency install failed.
    popd
    exit /b 1
  )

  powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath '%PYTHON_EXE%' -ArgumentList @('-m','uvicorn','backend.app.main:app','--host','%HOST%','--port','%PORT%') -WorkingDirectory '%PROJECT_DIR%'"
  if errorlevel 1 (
    echo [DeChord] ERROR: backend failed to start.
    popd
    exit /b 1
  )

  echo [DeChord] Waiting for backend...
  powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(25); do { try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%BACKEND_URL%/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch { Start-Sleep -Milliseconds 500 } } while ((Get-Date) -lt $deadline); exit 1"
  if errorlevel 1 (
    echo [DeChord] ERROR: backend did not become ready.
    popd
    exit /b 1
  )
) else (
  echo [DeChord] Backend already running at %BACKEND_URL%.
)

pushd "%PROJECT_DIR%frontend"

if not exist "node_modules" (
  echo [DeChord] Installing frontend dependencies...
  npm install
  if errorlevel 1 (
    echo [DeChord] ERROR: frontend dependency install failed.
    popd
    popd
    exit /b 1
  )
)

set "VITE_DECHORD_BACKEND_URL=%BACKEND_URL%"
echo [DeChord] Opening desktop app...
npm run tauri:dev
set "STATUS=%ERRORLEVEL%"

popd
popd
exit /b %STATUS%
