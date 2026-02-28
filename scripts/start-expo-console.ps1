# Start Expo dev server so console logs appear in this terminal
# Use the app in Expo Go (scan QR) - all [Auth], [Login], [Host] logs will show here

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

Write-Host "=== Expo Dev Server (live console logs) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open the app in Expo Go (scan QR code)." -ForegroundColor Yellow
Write-Host "All console.log / console.error from the app will appear below." -ForegroundColor Yellow
Write-Host "Try 'Send Login Link' to see [Auth] and [Login] workflow." -ForegroundColor Yellow
Write-Host ""

# Use port 8083 if 8081 is busy (avoids interactive prompt)
npx expo start --port 8083
