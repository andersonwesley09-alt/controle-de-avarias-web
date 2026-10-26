@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo  DIAGNOSTICO DO HISTORICO - CONTROLE DE AVARIAS
echo ================================================
echo.
where node >nul 2>nul || (echo Node.js nao encontrado.&pause&exit /b 1)
node -e "fetch('http://localhost:3000/api/versao').then(r=>r.text()).then(t=>console.log(t)).catch(e=>console.error('Servidor nao respondeu:',e.message))"
echo.
echo Se o servidor estiver aberto, acesse no navegador:
echo http://localhost:3000/api/historico-avarias
pause
