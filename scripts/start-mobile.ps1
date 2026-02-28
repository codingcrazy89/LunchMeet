# Start LunchMeet for mobile development
# Opens two PowerShell windows: proxy server + Expo dev server

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

# Start proxy in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Places Proxy Server' -ForegroundColor Cyan; npm run proxy"

# Start Expo in new window (short delay so proxy starts first)
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'Expo Dev Server - Scan QR code with Expo Go' -ForegroundColor Cyan; npm start"

Write-Host "Opened two terminals. Scan the QR code in the Expo window with your phone." -ForegroundColor Green
Write-Host "Make sure your phone and computer are on the same Wi-Fi network." -ForegroundColor Yellow
