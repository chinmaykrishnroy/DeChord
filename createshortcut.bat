@echo off
setlocal

:: Define paths
set "TARGET_PATH=%~dp0quickrun.bat"   :: Path to the batch file you want to hide and run
set "ICON_PATH=%~dp0icon"      :: Path to the icon file in the current directory
set "SHORTCUT_NAME=DeChord"
set "SHORTCUT_PATH=%~dp0%SHORTCUT_NAME%.lnk"
set "VBS_PATH=%~dp0hideWindowsTerminal.vbs"  :: Path to the external VBS script

:: Ensure the VBS file exists
if not exist "%VBS_PATH%" (
    echo Error: %VBS_PATH% not found. Please ensure hideWindowsTerminal.vbs exists.
    exit /b 1
)

:: Create the shortcut using PowerShell
powershell -command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_PATH%\" \"%TARGET_PATH%\"'; $s.IconLocation = '%ICON_PATH%'; $s.Save()"

:: Check if the shortcut was created successfully
if exist "%SHORTCUT_PATH%" (
    echo Shortcut created: %SHORTCUT_PATH%
) else (
    echo Error: Failed to create the shortcut.
)

endlocal
