@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

title Configurar Controle de Avarias - Opcional

echo ================================================
echo   CONFIGURAR CONTROLE DE AVARIAS - REDE
echo ================================================
echo.
echo Esta configuracao manual e OPCIONAL.
O ABRIR_SISTEMA_CLIENTE.bat agora tenta localizar o servidor automaticamente.
echo Exemplo: 192.168.1.20
echo.
set "IP="
set /p "IP=IP do servidor: "
set "IP=%IP:http://=%"
set "IP=%IP:https://=%"
set "IP=%IP:/=%"
set "IP=%IP::3000=%"
set "IP=%IP: =%"

if "%IP%"=="" (
    echo.
    echo ERRO: nenhum IP foi informado.
    pause
    exit /b 1
)

set "URL=http://%IP%:3000"

echo.
echo Testando %URL%/api/versao ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%URL%/api/versao' -TimeoutSec 3; $j=$r.Content | ConvertFrom-Json; if($r.StatusCode -eq 200 -and $j.ok -eq $true -and $j.versao -like 'V25*'){ exit 0 }; exit 1 } catch { exit 1 }"

if errorlevel 1 (
    echo.
    echo ERRO: esse endereco nao respondeu como Controle de Avarias V25.
    echo Verifique o IP e se o INICIAR_SERVIDOR.bat esta aberto no PC servidor.
    echo.
    pause
    exit /b 1
)

>"SERVIDOR_REDE.txt" echo %IP%
>"servidor-rede.js" echo /* Configuracao gerada automaticamente. */
>>"servidor-rede.js" echo window.CA_CONFIGURED_SERVER = "%URL%";

echo.
echo Servidor central confirmado: %URL%
echo Configuracao salva neste PC.
echo.
start "" "%URL%/login.html?servidor=%URL%"
exit /b 0
