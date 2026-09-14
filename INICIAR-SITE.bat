@echo off
cd /d "%~dp0"
echo Abrindo o portfolio Padrao MF...
powershell.exe -NoProfile -Command "Add-Type -Path 'scripts\LocalServer.cs'; [PadraoMF.LocalServer]::Run((Get-Location).Path)"
pause
