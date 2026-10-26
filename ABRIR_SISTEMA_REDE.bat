@echo off
setlocal
cd /d "%~dp0"
call "%~dp0ABRIR_SISTEMA_CLIENTE.bat"
exit /b %ERRORLEVEL%
