@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title Controle de Avarias - Recuperacao Pos Dia 13

echo ============================================================
echo   CONTROLE DE AVARIAS V25.1.15
echo   RECUPERACAO SEGURA DOS LANCAMENTOS APOS 13/10/2026
echo ============================================================
echo.
echo ATENCAO: execute SOMENTE no PC que possui o PostgreSQL.
echo O procedimento cria um snapshot de seguranca antes de alterar qualquer coisa.
echo Nenhum registro existente sera sobrescrito.
echo.
echo A fonte de recuperacao contem dados ate 21/10/2026.
echo.
pause
where node >nul 2>nul
if errorlevel 1 (echo Node.js nao encontrado.&pause&exit /b 1)
if not exist "node_modules\pg" call npm.cmd install --no-audit --no-fund
if errorlevel 1 (echo Falha ao instalar dependencias.&pause&exit /b 1)
node "RECUPERAR_DADOS_POS_13.js"
echo.
echo ============================================================
echo Se a recuperacao terminou sem ERRO, inicie o servidor novamente.
echo Depois confira Registros e Historico.
echo ============================================================
pause
