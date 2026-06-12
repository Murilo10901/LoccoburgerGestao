$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root "dist"
$winscp = Join-Path $root "ferramentas-publicacao\WinSCP-Portable\WinSCP.com"

if (-not (Test-Path $winscp)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("WinSCP portatil nao encontrado.", "LoccoBurger", "OK", "Error") | Out-Null
  exit 1
}

if (-not (Test-Path $dist)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("Pasta dist nao encontrada. Gere a versao de producao antes de publicar.", "LoccoBurger", "OK", "Error") | Out-Null
  exit 1
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationFramework

$form = New-Object System.Windows.Forms.Form
$form.Text = "Publicar LoccoBurger"
$form.Width = 430
$form.Height = 190
$form.StartPosition = "CenterScreen"
$form.TopMost = $true
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false

$label = New-Object System.Windows.Forms.Label
$label.Text = "Digite a senha FTP da Hostinger:"
$label.Left = 18
$label.Top = 18
$label.Width = 370
$label.Height = 24
$form.Controls.Add($label)

$passwordBox = New-Object System.Windows.Forms.TextBox
$passwordBox.Left = 18
$passwordBox.Top = 48
$passwordBox.Width = 376
$passwordBox.Height = 26
$passwordBox.UseSystemPasswordChar = $true
$form.Controls.Add($passwordBox)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = "A senha sera usada apenas nesta execucao."
$statusLabel.Left = 18
$statusLabel.Top = 82
$statusLabel.Width = 376
$statusLabel.Height = 22
$form.Controls.Add($statusLabel)

$okButton = New-Object System.Windows.Forms.Button
$okButton.Text = "Publicar"
$okButton.Left = 224
$okButton.Top = 110
$okButton.Width = 82
$okButton.Height = 30
$okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.AcceptButton = $okButton
$form.Controls.Add($okButton)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = "Cancelar"
$cancelButton.Left = 312
$cancelButton.Top = 110
$cancelButton.Width = 82
$cancelButton.Height = 30
$cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.CancelButton = $cancelButton
$form.Controls.Add($cancelButton)

$form.Add_Shown({ $passwordBox.Focus() })
$dialogResult = $form.ShowDialog()

if ($dialogResult -ne [System.Windows.Forms.DialogResult]::OK -or [string]::IsNullOrWhiteSpace($passwordBox.Text)) {
  [System.Windows.MessageBox]::Show("Publicacao cancelada.", "LoccoBurger", "OK", "Information") | Out-Null
  exit 1
}

$encodedPassword = [Uri]::EscapeDataString($passwordBox.Text)
$passwordBox.Text = ""
$form.Dispose()

$tempScript = Join-Path $env:TEMP ("winscp-loccoburger-" + [guid]::NewGuid().ToString("N") + ".txt")
$tempLog = Join-Path $env:TEMP ("winscp-loccoburger-" + [guid]::NewGuid().ToString("N") + ".log")

$script = @"
option batch abort
option confirm off
open ftp://u535762948:$encodedPassword@77.37.127.179/ -passive=on
lcd "$dist"
cd "/domains/loccoburger.com/public_html"
put -transfer=binary "index.html" ./
put -transfer=binary ".htaccess" ./
put -transfer=binary "assets" ./
exit
"@

try {
  Set-Content -LiteralPath $tempScript -Value $script -Encoding ASCII
  $process = Start-Process -FilePath $winscp -ArgumentList @(
    "/ini=nul",
    "/script=$tempScript",
    "/log=$tempLog"
  ) -NoNewWindow -Wait -PassThru

  $logText = if (Test-Path $tempLog) { Get-Content -LiteralPath $tempLog -Raw -ErrorAction SilentlyContinue } else { "" }
  $success = $process.ExitCode -eq 0 -or $logText -match "Script: Exit code: 0"

  if ($success) {
    [System.Windows.MessageBox]::Show("Publicacao concluida com sucesso.`nAcesse: https://loccoburger.com", "LoccoBurger", "OK", "Information") | Out-Null
    exit 0
  }

  [System.Windows.MessageBox]::Show("Nao foi possivel publicar. Confira a senha FTP e tente novamente.", "LoccoBurger", "OK", "Error") | Out-Null
  exit 1
} finally {
  $encodedPassword = $null
  if (Test-Path $tempScript) { Remove-Item -LiteralPath $tempScript -Force }
}
