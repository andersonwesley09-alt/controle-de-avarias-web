@echo off
setlocal
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/versao' -TimeoutSec 3; Write-Host ('HTTP: ' + $r.StatusCode); Write-Host $r.Content } catch { Write-Host 'NAO FOI POSSIVEL ALCANCAR O SERVIDOR EM localhost:3000'; Write-Host $_.Exception.Message }"
echo.
pause
