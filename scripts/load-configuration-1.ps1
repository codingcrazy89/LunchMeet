# Configuration 1: Remote access via Cloudflare tunnels
# Metro (8081) -> proxy (8082) -> Cloudflare tunnel (public URL)
# Places proxy (8787) -> Cloudflare tunnel (public URL)
# No accounts or API keys needed.

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    $ProjectRoot = "c:\Users\jpmit\Code\LunchMeet"
}
Set-Location $ProjectRoot

Write-Host "`n=== Loading Configuration 1: Remote Access ===" -ForegroundColor Cyan
Write-Host "Cloudflare tunnels (no accounts needed)`n" -ForegroundColor Gray

# 0. Kill stale processes
Write-Host "[0/6] Cleaning up..." -ForegroundColor Gray
Get-Process -Name "node","cloudflared","ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4

# 1. Start Places Proxy (port 8787)
Write-Host "[1/6] Starting Places Proxy (port 8787)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot'; `$host.UI.RawUI.WindowTitle = 'PLACES PROXY'; Write-Host '=== Places Proxy ===' -ForegroundColor Cyan; npm run proxy"
Start-Sleep -Seconds 4

# 2. Cloudflare tunnel for proxy
Write-Host "[2/6] Creating Cloudflare tunnel for proxy..." -ForegroundColor Yellow
$proxyUrl = $null
$proxyFile = Join-Path $ProjectRoot ".cf-proxy-url"
if (Test-Path $proxyFile) { Remove-Item $proxyFile -Force }

$helperCode = @"
const { Tunnel } = require('cloudflared');
const fs = require('fs');
const t = Tunnel.quick('http://localhost:8787');
t.once('url', u => {
  fs.writeFileSync('$($proxyFile.Replace("\","\\"))', u);
  let env = fs.readFileSync('.env','utf8');
  env = env.replace(/EXPO_PUBLIC_PLACES_PROXY_URL=.*/, 'EXPO_PUBLIC_PLACES_PROXY_URL=' + u);
  fs.writeFileSync('.env', env);
  console.log('PROXY:' + u);
});
t.once('error', e => { console.error(e.message); process.exit(1); });
"@
Set-Content (Join-Path $ProjectRoot ".cf-proxy-helper.js") -Value $helperCode
Start-Process -FilePath "node" -ArgumentList ".cf-proxy-helper.js" -WorkingDirectory $ProjectRoot -WindowStyle Hidden

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $proxyFile) {
        $proxyUrl = (Get-Content $proxyFile -Raw).Trim()
        break
    }
}
if ($proxyUrl) {
    Write-Host "  Proxy tunnel: $proxyUrl" -ForegroundColor Green
} else {
    Write-Host "  Proxy tunnel: still starting..." -ForegroundColor Yellow
}

# 3. Start Metro (port 8081) — after .env is updated so bundle includes proxy URL
Write-Host "[3/6] Starting Metro Bundler (port 8081)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot'; `$host.UI.RawUI.WindowTitle = 'METRO BUNDLER'; Write-Host '=== Metro Bundler ===' -ForegroundColor Cyan; npx expo start --port 8081"
Start-Sleep -Seconds 8

# 4. Start Metro tunnel proxy (port 8082 -> 8081, fixes Host header + WebSocket)
Write-Host "[4/6] Starting Metro tunnel proxy (port 8082)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot'; `$host.UI.RawUI.WindowTitle = 'METRO PROXY'; Write-Host '=== Metro Tunnel Proxy ===' -ForegroundColor Cyan; node server/metro-tunnel-proxy.js"
Start-Sleep -Seconds 3

# 5. Cloudflare tunnel for Metro proxy (port 8082)
Write-Host "[5/6] Creating Cloudflare tunnel for Metro..." -ForegroundColor Yellow
$metroUrl = $null
$metroFile = Join-Path $ProjectRoot ".cf-metro-url"
if (Test-Path $metroFile) { Remove-Item $metroFile -Force }

$helperCode2 = @"
const { Tunnel } = require('cloudflared');
const fs = require('fs');
const t = Tunnel.quick('http://localhost:8082');
t.once('url', u => {
  fs.writeFileSync('$($metroFile.Replace("\","\\"))', u);
  console.log('METRO:' + u);
});
t.once('error', e => { console.error(e.message); process.exit(1); });
"@
Set-Content (Join-Path $ProjectRoot ".cf-metro-helper.js") -Value $helperCode2
Start-Process -FilePath "node" -ArgumentList ".cf-metro-helper.js" -WorkingDirectory $ProjectRoot -WindowStyle Hidden

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $metroFile) {
        $metroUrl = (Get-Content $metroFile -Raw).Trim()
        break
    }
}
if (-not $metroUrl) {
    Write-Host "  Could not get Metro tunnel URL." -ForegroundColor Red
    exit 1
}
Write-Host "  Metro tunnel: $metroUrl" -ForegroundColor Green

# 6. Generate QR code
Write-Host "[6/6] Generating QR code..." -ForegroundColor Yellow
$hostPart = $metroUrl -replace "^https://", ""
$expUrl = "exps://${hostPart}"

$qrCode = @"
const qrcode = require('qrcode');
const path = require('path');
const url = '$expUrl';
qrcode.toFile(path.join('$($ProjectRoot.Replace("\","\\"))', 'expo-go-qr.png'), url, { width: 400, margin: 2 }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('QR saved');
});
"@
Set-Content (Join-Path $ProjectRoot ".cf-qr-helper.js") -Value $qrCode
& node (Join-Path $ProjectRoot ".cf-qr-helper.js")
Start-Sleep -Seconds 2

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  CONFIGURATION 1 LOADED" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n  SHARE THIS WITH YOUR FRIEND:" -ForegroundColor White
Write-Host "  $expUrl" -ForegroundColor Cyan
Write-Host "`n  1. Install Expo Go on the phone"
Write-Host "  2. Tap 'Enter URL manually'"
Write-Host "  3. Paste: $expUrl"
Write-Host "  4. Or scan expo-go-qr.png" -ForegroundColor Gray
Write-Host "`n  Proxy (restaurant search): $proxyUrl" -ForegroundColor Gray
Write-Host "  Metro (app): $metroUrl" -ForegroundColor Gray
Write-Host ""
