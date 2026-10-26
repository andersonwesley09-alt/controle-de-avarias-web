@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title Controle de Avarias - Acesso Central V25.1.16

set "PADRAO=http://10.10.70.163:3000"
set "URL="
set "RESPOSTA=%TEMP%\controle_avarias_descoberta_%RANDOM%.txt"

echo ================================================
echo   CONTROLE DE AVARIAS - ACESSO CENTRAL
echo ================================================
echo.
echo Procurando o servidor central...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='SilentlyContinue';" ^
  "$magic='CONTROLE_AVARIAS_DISCOVERY_V25';" ^
  "$udp=New-Object System.Net.Sockets.UdpClient;" ^
  "$udp.EnableBroadcast=$true;" ^
  "$udp.Client.ReceiveTimeout=1200;" ^
  "$bytes=[Text.Encoding]::UTF8.GetBytes($magic);" ^
  "$udp.Send($bytes,$bytes.Length,'255.255.255.255',3001) | Out-Null;" ^
  "$ep=New-Object System.Net.IPEndPoint([IPAddress]::Any,0);" ^
  "$fim=(Get-Date).AddSeconds(2);" ^
  "$urls=@();" ^
  "while((Get-Date) -lt $fim){ try { $data=$udp.Receive([ref]$ep); $j=[Text.Encoding]::UTF8.GetString($data) | ConvertFrom-Json; if($j.ok -eq $true -and $j.url){ $urls += [string]$j.url } } catch { break } };" ^
  "$udp.Close();" ^
  "$urls | Select-Object -Unique | Set-Content -LiteralPath '%RESPOSTA%' -Encoding UTF8"

if exist "%RESPOSTA%" (
  for /f "usebackq delims=" %%U in ("%RESPOSTA%") do (
    if not defined URL set "URL=%%U"
  )
)
del "%RESPOSTA%" >nul 2>&1

if "%URL%"=="" set "URL=%PADRAO%"

echo Servidor escolhido: %URL%
echo Validando a base central...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%URL%/api/rede-info' -TimeoutSec 4; $j=$r.Content | ConvertFrom-Json; if($r.StatusCode -eq 200 -and $j.ok -eq $true -and $j.versao -like 'V25*'){ exit 0 }; exit 1 } catch { exit 1 }"

if errorlevel 1 (
  if /I not "%URL%"=="%PADRAO%" (
    echo Descoberta falhou. Tentando servidor padrao %PADRAO%...
    set "URL=%PADRAO%"
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%PADRAO%/api/rede-info' -TimeoutSec 4; $j=$r.Content | ConvertFrom-Json; if($r.StatusCode -eq 200 -and $j.ok -eq $true -and $j.versao -like 'V25*'){ exit 0 }; exit 1 } catch { exit 1 }"
  )
)

if errorlevel 1 (
  echo.
  echo ERRO: nao foi possivel conectar ao servidor central.
  echo Verifique se o PC servidor esta ligado e se a porta 3000 esta liberada.
  echo.
  pause
  exit /b 1
)

>"SERVIDOR_REDE.txt" echo %URL:http://=%
start "" "%URL%/login.html?servidor=%URL%&rede=central&v=25.1.16"
exit /b 0
