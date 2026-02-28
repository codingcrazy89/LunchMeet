# Start LunchMeet for remote users - uses Cloudflare Quick Tunnel for proxy (no account needed)
# Alternative to ngrok when ngrok fails. Uses: proxy + cloudflared tunnel + Expo tunnel
# Requires: npm install cloudflared (or npx will fetch it)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

Write-Host "`n=== LunchMeet Remote (Cloudflare tunnel for proxy) ===" -ForegroundColor Cyan
Write-Host "Uses Cloudflare Quick Tunnel - no account needed. Restaurant search works remotely.`n" -ForegroundColor Gray

# 1. Start proxy
Write-Host "[1/4] Starting Places proxy..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== Places Proxy ===' -ForegroundColor Cyan; npm run proxy"
Start-Sleep -Seconds 3

# 2. Start cloudflared tunnel for proxy (helper runs in background, captures URL via library API)
Write-Host "[2/4] Starting Cloudflare tunnel for proxy..." -ForegroundColor Yellow
$urlFile = Join-Path $projectRoot ".cloudflare-tunnel-url"
if (Test-Path $urlFile) { Remove-Item $urlFile -Force }
Start-Process -FilePath "node" -ArgumentList "scripts/start-remote-cloudflare-helper.js" -WorkingDirectory $projectRoot -WindowStyle Hidden
$proxyUrl = $null
Write-Host "  Waiting for tunnel URL (up to 60s, first run may download cloudflared)..." -ForegroundColor Gray
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $urlFile) {
    $proxyUrl = (Get-Content $urlFile -Raw).Trim()
    break
  }
}
if ($proxyUrl) {
  Write-Host "  Proxy tunnel URL: $proxyUrl" -ForegroundColor Green
  Write-Host "  Updated .env" -ForegroundColor Green
} else {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== Cloudflare Proxy Tunnel ===' -ForegroundColor Cyan; Write-Host 'Copy the URL, run: .\scripts\set-proxy-url.ps1 `"URL`"' -ForegroundColor Yellow; npx cloudflared tunnel --url http://localhost:8787"
  Write-Host "  Tunnel window opened. Copy the URL, run: .\scripts\set-proxy-url.ps1 `"https://xxx.trycloudflare.com`"" -ForegroundColor Yellow
}
Start-Sleep -Seconds 2

# 3. Start Expo with tunnel
Write-Host "[3/4] Starting Metro (Expo) with tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host '=== Metro (Expo Tunnel) ===' -ForegroundColor Cyan; Write-Host 'Share the exp:// or exps:// URL with remote users!' -ForegroundColor Green; npx expo start --tunnel"
Start-Sleep -Seconds 8

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "`nShare the exp:// or exps:// URL from the Expo window with remote users." -ForegroundColor Cyan
Write-Host "Restaurant search will work - proxy is tunneled via Cloudflare.`n" -ForegroundColor Green
