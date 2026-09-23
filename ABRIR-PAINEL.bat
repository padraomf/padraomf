@echo off
cd /d "%~dp0"
color 0A
title Painel Padrao MF - Inicializando...

echo.
echo ===================================================
echo     INICIALIZANDO O PAINEL DA PADRAO MF
echo ===================================================
echo.

cd painel

if not exist node_modules (
    echo Baixando dependencias do painel - isso so acontece na primeira vez e pode demorar alguns minutos...
    call npm install
)

echo.
echo Iniciando o servidor local...
echo.
echo ===================================================
echo O painel abrira no seu navegador automaticamente.
echo MANTENHA ESTA JANELA PRETA ABERTA enquanto usa o painel.
echo ===================================================

start http://localhost:3000
call npm start

echo.
echo Servidor encerrado.
pause
