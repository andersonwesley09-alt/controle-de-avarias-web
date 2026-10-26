@echo off
cd /d "%~dp0"
title Liberar Controle de Avarias na Rede

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando permissao de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ==============================================
echo  LIBERAR CONTROLE DE AVARIAS NA REDE
 echo ==============================================
echo.

netsh advfirewall firewall delete rule name="Controle de Avarias - Porta 3000" >nul 2>&1
netsh advfirewall firewall add rule name="Controle de Avarias - Porta 3000" dir=in action=allow protocol=TCP localport=3000 profile=any
netsh advfirewall firewall delete rule name="Controle de Avarias - Descoberta UDP 3001" >nul 2>&1
netsh advfirewall firewall add rule name="Controle de Avarias - Descoberta UDP 3001" dir=in action=allow protocol=UDP localport=3001 profile=any

echo.
echo Porta 3000/TCP e UDP 3001 liberadas para redes Privada e Dominio.
O acesso dos outros PCs agora pode ser descoberto automaticamente.
echo.
echo Enderecos IPv4 deste computador:
ipconfig | findstr /R /C:"IPv4"
echo.
echo Nos outros PCs, abra no navegador:
echo http://IP-DESTE-PC:3000
echo.
pause
