@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

title Controle de Avarias V25

echo ================================================
echo   CONTROLE DE AVARIAS - V25
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

if not exist "package.json" (
    echo ERRO: package.json nao encontrado.
    echo Execute este arquivo dentro da pasta principal do projeto.
    echo.
    pause
    exit /b 1
)

set "DEPENDENCIAS_OK=1"
for %%D in (dotenv express cors pg multer xlsx bcryptjs) do (
    node -e "try{require.resolve('%%D')}catch(e){process.exit(1)}" >nul 2>nul
    if errorlevel 1 set "DEPENDENCIAS_OK=0"
)

if "%DEPENDENCIAS_OK%"=="0" (
    echo Dependencias ausentes ou incompletas.
    echo O sistema vai corrigir isso automaticamente.
    echo.
    echo [1/2] Instalando pelas dependencias do package-lock.json...
    call npm.cmd install --no-audit --no-fund --prefer-online
    if errorlevel 1 (
        echo.
        echo A instalacao principal falhou. Tentando instalar as dependencias diretamente...
        call npm.cmd install dotenv express cors pg multer xlsx bcryptjs --no-audit --no-fund --prefer-online
        if errorlevel 1 (
            echo.
            echo ERRO: nao foi possivel instalar as dependencias.
            echo Verifique a conexao com a internet e tente novamente.
            echo.
            pause
            exit /b 1
        )
    )
    echo.
    echo [2/2] Conferindo as dependencias...
)

set "DEPENDENCIAS_OK=1"
for %%D in (dotenv express cors pg multer xlsx bcryptjs) do (
    node -e "try{require.resolve('%%D')}catch(e){process.exit(1)}" >nul 2>nul
    if errorlevel 1 (
        echo ERRO: dependencia ausente: %%D
        set "DEPENDENCIAS_OK=0"
    )
)

if "%DEPENDENCIAS_OK%"=="0" (
    echo.
    echo ERRO: as dependencias nao ficaram disponiveis.
    echo Execute este arquivo novamente depois de confirmar a conexao com a internet.
    echo.
    pause
    exit /b 1
)

echo Dependencias OK.
echo.
echo Iniciando servidor V25...
echo.
node server.js
set "CODIGO=%ERRORLEVEL%"
echo.
if not "%CODIGO%"=="0" (
    echo O servidor foi encerrado com erro. Codigo: %CODIGO%
) else (
    echo O servidor foi encerrado.
)
pause
exit /b %CODIGO%
