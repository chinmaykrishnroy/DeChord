@echo off
setlocal

call "%~dp0legacy_desktop\createWindowsShortcut.bat" %*
exit /b %ERRORLEVEL%
