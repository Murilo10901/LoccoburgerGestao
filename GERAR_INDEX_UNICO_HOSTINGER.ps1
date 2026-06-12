$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$distDir = Join-Path $projectRoot "dist"
$indexPath = Join-Path $distDir "index.html"
$outputPath = Join-Path $projectRoot "LoccoBurger-index-unico.html"

if (-not (Test-Path -LiteralPath $indexPath)) {
  throw "Nao encontrei dist\index.html. Rode GERAR_PACOTE_PRODUCAO.bat primeiro."
}

$indexHtml = Get-Content -LiteralPath $indexPath -Raw
$cssMatch = [regex]::Match($indexHtml, 'href="/assets/([^"]+\.css)"')
$jsMatch = [regex]::Match($indexHtml, 'src="/assets/([^"]+\.js)"')

if (-not $cssMatch.Success -or -not $jsMatch.Success) {
  throw "Nao consegui identificar os arquivos CSS/JS dentro de dist\index.html."
}

$cssPath = Join-Path $distDir ("assets\" + $cssMatch.Groups[1].Value)
$jsPath = Join-Path $distDir ("assets\" + $jsMatch.Groups[1].Value)
$logoPath = Join-Path $distDir "assets\loccoburger-logo.jpg"

if (-not (Test-Path -LiteralPath $cssPath)) { throw "CSS nao encontrado: $cssPath" }
if (-not (Test-Path -LiteralPath $jsPath)) { throw "JS nao encontrado: $jsPath" }

$css = Get-Content -LiteralPath $cssPath -Raw
$js = Get-Content -LiteralPath $jsPath -Raw

if (Test-Path -LiteralPath $logoPath) {
  $logoBytes = [System.IO.File]::ReadAllBytes($logoPath)
  $logoData = "data:image/jpeg;base64," + [Convert]::ToBase64String($logoBytes)
  $js = $js.Replace("/assets/loccoburger-logo.jpg", $logoData)
}

$singleHtml = @"
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LoccoBurger Gestao</title>
    <style>
$css
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
$js
    </script>
  </body>
</html>
"@

try {
  Set-Content -LiteralPath $outputPath -Value $singleHtml -Encoding UTF8
} catch {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $outputPath = Join-Path $projectRoot "LoccoBurger-index-unico-$timestamp.html"
  Set-Content -LiteralPath $outputPath -Value $singleHtml -Encoding UTF8
}

Write-Host ""
Write-Host "Arquivo unico gerado com sucesso:" -ForegroundColor Green
Write-Host $outputPath
Write-Host ""
Write-Host "Uso rapido na Hostinger:"
Write-Host "1. Abra public_html/index.html no editor da Hostinger."
Write-Host "2. Copie todo o conteudo deste arquivo gerado."
Write-Host "3. Substitua o conteudo do index.html e clique em Save."
