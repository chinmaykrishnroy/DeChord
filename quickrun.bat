@echo off
setlocal

:: Get the absolute path of the current directory
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: Check if Python is installed
where /q python
if errorlevel 1 (
    echo Python not found. Please install Python to continue.
    exit /b 1
)

:: Set the virtual environment directory
set "VENV_DIR=%PROJECT_DIR%venv"

:: Check if the virtual environment directory exists
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Virtual environment not found. Running run.bat to create it...
    call "%PROJECT_DIR%run.bat"
    exit /b
)

:: Activate the virtual environment
call "%VENV_DIR%\Scripts\activate.bat"

cls
:: Run the main Python script
python "%PROJECT_DIR%main.py"

:: Deactivate the virtual environment
deactivate

endlocal