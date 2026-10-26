@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
title Diagnostico - Controle de Avarias
node "DIAGNOSTICO_DADOS_V25.1.11.js"
echo.
pause
