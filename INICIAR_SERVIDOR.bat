@echo off
cd /d "%~dp0"
chcp 65001 >nul
echo ================================================
echo   CONTROLE DE AVARIAS - V21.5
echo ================================================
echo.
echo Iniciando servidor...
echo.
node server.js
pause
