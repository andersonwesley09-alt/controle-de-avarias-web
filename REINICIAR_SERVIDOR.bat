@echo off
cd /d "%~dp0"
chcp 65001 >nul
echo Encerrando processos que usam a porta 3000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>&1
timeout /t 1 /nobreak >nul
echo Iniciando Controle de Avarias V21.5...
start "Controle de Avarias V21.5" cmd /k "cd /d "%~dp0" && node server.js"
