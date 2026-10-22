@echo off
cd /d "%~dp0"
echo Testando http://localhost:3000/api/versao ...
curl -s http://localhost:3000/api/versao
echo.
echo.
pause
