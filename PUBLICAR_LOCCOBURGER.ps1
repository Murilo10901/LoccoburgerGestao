$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root "dist"
$winscp = Join-Path $root "ferramentas-publicacao\WinSCP-Portable\WinSCP.com"

if (-not (Test-Path $winscp)) {
  Write-Host "WinSCP portatil nao encontrado." -ForegroundColor Red
  Write-Host "Avise o Codex para baixar novamente a ferramenta de publicacao."
  exit 1
}

if (-not (Test-Path $dist)) {
  Write-Host "Pasta dist nao encontrada. Gere a versao de producao antes de publicar." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Publicacao LoccoBurger na Hostinger" -ForegroundColor Yellow
Write-Host "A senha sera usada apenas nesta execucao e nao ficara salva no script."
Write-Host ""

$securePassword = Read-Host "Digite a senha FTP da Hostinger" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
}

$encodedPassword = [Uri]::EscapeDataString($password)
$password = $null

function Invoke-LoccoUpload {
  param([string]$RemotePath)

  $tempScript = Join-Path $env:TEMP ("winscp-loccoburger-" + [guid]::NewGuid().ToString("N") + ".txt")
  $tempLog = Join-Path $env:TEMP ("winscp-loccoburger-" + [guid]::NewGuid().ToString("N") + ".log")

  $script = @"
option batch abort
option confirm off
open ftp://u535762948:$encodedPassword@77.37.127.179/ -passive=on
lcd "$dist"
cd "$RemotePath"
put -transfer=binary "index.html" ./
put -transfer=binary ".htaccess" ./
put -transfer=binary "assets" ./
exit
"@

  try {
    Set-Content -LiteralPath $tempScript -Value $script -Encoding ASCII
    Write-Host ""
    Write-Host "Tentando publicar em $RemotePath ..."
    $process = Start-Process -FilePath $winscp -ArgumentList @(
      "/ini=nul",
      "/script=$tempScript",
      "/log=$tempLog"
    ) -NoNewWindow -Wait -PassThru

    $exitCode = $process.ExitCode
    if ($exitCode -ne 0 -and (Test-Path $tempLog)) {
      $logText = Get-Content -LiteralPath $tempLog -Raw -ErrorAction SilentlyContinue
      if ($logText -match "Script: Exit code: 0") {
        return 0
      }
      Write-Host "Nao foi possivel publicar nesse caminho." -ForegroundColor DarkYellow
    }
    return $exitCode
  } finally {
    if (Test-Path $tempScript) { Remove-Item -LiteralPath $tempScript -Force }
  }
}

$remotePaths = @(
  "/domains/loccoburger.com/public_html"
)

$success = $false
foreach ($path in $remotePaths) {
  $exitCode = Invoke-LoccoUpload -RemotePath $path
  if ($exitCode -eq 0) {
    $success = $true
    break
  }
}

$encodedPassword = $null

if ($success) {
  Write-Host ""
  Write-Host "Publicacao concluida com sucesso." -ForegroundColor Green
  Write-Host "Acesse: https://loccoburger.com"
  exit 0
}

Write-Host ""
Write-Host "Nao consegui publicar automaticamente." -ForegroundColor Red
Write-Host "Confira a senha FTP e tente novamente."
exit 1
