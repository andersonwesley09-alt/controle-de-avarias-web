@echo off
cd /d "%~dp0"
title Verificar Projeto
npm.cmd run check
echo.
pause
