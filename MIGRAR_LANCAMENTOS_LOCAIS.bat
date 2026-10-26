@echo off
setlocal
cd /d "%~dp0"
title Recuperar lancamentos locais - Controle de Avarias

if not exist "MIGRAR_LANCAMENTOS_LOCAIS.html" (
  echo Arquivo MIGRAR_LANCAMENTOS_LOCAIS.html nao encontrado.
  pause
  exit /b 1
)

start "" "%~dp0MIGRAR_LANCAMENTOS_LOCAIS.html"
exit /b 0
