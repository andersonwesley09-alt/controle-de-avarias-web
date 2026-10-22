@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

echo ================================================
echo   CONTROLE DE AVARIAS - INSTALACAO
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERRO: Node.js nao foi encontrado.
    echo Instale o Node.js LTS e execute este arquivo novamente.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERRO: npm nao foi encontrado.
    echo Reinstale o Node.js LTS e execute este arquivo novamente.
    echo.
    pause
    exit /b 1
)

echo Node.js encontrado:
node --version
echo npm encontrado:
npm --version
echo.
echo Instalando as dependencias do projeto...
echo Isso normalmente acontece apenas uma vez neste computador.
echo.

call npm.cmd install --no-audit --no-fund
if errorlevel 1 (
    echo.
    echo ================================================
    echo ERRO: nao foi possivel instalar as dependencias.
    echo ================================================
    echo Verifique a conexao com a internet e tente novamente.
    echo.
    pause
    exit /b 1
)

echo.
echo Dependencias instaladas com sucesso.
echo.
exit /b 0
