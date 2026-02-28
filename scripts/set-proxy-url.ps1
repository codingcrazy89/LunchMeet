# Update EXPO_PUBLIC_PLACES_PROXY_URL in .env
# Usage: .\scripts\set-proxy-url.ps1 "https://your-tunnel-url.loca.lt"
# Or:   .\scripts\set-proxy-url.ps1 "https://xxxx.ngrok-free.app"

param([Parameter(Mandatory=$true)][string]$Url)

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envPath = Join-Path $projectRoot ".env"
$Url = $Url.Trim().TrimEnd("/")

if (-not (Test-Path $envPath)) {
  Set-Content $envPath -Value "EXPO_PUBLIC_PLACES_PROXY_URL=$Url"
} else {
  $content = Get-Content $envPath -Raw
  if ($content -match "EXPO_PUBLIC_PLACES_PROXY_URL=") {
    $content = $content -replace "EXPO_PUBLIC_PLACES_PROXY_URL=.*", "EXPO_PUBLIC_PLACES_PROXY_URL=$Url"
  } else {
    $content += "`nEXPO_PUBLIC_PLACES_PROXY_URL=$Url"
  }
  Set-Content $envPath -Value $content.TrimEnd() -NoNewline
}

Write-Host "Updated .env: EXPO_PUBLIC_PLACES_PROXY_URL=$Url" -ForegroundColor Green
Write-Host "Restart the Expo window and reload the app on your phone." -ForegroundColor Yellow
