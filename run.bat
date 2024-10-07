@echo off
setlocal

:: Get the absolute path of the current directory
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: Set the virtual environment directory
set "VENV_DIR=%PROJECT_DIR%venv"

:: Check if the virtual environment directory exists
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv "%VENV_DIR%"
)

:: Activate the virtual environment
call "%VENV_DIR%\Scripts\activate.bat"

:: Install the required packages
python -m pip install -r requirements.txt
cls

:: Run the main Python script
python main.py

:: Deactivate the virtual environment
deactivate

endlocal
