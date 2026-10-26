@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where node >nul 2>nul || (echo Node.js nao encontrado.&pause&exit /b 1)
if not exist "node_modules\pg" call npm.cmd install --no-audit --no-fund
node "DIAGNOSTICO_POS_13.js"
pause
