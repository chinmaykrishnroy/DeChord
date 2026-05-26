@echo off
setlocal

call "%~dp0legacy_desktop\run.bat" %*
exit /b %ERRORLEVEL%
