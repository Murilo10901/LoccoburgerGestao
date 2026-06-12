$ErrorActionPreference = "Stop"

$SupabaseUrl = "https://vqentphbsvnyvambtzlx.supabase.co"
$SupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZW50cGhic3ZueXZhbWJ0emx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzk4NDQsImV4cCI6MjA5NTY1NTg0NH0.uyhPhYkyAmU98M7kcpRLIVBmRlncV1aU-O3Cx36Ujeo"

function ConvertTo-PlainText {
  param([securestring]$SecureValue)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function ConvertTo-Array {
  param($Value)

  if ($null -eq $Value) { return @() }
  if ($Value -is [System.Array]) { return @($Value) }
  return @($Value)
}

function Normalize-Name {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $normalized = [regex]::Replace($normalized, "\p{Mn}", "")
  return $normalized.ToLowerInvariant().Trim()
}

function Should-KeepCustomer {
  param($Customer)

  $name = Normalize-Name $Customer.name
  if ($name -match "\brogerio\b") { return $true }
  if ($name -match "\bleila\b") { return $true }
  if ($name -match "\bmurilo\b") { return $true }
  if ($name -match "\bflavia\b") { return $true }
  return $false
}

function Set-AppProperty {
  param(
    [object]$Object,
    [string]$Name,
    $Value
  )

  if ($Object.PSObject.Properties.Name -contains $Name) {
    $Object.$Name = $Value
  } else {
    Add-Member -InputObject $Object -MemberType NoteProperty -Name $Name -Value $Value
  }
}

function New-CleanTable {
  param($Table)

  $tableId = if ($Table.app_id) { [int]$Table.app_id } else { [int]$Table.id }

  return [pscustomobject]@{
    id = $tableId
    guests = 0
    status = "livre"
    attendant = "-"
    total = 0
    orderItems = @()
    tabs = @(
      [pscustomobject]@{
        id = "$($tableId)-mesa"
        name = "Mesa"
        orderItems = @()
      }
    )
  }
}

function New-DefaultTables {
  1..10 | ForEach-Object {
    New-CleanTable ([pscustomobject]@{ id = $_ })
  }
}

function New-DbTableRow {
  param($Table, [string]$OwnerId)

  return @{
    user_id = $OwnerId
    app_id = [int]$Table.id
    guests = 0
    status = "livre"
    attendant = "-"
    total = 0
    order_items = @()
    tabs = $Table.tabs
  }
}

function New-AppCustomer {
  param($Customer)

  return [pscustomobject]@{
    id = [int64]$Customer.app_id
    name = $Customer.name
    phone = $Customer.phone
    address = $Customer.address
    notes = if ($Customer.notes) { $Customer.notes } else { "" }
    tags = if ($Customer.tags) { $Customer.tags } else { @() }
  }
}

function New-DbCustomerRow {
  param($Customer, [string]$OwnerId)

  return @{
    user_id = $OwnerId
    app_id = [int64]$Customer.app_id
    name = $Customer.name
    phone = $Customer.phone
    address = $Customer.address
    notes = if ($Customer.notes) { $Customer.notes } else { "" }
    tags = if ($Customer.tags) { $Customer.tags } else { @() }
  }
}

function Invoke-Supabase {
  param(
    [string]$Method,
    [string]$Path,
    $Body = $null,
    [hashtable]$ExtraHeaders = @{}
  )

  $headers = @{
    apikey = $SupabaseAnonKey
    Authorization = "Bearer $script:AccessToken"
    Accept = "application/json"
    "Content-Type" = "application/json"
  }

  foreach ($key in $ExtraHeaders.Keys) {
    $headers[$key] = $ExtraHeaders[$key]
  }

  $uri = "$SupabaseUrl/rest/v1/$Path"

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 100 -Compress
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
}

function Remove-OwnerRows {
  param([string]$Table, [string]$OwnerId)

  Invoke-Supabase -Method "Delete" -Path "$Table?user_id=eq.$OwnerId" -ExtraHeaders @{ Prefer = "return=minimal" } | Out-Null
}

Write-Host ""
Write-Host "Limpeza oficial LoccoBurger" -ForegroundColor Yellow
Write-Host "Esta rotina vai apagar vendas, pedidos, caixa, financeiro, compras, perdas e testes."
Write-Host "Produtos e fichas tecnicas serao mantidos."
Write-Host "Clientes mantidos: Rogerio Lopes, Leila, Murilo e Flavia."
Write-Host ""
Write-Host "Antes de continuar, feche o LoccoBurger em outros celulares/computadores para evitar que uma tela antiga salve dados de teste novamente." -ForegroundColor DarkYellow
Write-Host ""

$confirmation = Read-Host "Digite LIMPAR para confirmar"
if ($confirmation -ne "LIMPAR") {
  Write-Host "Operacao cancelada."
  exit 0
}

$email = Read-Host "E-mail do usuario administrador"
$securePassword = Read-Host "Senha do sistema" -AsSecureString
$password = ConvertTo-PlainText $securePassword

try {
  $authHeaders = @{
    apikey = $SupabaseAnonKey
    "Content-Type" = "application/json"
  }
  $authBody = @{ email = $email; password = $password } | ConvertTo-Json -Compress
  $auth = Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/auth/v1/token?grant_type=password" -Headers $authHeaders -Body $authBody
} finally {
  $password = $null
}

if (-not $auth.access_token -or -not $auth.user.id) {
  throw "Nao foi possivel autenticar no Supabase."
}

$script:AccessToken = $auth.access_token
$userId = [string]$auth.user.id
$ownerId = $userId

$profiles = ConvertTo-Array (Invoke-Supabase -Method "Get" -Path "user_profiles?user_id=eq.$userId&select=store_owner_id")
if ($profiles.Count -gt 0 -and $profiles[0].store_owner_id) {
  $ownerId = [string]$profiles[0].store_owner_id
}

Write-Host ""
Write-Host "Usuario autenticado. Limpando dados da loja..." -ForegroundColor Green

$customers = ConvertTo-Array (Invoke-Supabase -Method "Get" -Path "user_customers?user_id=eq.$ownerId&select=*")
$keptCustomers = @($customers | Where-Object { Should-KeepCustomer $_ })
$keptCustomerRows = @($keptCustomers | ForEach-Object { New-DbCustomerRow $_ $ownerId })
$keptAppCustomers = @($keptCustomers | ForEach-Object { New-AppCustomer $_ })

$dbTables = ConvertTo-Array (Invoke-Supabase -Method "Get" -Path "user_restaurant_tables?user_id=eq.$ownerId&select=*")
$appStateRows = ConvertTo-Array (Invoke-Supabase -Method "Get" -Path "user_app_state?user_id=eq.$ownerId&select=app_data")
$appState = if ($appStateRows.Count -gt 0 -and $appStateRows[0].app_data) { $appStateRows[0].app_data } else { [pscustomobject]@{} }

$sourceTables = if ($dbTables.Count -gt 0) {
  $dbTables
} elseif ($appState.PSObject.Properties.Name -contains "tables" -and $appState.tables) {
  ConvertTo-Array $appState.tables
} else {
  New-DefaultTables
}

$cleanTables = @($sourceTables | ForEach-Object { New-CleanTable $_ } | Sort-Object id)
$cleanTableRows = @($cleanTables | ForEach-Object { New-DbTableRow $_ $ownerId })

Remove-OwnerRows "user_delivery_order_items" $ownerId
Remove-OwnerRows "user_delivery_orders" $ownerId
Remove-OwnerRows "user_customer_campaigns" $ownerId
Remove-OwnerRows "user_whatsapp_messages" $ownerId

Remove-OwnerRows "user_cash_closing_methods" $ownerId
Remove-OwnerRows "user_cash_closings" $ownerId
Remove-OwnerRows "user_accounts_receivable" $ownerId
Remove-OwnerRows "user_payments" $ownerId
Remove-OwnerRows "user_expenses" $ownerId

Remove-OwnerRows "user_kitchen_tickets" $ownerId
Remove-OwnerRows "user_restaurant_tables" $ownerId

Remove-OwnerRows "user_customers" $ownerId
if ($keptCustomerRows.Count -gt 0) {
  Invoke-Supabase -Method "Post" -Path "user_customers" -Body $keptCustomerRows -ExtraHeaders @{ Prefer = "return=minimal" } | Out-Null
}

if ($cleanTableRows.Count -gt 0) {
  Invoke-Supabase -Method "Post" -Path "user_restaurant_tables" -Body $cleanTableRows -ExtraHeaders @{ Prefer = "return=minimal" } | Out-Null
}

Invoke-Supabase -Method "Patch" -Path "user_inventory_items?user_id=eq.$ownerId" -Body @{ current_stock = 0 } -ExtraHeaders @{ Prefer = "return=minimal" } | Out-Null

if ($appState.PSObject.Properties.Name -contains "inventory" -and $appState.inventory) {
  $cleanInventory = @((ConvertTo-Array $appState.inventory) | ForEach-Object {
    $_.currentStock = 0
    $_
  })
  Set-AppProperty $appState "inventory" $cleanInventory
}

Set-AppProperty $appState "tables" $cleanTables
Set-AppProperty $appState "kitchen" @()
Set-AppProperty $appState "payments" @()
Set-AppProperty $appState "accountsReceivable" @()
Set-AppProperty $appState "cashClosings" @()
Set-AppProperty $appState "expenses" @()
Set-AppProperty $appState "stockAdjustments" @()
Set-AppProperty $appState "customerCampaigns" @()
Set-AppProperty $appState "customers" $keptAppCustomers
Set-AppProperty $appState "deliveries" @()
Set-AppProperty $appState "purchaseOrders" @()
Set-AppProperty $appState "whatsAppInbox" @()

if ($appStateRows.Count -gt 0) {
  Invoke-Supabase -Method "Patch" -Path "user_app_state?user_id=eq.$ownerId" -Body @{ app_data = $appState } -ExtraHeaders @{ Prefer = "return=minimal" } | Out-Null
} else {
  Invoke-Supabase -Method "Post" -Path "user_app_state" -Body @{ user_id = $ownerId; app_data = $appState } -ExtraHeaders @{ Prefer = "return=minimal" } | Out-Null
}

Write-Host ""
Write-Host "Limpeza concluida com sucesso." -ForegroundColor Green
Write-Host "Clientes preservados: $($keptCustomers.Count)"
Write-Host "Mesas zeradas: $($cleanTables.Count)"
Write-Host "Estoque zerado: saldo atual dos insumos ficou 0."
Write-Host ""
Write-Host "Agora atualize o LoccoBurger nos dispositivos abertos ou saia e entre novamente."
