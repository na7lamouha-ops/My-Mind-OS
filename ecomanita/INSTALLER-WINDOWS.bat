@echo off
REM ecom manita - installe le bureau sur ce PC Windows (sans administrateur). Double-clic, puis suis ce qui s affiche.
chcp 65001 >nul
title ecom manita - installation
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bureau\installer\installer-windows.ps1"
echo.
echo Le resultat est dans _ETAT-INSTALLATION.txt (meme dossier).
pause
