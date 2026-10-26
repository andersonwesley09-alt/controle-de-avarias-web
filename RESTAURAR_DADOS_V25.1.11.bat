@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title Controle de Avarias - Restauracao Segura

echo ==================================================
echo   CONTROLE DE AVARIAS V25.1.11
echo   RESTAURACAO SEGURA DOS DADOS
echo ==================================================
echo.
echo Esta operacao:
echo   - NAO apaga dados;
echo   - NAO substitui dados existentes;
echo   - recupera apenas IDs que nao existem no banco;
echo   - cria um snapshot de seguranca antes da restauracao.
echo.
echo A tabela AVARIAS ativa NAO sera restaurada.
echo O historico permanente sera recuperado do backup.
echo.
pause

where node >nul 2>nul
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado.
    pause
    exit /b 1
)

if not exist "node_modules\pg" (
    echo.
    echo Dependencias nao encontradas. Instalando...
    call npm.cmd install --no-audit --no-fund
    if errorlevel 1 (
        echo ERRO: nao foi possivel instalar as dependencias.
        pause
        exit /b 1
    )
)

echo.
echo Restaurando...
echo.
node "RESTAURAR_DADOS_V25.1.11.js"

if errorlevel 1 (
    echo.
    echo ================================================
    echo A RESTAURACAO NAO FOI CONCLUIDA.
    echo ================================================
    pause
    exit /b 1
)

echo.
echo ================================================
echo RESTAURACAO CONCLUIDA.
echo ================================================
echo.
pause
exit /b 0
