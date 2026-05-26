@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "TARGET_PATH=%PROJECT_DIR%run.bat"
set "SHORTCUT_NAME=DeChord Legacy"
set "SHORTCUT_PATH=%PROJECT_DIR%%SHORTCUT_NAME%.lnk"
set "VBS_PATH=%PROJECT_DIR%legacy_desktop\hideWindowsTerminal.vbs"
set "ICON_PATH=%PROJECT_DIR%legacy_desktop\icon"

if not exist "%VBS_PATH%" (
  echo Error: %VBS_PATH% not found.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s  = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$s.TargetPath = 'wscript.exe'; " ^
  "$s.Arguments = '\"%VBS_PATH%\" \"\"\"%TARGET_PATH%\"\"\"'; " ^
  "$s.WorkingDirectory = '%PROJECT_DIR%'; " ^
  "$s.IconLocation = '%ICON_PATH%'; " ^
  "$s.Save();"

if exist "%SHORTCUT_PATH%" (
  echo Shortcut created: %SHORTCUT_PATH%
) else (
  echo Error: Failed to create the shortcut.
  exit /b 1
)

endlocal
