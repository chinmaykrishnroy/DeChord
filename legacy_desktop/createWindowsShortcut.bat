:: createShortcut.bat
@echo off
setlocal

:: Resolve paths
set "PROJECT_DIR=%~dp0"
set "TARGET_PATH=%PROJECT_DIR%run.bat"
set "SHORTCUT_NAME=DeChord"
set "SHORTCUT_PATH=%PROJECT_DIR%%SHORTCUT_NAME%.lnk"
set "VBS_PATH=%PROJECT_DIR%hideWindowsTerminal.vbs"
set "ICON_PATH=%PROJECT_DIR%icon"

:: Ensure VBS exists (this VBS should accept: 1) target batch path and run hidden)
if not exist "%VBS_PATH%" (
  echo Error: %VBS_PATH% not found. Please ensure hideWindowsTerminal.vbs exists.
  exit /b 1
)

:: Create shortcut via PowerShell (hidden run through the VBS wrapper)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s  = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$s.TargetPath     = 'wscript.exe'; " ^
  "$s.Arguments      = '\"%VBS_PATH%\" \"\"\"%TARGET_PATH%\"\"\"'; " ^
  "$s.WorkingDirectory = '%PROJECT_DIR%'; " ^
  "$s.IconLocation   = '%ICON_PATH%'; " ^
  "$s.Save();"

if exist "%SHORTCUT_PATH%" (
  echo Shortcut created: %SHORTCUT_PATH%
) else (
  echo Error: Failed to create the shortcut.
  exit /b 1
)

endlocal
