@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%."

cd /d "%REPO_ROOT%"

where clasp >nul 2>&1
if errorlevel 1 (
  echo [Erreur] L'outil clasp est introuvable. Veuillez l'installer ou l'ajouter au PATH.
  pause
  exit /b 1
)

where pwsh >nul 2>&1
if %errorlevel%==0 (
  set "PS=pwsh"
) else (
  set "PS=powershell"
)

"%PS%" -NoLogo -NoProfile -Sta -ExecutionPolicy Bypass -File "%REPO_ROOT%\tools\clasp-helper.ps1"
set ERR=%errorlevel%
if not "%ERR%"=="0" (
  echo.
  echo [Erreur] Le lanceur a rencontre une erreur (code %ERR%).
  echo Verifiez que PowerShell peut executer des scripts et que clasp est installe.
  echo Script: "%REPO_ROOT%\tools\clasp-helper.ps1"
  pause
)
endlocal
