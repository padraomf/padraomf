$ErrorActionPreference = 'Stop'
$portfolioRoot = Split-Path $PSScriptRoot -Parent
$serviceRoot = 'E:\SERVIDOR\projetos\padrao-mf\portfolio'
$runtimeRoot = Join-Path $serviceRoot 'aplicacao\painel'
foreach ($name in @('aplicacao','dados','configuracoes','logs','backups','documentacao')) {
    New-Item -ItemType Directory -Path (Join-Path $serviceRoot $name) -Force | Out-Null
}
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) {
    Write-Host 'A porta 3000 esta ocupada. Feche o painel anterior e tente novamente.'
    exit 1
}
foreach ($name in @('server.mjs','package.json','package-lock.json')) {
    Copy-Item -LiteralPath (Join-Path $portfolioRoot "painel\$name") -Destination $runtimeRoot -Force
}
Copy-Item -LiteralPath (Join-Path $portfolioRoot 'painel\public') -Destination $runtimeRoot -Recurse -Force
$env:SITE_ROOT = $portfolioRoot
$env:PANEL_STATE = $serviceRoot
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (!$env:PANEL_PYTHON) {
    if (Test-Path -LiteralPath $bundledPython) { $env:PANEL_PYTHON = $bundledPython } else { $env:PANEL_PYTHON = 'python' }
}
& $env:PANEL_PYTHON -c 'from PIL import Image'
if ($LASTEXITCODE -ne 0) { throw 'Python com Pillow nao encontrado. Configure PANEL_PYTHON antes de abrir o painel.' }
if (!$env:PANEL_FFMPEG) { $env:PANEL_FFMPEG = (Get-Command ffmpeg.exe -ErrorAction Stop).Source }
& $env:PANEL_FFMPEG -version | Select-Object -First 1
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg nao encontrado. Configure PANEL_FFMPEG antes de abrir o painel.' }
Push-Location $runtimeRoot
try {
    Write-Host 'Verificando dependencias do painel...'
    & npm.cmd ci --ignore-scripts --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependencias. O painel nao foi iniciado.' }
    @{ source = $portfolioRoot; runtime = $runtimeRoot; listen = '127.0.0.1:3000' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $serviceRoot 'configuracoes\caminhos.json') -Encoding utf8
    $registry = 'E:\SERVIDOR\documentacao\CADASTRO-DE-SISTEMAS.md'
    if (!(Select-String -LiteralPath $registry -SimpleMatch 'portfolio\aplicacao\painel' -Quiet)) {
        Add-Content -LiteralPath $registry -Value "`n$((Get-Date).ToString('yyyy-MM-dd')) — Portfolio Padrao MF: painel em $runtimeRoot; dados, logs e backups em $serviceRoot; somente 127.0.0.1:3000; inicio manual por ABRIR-PAINEL.bat; repositorio de autoria em $portfolioRoot. Sem inicio automatico."
    }
    Write-Host 'Abra http://127.0.0.1:3000 no navegador. Mantenha esta janela aberta.'
    & node.exe server.mjs
} finally { Pop-Location }
