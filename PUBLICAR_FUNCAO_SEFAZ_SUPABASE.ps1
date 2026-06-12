$ErrorActionPreference = "Stop"

$ProjectRef = "vqentphbsvnyvambtzlx"
$FunctionName = "fiscal-coupon-import"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SupabaseCli = Join-Path $Root "ferramentas-publicacao\Supabase-CLI\supabase.exe"

function ConvertTo-PlainText {
  param([securestring]$SecureValue)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

if (-not (Test-Path $SupabaseCli)) {
  Write-Host "Supabase CLI portatil nao encontrado." -ForegroundColor Red
  Write-Host "Avise o Codex para baixar novamente a ferramenta."
  exit 1
}

Write-Host ""
Write-Host "Publicacao da integracao SEFAZ no Supabase" -ForegroundColor Yellow
Write-Host ""
Write-Host "Esta rotina publica a funcao fiscal-coupon-import no projeto:"
Write-Host $ProjectRef -ForegroundColor Cyan
Write-Host ""
Write-Host "Voce precisa de um Supabase Access Token pessoal."
Write-Host "O token sera usado apenas nesta execucao e nao ficara salvo no projeto."
Write-Host ""

$secureToken = Read-Host "Cole o Supabase Access Token" -AsSecureString
$token = ConvertTo-PlainText $secureToken

if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Host "Token nao informado." -ForegroundColor Red
  exit 1
}

try {
  $env:SUPABASE_ACCESS_TOKEN = $token
  $env:SUPABASE_TELEMETRY_DISABLED = "1"

  Write-Host ""
  Write-Host "Publicando funcao $FunctionName ..." -ForegroundColor Yellow
  & $SupabaseCli functions deploy $FunctionName --project-ref $ProjectRef --use-api --workdir $Root

  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao publicar a funcao no Supabase."
  }

  Write-Host ""
  Write-Host "Funcao SEFAZ publicada com sucesso." -ForegroundColor Green
  Write-Host "URL: https://$ProjectRef.supabase.co/functions/v1/$FunctionName"
  Write-Host ""
  Write-Host "Agora teste na tela Compras colando a URL do QR Code da NFC-e."
} finally {
  $env:SUPABASE_ACCESS_TOKEN = $null
  $token = $null
}
