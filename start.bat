@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\spendwise.ps1" start
if errorlevel 1 (
  echo.
  echo SpendWise did not start. Read the messages above.
  pause
  exit /b 1
)

echo.
echo SpendWise is running in two separate windows.
echo   Web UI:  http://localhost:3000
echo   API:     http://localhost:5000
echo.
echo Run stop.bat when you are done.
"%SystemRoot%\System32\ping.exe" -n 9 127.0.0.1 >nul
endlocal
