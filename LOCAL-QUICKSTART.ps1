# CloudLabOS Local Setup - Run as Administrator
# Save as: cloudlabos-setup.ps1

Write-Host "=== CloudLabOS Local Setup ===" -ForegroundColor Cyan

# 1. Install Docker Desktop
Write-Host "`n[1/4] Installing Docker Desktop..." -ForegroundColor Yellow
choco install docker-desktop -y

Write-Host "Please RESTART your computer after Docker Desktop installs" -ForegroundColor Green
Write-Host "Then enable WSL2 backend in Docker Desktop settings" -ForegroundColor Green

# 2. After restart, create .env file
Write-Host "`n[2/4] Creating .env file..." -ForegroundColor Yellow
$envExample = Get-Content ".env.example"
$envExample | Out-File -Encoding utf8 ".env"

# 3. Start services
Write-Host "`n[3/4] Starting CloudLabOS services..." -ForegroundColor Yellow
docker-compose up -d

# 4. Verify
Write-Host "`n[4/4] Verifying services..." -ForegroundColor Yellow
docker-compose ps

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Dashboard: http://localhost:3000" -ForegroundColor Green
Write-Host "API: http://localhost:8000" -ForegroundColor Green
Write-Host "Traefik: http://localhost:8080" -ForegroundColor Green

# YouTube Commands Endpoint
Write-Host "`n=== YouTube Integration ===" -ForegroundColor Cyan
Write-Host "Get curl commands from Dr. Abhishek channel:" -ForegroundColor Yellow
Write-Host 'curl -X POST http://localhost:8005/research -H "Content-Type: application/json" -d "{\"source\":\"youtube\",\"channel_id\":\"YOUR_CHANNEL_ID\"}"' -ForegroundColor White