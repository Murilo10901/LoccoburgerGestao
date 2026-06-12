$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$Vite = Join-Path $Root "node_modules\vite\bin\vite.js"
$ZipPath = Join-Path $Root "LoccoBurger-producao-hostinger.zip"

function Invoke-Build {
  $npm = Get-Command npm -ErrorAction SilentlyContinue

  if ($npm) {
    & $npm.Source run build
    return
  }

  if ((Test-Path $BundledNode) -and (Test-Path $Vite)) {
    & $BundledNode $Vite build
    return
  }

  throw "Nao encontrei Node/NPM para gerar o pacote."
}

Write-Host ""
Write-Host "Gerando versao de producao do LoccoBurger..." -ForegroundColor Yellow
Write-Host ""

Push-Location $Root
try {
  Invoke-Build

  if (Test-Path $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  Compress-Archive -Path (Join-Path $Root "dist\*") -DestinationPath $ZipPath -Force

  Write-Host ""
  Write-Host "Pacote gerado com sucesso:" -ForegroundColor Green
  Write-Host $ZipPath
  Write-Host ""
  Write-Host "Proximo passo: rode PUBLICAR_LOCCOBURGER.bat."
} finally {
  Pop-Location
}
