# Start LunchMeet for remote users (not on your WiFi)
# Opens: 1) Places proxy, 2) Proxy tunnel (localtunnel), 3) Expo with tunnel
# Requires: ngrok authtoken for Expo tunnel (free at ngrok.com)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

Write-Host "`n=== LunchMeet Remote Setup ===" -ForegroundColor Cyan
Write-Host "Starting services for users NOT on your WiFi...`n" -ForegroundColor Gray

# 1. Start proxy in new window
Write-Host "[1/3] Starting Places proxy..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== Places Proxy (port 8787) ===' -ForegroundColor Cyan; npm run proxy"
Start-Sleep -Seconds 2

# 2. Start proxy tunnel (localtunnel - ngrok would conflict with Expo's tunnel)
Write-Host "[2/3] Starting proxy tunnel (localtunnel)..." -ForegroundColor Yellow
$proxyUrl = $null
$helperResult = ""
try {
  $helperResult = & node "$projectRoot\scripts\start-remote-helper.js" 2>$null
} catch { }
if ($helperResult -match "https://[^\s]+\.loca\.lt") {
  $proxyUrl = $helperResult.Trim()
  Write-Host "  Proxy tunnel URL: $proxyUrl" -ForegroundColor Green
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
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== Proxy Tunnel ===' -ForegroundColor Cyan; Write-Host 'Copy the URL below, run: .\scripts\set-proxy-url.ps1 `"URL`"' -ForegroundColor Yellow; npx localtunnel --port 8787"
  Write-Host "  Tunnel window opened. Copy the https://....loca.lt URL, run: .\scripts\set-proxy-url.ps1 `"URL`"" -ForegroundColor Yellow
  Write-Host "  Then RESTART the Expo window and RELOAD the app." -ForegroundColor Yellow
}
Write-Host "  Waiting 5 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 3. Start Expo with tunnel
Write-Host "[3/3] Starting Expo with tunnel..." -ForegroundColor Yellow
Write-Host "`nIf Expo tunnel fails: ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor Gray
Write-Host "If app still won't connect: try npm run start-remote:ngrok (uses exps:// URL).`n" -ForegroundColor Gray

$expoCmd = @"
cd '$projectRoot'
`$env:EXPO_PUBLIC_PLACES_PROXY_URL = (Get-Content .env | Where-Object { `$_ -match 'EXPO_PUBLIC_PLACES_PROXY_URL=' }) -replace 'EXPO_PUBLIC_PLACES_PROXY_URL=',''
Write-Host '=== Expo Dev Server (Tunnel) ===' -ForegroundColor Cyan
Write-Host 'Share the exp:// URL or QR code with anyone - no WiFi needed!' -ForegroundColor Green
`$p = Start-Process -FilePath 'npx' -ArgumentList 'expo','start','--tunnel' -NoNewWindow -PassThru
Start-Sleep -Seconds 30
node scripts/show-tunnel-url.js
`$p.WaitForExit()
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $expoCmd

Write-Host "`nDone! Three windows opened:" -ForegroundColor Green
Write-Host "  1. Places proxy"
Write-Host "  2. Proxy tunnel (localtunnel)"
Write-Host "  3. Expo with tunnel"
Write-Host "`nShare the exp:// URL from the Expo window with remote users." -ForegroundColor Cyan
Write-Host "`nIf restaurant search doesn't work on mobile: Ensure EXPO_PUBLIC_PLACES_PROXY_URL in .env" -ForegroundColor Gray
Write-Host "  is the proxy tunnel URL (https://....loca.lt). Restart Expo, then reload the app on your phone." -ForegroundColor Gray
Write-Host "  For more reliable search, use: .\scripts\load-configuration-1.ps1 (ngrok for proxy).`n" -ForegroundColor Gray
