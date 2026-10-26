@echo off
setlocal
cd /d "%~dp0"
set "URL=http://localhost:3000/index.html"

powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/versao' -TimeoutSec 2; $j=$r.Content | ConvertFrom-Json; if($j.ok -eq $true -and $j.versao -like 'V25*'){exit 0}; exit 1 } catch { exit 1 }"
if errorlevel 1 (
    echo O servidor V25 nao esta respondendo corretamente.
    echo Iniciando o servidor V25...
    start "Controle de Avarias V25" cmd /c ""%~dp0INICIAR_SERVIDOR.bat""
    timeout /t 4 /nobreak >nul
)
start "" "%URL%"
