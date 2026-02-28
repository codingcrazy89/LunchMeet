# Start LunchMeet for remote users - uses ONE ngrok agent with 2 tunnels (proxy + metro)
# This avoids ERR_NGROK_108 (free tier allows 2 tunnels in one agent)
# Requires: ngrok authtoken (ngrok config add-authtoken YOUR_TOKEN)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

Write-Host "`n=== LunchMeet Remote (ngrok - proxy + metro) ===" -ForegroundColor Cyan
Write-Host "Uses one ngrok agent with 2 tunnels for reliable restaurant search.`n" -ForegroundColor Gray

# 1. Start proxy
Write-Host "[1/5] Starting Places proxy..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== Places Proxy ===' -ForegroundColor Cyan; npm run proxy"
Start-Sleep -Seconds 3

# 2. Start ngrok first (so we can update .env before Metro builds the bundle)
Write-Host "[2/5] Starting ngrok (proxy + metro tunnels)..." -ForegroundColor Yellow
$ngrokConfig = Join-Path $projectRoot "ngrok.yml"
if (-not (Test-Path $ngrokConfig)) {
  Write-Host "  Creating ngrok.yml..." -ForegroundColor Gray
  @"
version: "2"
tunnels:
  proxy:
    proto: http
    addr: 8787
  metro:
    proto: http
    addr: 8081
"@ | Set-Content $ngrokConfig
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== Ngrok (proxy + metro) ===' -ForegroundColor Cyan; npx ngrok start --config ngrok.yml --all"
Write-Host "  Waiting 20 seconds for ngrok to establish tunnels..." -ForegroundColor Gray
Start-Sleep -Seconds 20

# 3. Get tunnel URLs and update .env (before Metro starts so bundle gets proxy URL)
Write-Host "[3/5] Fetching tunnel URLs and updating .env..." -ForegroundColor Yellow
$proxyUrl = $null
$metroUrl = $null
$maxRetries = 8
$retryDelay = 3
for ($r = 0; $r -lt $maxRetries; $r++) {
  foreach ($port in 4040, 4042) {
    try {
      $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/tunnels" -TimeoutSec 8 -ErrorAction SilentlyContinue
      if ($tunnels.tunnels -and $tunnels.tunnels.Count -ge 2) {
        foreach ($t in $tunnels.tunnels) {
          $addr = $t.config.addr -replace ".*:", ""
          if ($addr -match "8787") { $proxyUrl = $t.public_url }
          if ($addr -match "8081") { $metroUrl = $t.public_url }
        }
        if ($proxyUrl -and $metroUrl) { break }
      }
    } catch {}
  }
  if ($proxyUrl -and $metroUrl) { break }
  if ($r -lt $maxRetries - 1) {
    Write-Host "  Retry $($r+2)/$maxRetries in ${retryDelay}s..." -ForegroundColor Gray
    Start-Sleep -Seconds $retryDelay
  }
}

if (-not $proxyUrl -and -not $metroUrl) {
  $tunnels = $null
  try {
    $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 8 -ErrorAction SilentlyContinue
  } catch {}
  if ($tunnels.tunnels) {
    $proxyUrl = ($tunnels.tunnels | Where-Object { $_.config.addr -match "8787" } | Select-Object -First 1).public_url
    $metroUrl = ($tunnels.tunnels | Where-Object { $_.config.addr -match "8081" } | Select-Object -First 1).public_url
  }
}

if ($proxyUrl) {
  Write-Host "  Proxy URL: $proxyUrl" -ForegroundColor Green
  $envPath = Join-Path $projectRoot ".env"
  if (Test-Path $envPath) {
    $content = Get-Content $envPath -Raw
    $content = $content -replace "EXPO_PUBLIC_PLACES_PROXY_URL=.*", "EXPO_PUBLIC_PLACES_PROXY_URL=$proxyUrl"
    Set-Content $envPath -Value $content.TrimEnd() -NoNewline
  } else {
    Set-Content $envPath -Value "EXPO_PUBLIC_PLACES_PROXY_URL=$proxyUrl"
  }
  Write-Host "  Updated .env" -ForegroundColor Green
} else {
  Write-Host "  Could not get ngrok URLs. Check the ngrok window." -ForegroundColor Red
}

# 4. Start Metro (now .env has proxy URL; Metro tunnel will work once Metro is up)
Write-Host "[4/5] Starting Metro (Expo)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== Metro (port 8081) ===' -ForegroundColor Cyan; npx expo start"
Start-Sleep -Seconds 8

# 5. Show Expo URL
Write-Host "[5/5] Generating shareable Expo URL..." -ForegroundColor Yellow
$expoUrl = ""
if ($metroUrl) {
  $hostPart = $metroUrl -replace "^https?://", "" -replace "/.*", "" -replace ":\d+$", ""
  # Use exps:// for HTTPS tunnels (ngrok); exp:// for HTTP
  $expoUrl = "exps://${hostPart}:443"
  Write-Host "  Metro tunnel: $metroUrl" -ForegroundColor Green
  Write-Host "  Expo URL: $expoUrl" -ForegroundColor Green
}

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "`nShare this URL with remote users (open in Expo Go):" -ForegroundColor Cyan
if ($expoUrl) {
  Write-Host "  $expoUrl" -ForegroundColor White
  Write-Host "`nRestaurant search will work - proxy URL is in .env" -ForegroundColor Green
  Write-Host "`nIf the app doesn't load on mobile:" -ForegroundColor Gray
  Write-Host "  - Try: npx expo start -c (clear cache) in the Metro window, then reload" -ForegroundColor Gray
  Write-Host "  - Ensure phone has internet (not just laptop WiFi)" -ForegroundColor Gray
} else {
  Write-Host "  Get the metro tunnel URL from the ngrok window (port 8081)" -ForegroundColor Yellow
  Write-Host "  Format: exps://xxx.ngrok-free.app:443" -ForegroundColor Gray
}
Write-Host ""
