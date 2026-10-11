@echo off
cd /d "%~dp0"
title Painel Padrao MF
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-panel.ps1"
pause
