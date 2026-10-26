@echo off
setlocal
chcp 65001 >nul
title Diagnóstico de Rede - Controle de Avarias V25.1.14
set "URL=http://10.10.70.163:3000"
if exist "SERVIDOR_REDE.txt" set /p "IP="<"SERVIDOR_REDE.txt"
if defined IP set "URL=http://%IP%:3000"

echo ================================================
echo   DIAGNOSTICO REDE - CONTROLE DE AVARIAS
echo ================================================
echo.
echo Servidor testado: %URL%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%URL%/api/rede-info' -TimeoutSec 5; $j=$r.Content | ConvertFrom-Json; Write-Host ('HTTP: ' + $r.StatusCode); Write-Host ('Versao: ' + $j.versao); Write-Host ('Servidor: ' + $j.servidor); Write-Host ('Banco: ' + $j.banco); Write-Host ('Avarias: ' + $j.totais.avarias); Write-Host ('Historico: ' + $j.totais.historico); if($j.ok -eq $true){exit 0}else{exit 1} } catch { Write-Host ('ERRO: ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 (
  echo.
  echo FALHA: este PC nao conseguiu validar o servidor central.
  echo Verifique firewall, rede e se o INICIAR_SERVIDOR.bat esta aberto no PC servidor.
) else (
  echo.
  echo OK: este PC esta enxergando a mesma base central.
)
echo.
pause
