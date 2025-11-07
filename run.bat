@echo off
setlocal EnableExtensions EnableDelayedExpansion

:: --- Always run from this script's folder
set "PROJECT_DIR=%~dp0"
pushd "%PROJECT_DIR%"

:: --- Pick a Python (prefer the launcher)
set "PYEXE="
where /q py  && set "PYEXE=py -3"
if not defined PYEXE (
  where /q python && set "PYEXE=python"
)
if not defined PYEXE (
  echo [DeChord] ERROR: Python 3 not found in PATH.
  popd & exit /b 1
)

:: --- Paths
set "VENV_DIR=%PROJECT_DIR%venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
set "STAMP_FILE=%VENV_DIR%\.req_hash"
set "REQ_FILE=%PROJECT_DIR%requirements.txt"

:: --- Create venv if missing
if not exist "%VENV_PY%" (
  echo [DeChord] Creating virtual environment...
  %PYEXE% -m venv "%VENV_DIR%"
  if errorlevel 1 (
    echo [DeChord] ERROR: venv creation failed.
    popd & exit /b 1
  )
)

:: --- Activate venv
call "%VENV_DIR%\Scripts\activate.bat"
if errorlevel 1 (
  echo [DeChord] ERROR: failed to activate venv.
  popd & exit /b 1
)

:: --- Keep packaging tools fresh (quietly)
python -m pip install --upgrade pip setuptools wheel >nul 2>&1

:: --- Compute a stamp: python/pip versions + requirements content (single-line Python)
set "NEWHASH="
for /f "usebackq delims=" %%H in (`
  python -c "import hashlib,os,subprocess as sp; v=lambda *c: sp.check_output(c,stderr=sp.STDOUT).decode().strip(); d=(v('python','-V')+'\n'+v('python','-m','pip','-V')+'\n').encode(); p=r'%REQ_FILE%'; d+=open(p,'rb').read() if os.path.isfile(p) else b''; print(hashlib.sha256(d).hexdigest())"
`) do set "NEWHASH=%%H"

set "OLDHASH="
if exist "%STAMP_FILE%" set /p "OLDHASH="<"%STAMP_FILE%"

set "NEED_INSTALL="
if not exist "%STAMP_FILE%" (
  set "NEED_INSTALL=1"
) else if /i not "%NEWHASH%"=="%OLDHASH%" (
  set "NEED_INSTALL=1"
)

if defined NEED_INSTALL (
  if exist "%REQ_FILE%" (
    echo [DeChord] Installing / verifying dependencies...
    python -m pip install -r "%REQ_FILE%"
    if errorlevel 1 (
      echo [DeChord] ERROR: dependency install failed.
      if exist "%STAMP_FILE%" del /q "%STAMP_FILE%" >nul 2>&1
      goto :RUNAPP
    )
  )
  >"%STAMP_FILE%" echo %NEWHASH%
) else (
  echo [DeChord] Dependencies already satisfied. Skipping install.
)

:RUNAPP
echo [DeChord] Starting app...
python "%PROJECT_DIR%main.py"
set "STATUS=%ERRORLEVEL%"

:: --- Deactivate venv if available (ignore errors)
deactivate >nul 2>&1

popd
exit /b %STATUS%
