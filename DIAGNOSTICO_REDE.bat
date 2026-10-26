@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
title Diagnostico - Controle de Avarias

echo ================================================
echo   DIAGNOSTICO DA REDE - CONTROLE DE AVARIAS
echo ================================================
echo.
echo Arquivo de configuracao:
if exist "SERVIDOR_REDE.txt" (
  type "SERVIDOR_REDE.txt"
) else (
  echo NAO CONFIGURADO
)
echo.
echo.
echo Teste manual:
echo http://IP_DO_SERVIDOR:3000/api/versao
echo.
echo Se o servidor responder, deve aparecer ok=true e versao V25...
echo.
pause
