@echo off
setlocal
set SCRIPT_DIR=%~dp0
set REPO_ROOT=%SCRIPT_DIR%.

rem Launch PowerShell modal tool
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\tools\clasp-helper.ps1"

endlocal
