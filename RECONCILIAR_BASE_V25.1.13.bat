@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title Controle de Avarias - Reconciliacao

echo ==================================================
echo   CONTROLE DE AVARIAS V25.1.13
echo   RECONCILIACAO SEGURA DA BASE
echo ==================================================
echo.
echo Vai recuperar do snapshot V25 os registros que
echo estiverem faltando no PostgreSQL.
echo.
echo NAO apaga dados.
echo NAO sobrescreve registros existentes.
echo Cria backup de seguranca antes.
echo.
pause
where node >nul 2>nul
if errorlevel 1 (echo Node.js nao encontrado.&pause&exit /b 1)
if not exist "node_modules\pg" call npm.cmd install --no-audit --no-fund
node "RECONCILIAR_BASE_V25.1.13.js"
echo.
pause
