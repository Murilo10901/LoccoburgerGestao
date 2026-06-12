$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$Vite = Join-Path $Root "node_modules\vite\bin\vite.js"

function Get-NodeCommand {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) {
    return @{ Mode = "npm"; Command = $npm.Source }
  }

  if ((Test-Path $BundledNode) -and (Test-Path $Vite)) {
    return @{ Mode = "node"; Command = $BundledNode }
  }

  throw "Nao encontrei Node/NPM para rodar o app. Avise o Codex para preparar o ambiente."
}

$runner = Get-NodeCommand
Write-Host ""
Write-Host "Abrindo LoccoBurger localmente..." -ForegroundColor Yellow
Write-Host "Endereco: http://127.0.0.1:5173"
Write-Host ""

if ($runner.Mode -eq "npm") {
  Start-Process -FilePath $runner.Command -ArgumentList @("run", "dev:local") -WorkingDirectory $Root
} else {
  Start-Process -FilePath $runner.Command -ArgumentList @("`"$Vite`"", "--host", "127.0.0.1", "--port", "5173") -WorkingDirectory $Root
}

Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:5173"
Write-Host "Servidor iniciado. Deixe a janela do servidor aberta enquanto estiver testando."
