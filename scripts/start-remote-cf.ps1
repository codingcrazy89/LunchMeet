$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

Write-Host "`n=== LunchMeet Remote (Cloudflare tunnels) ===" -ForegroundColor Cyan

# Kill stale processes
Write-Host "[0] Cleaning up..." -ForegroundColor Gray
Get-Process -Name "node","ngrok","cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 1. Start proxy
Write-Host "[1/5] Starting Places proxy (port 8787)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectRoot'; Write-Host '=== Places Proxy ===' -ForegroundColor Cyan; npm run proxy"
Start-Sleep -Seconds 4

# 2. Start Metro (port 8081) - plain LAN mode, no ngrok
Write-Host "[2/5] Starting Metro (port 8081)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$projectRoot'; Write-Host '=== Metro Bundler ===' -ForegroundColor Cyan; npx expo start --port 8081"
Start-Sleep -Seconds 10

# 3. Cloudflare tunnel for proxy (8787)
Write-Host "[3/5] Creating Cloudflare tunnel for proxy..." -ForegroundColor Yellow
$proxyUrl = $null
$proxyFile = Join-Path $projectRoot ".cf-proxy-url"
if (Test-Path $proxyFile) { Remove-Item $proxyFile -Force }

$helperCode = @"
const { Tunnel } = require('cloudflared');
const fs = require('fs');
const path = require('path');
const t = Tunnel.quick('http://localhost:8787');
t.once('url', u => {
  fs.writeFileSync(path.join('$($projectRoot.Replace("\","\\"))', '.cf-proxy-url'), u);
  let env = fs.readFileSync('.env','utf8');
  env = env.replace(/EXPO_PUBLIC_PLACES_PROXY_URL=.*/, 'EXPO_PUBLIC_PLACES_PROXY_URL=' + u);
  fs.writeFileSync('.env', env);
  console.log('PROXY:' + u);
});
t.once('error', e => { console.error(e.message); process.exit(1); });
setTimeout(() => { if (!fs.existsSync(path.join('$($projectRoot.Replace("\","\\"))', '.cf-proxy-url'))) { console.error('TIMEOUT'); process.exit(1); } }, 25000);
"@
$helperFile = Join-Path $projectRoot ".cf-proxy-helper.js"
Set-Content $helperFile -Value $helperCode
Start-Process -FilePath "node" -ArgumentList $helperFile -WorkingDirectory $projectRoot -WindowStyle Hidden

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
  Write-Host "  Proxy tunnel: waiting (check .cf-proxy-url later)" -ForegroundColor Yellow
}

# 4. Cloudflare tunnel for Metro (8081)
Write-Host "[4/5] Creating Cloudflare tunnel for Metro..." -ForegroundColor Yellow
$metroUrl = $null
$metroFile = Join-Path $projectRoot ".cf-metro-url"
if (Test-Path $metroFile) { Remove-Item $metroFile -Force }

$helperCode2 = @"
const { Tunnel } = require('cloudflared');
const fs = require('fs');
const path = require('path');
const t = Tunnel.quick('http://localhost:8081');
t.once('url', u => {
  fs.writeFileSync(path.join('$($projectRoot.Replace("\","\\"))', '.cf-metro-url'), u);
  console.log('METRO:' + u);
});
t.once('error', e => { console.error(e.message); process.exit(1); });
setTimeout(() => { if (!fs.existsSync(path.join('$($projectRoot.Replace("\","\\"))', '.cf-metro-url'))) { console.error('TIMEOUT'); process.exit(1); } }, 25000);
"@
$helperFile2 = Join-Path $projectRoot ".cf-metro-helper.js"
Set-Content $helperFile2 -Value $helperCode2
Start-Process -FilePath "node" -ArgumentList $helperFile2 -WorkingDirectory $projectRoot -WindowStyle Hidden

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $metroFile) {
    $metroUrl = (Get-Content $metroFile -Raw).Trim()
    break
  }
}
if ($metroUrl) {
  Write-Host "  Metro tunnel: $metroUrl" -ForegroundColor Green
} else {
  Write-Host "  Metro tunnel: waiting (check .cf-metro-url later)" -ForegroundColor Yellow
}

# 5. Generate QR code
Write-Host "[5/5] Generating QR code..." -ForegroundColor Yellow
if ($metroUrl) {
  $hostPart = $metroUrl -replace "^https://", ""
  $expoUrl = "exp+lunchmeet://expo-development-client/?url=" + [System.Uri]::EscapeDataString($metroUrl)
  $expUrl = "exps://${hostPart}"

  $qrCode = @"
const qrcode = require('qrcode');
const path = require('path');
const url = '$expUrl';
qrcode.toFile(path.join('$($projectRoot.Replace("\","\\"))', 'expo-go-qr.png'), url, { width: 400, margin: 2 }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('QR saved');
});
"@
  $qrFile = Join-Path $projectRoot ".cf-qr-helper.js"
  Set-Content $qrFile -Value $qrCode
  & node $qrFile
  Start-Sleep -Seconds 2

  Write-Host "`n========================================" -ForegroundColor Green
  Write-Host "  SHARE THIS WITH YOUR FRIEND:" -ForegroundColor White
  Write-Host "  $expUrl" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Green
  Write-Host "`n  1. Open Expo Go on the phone"
  Write-Host "  2. Tap 'Enter URL manually'"
  Write-Host "  3. Paste: $expUrl"
  Write-Host "  4. Or scan expo-go-qr.png (open in file explorer)" -ForegroundColor Gray
  Write-Host "`n  Proxy (restaurant search): $proxyUrl" -ForegroundColor Gray
  Write-Host "  Metro (app): $metroUrl" -ForegroundColor Gray
} else {
  Write-Host "  Could not get Metro URL. Check .cf-metro-url" -ForegroundColor Red
}
Write-Host ""
