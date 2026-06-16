# Quick deployment script for development
# Este script actualiza el código en el servidor y reinicia los contenedores

param(
    [string]$Host = "10.10.10.193",
    [string]$User = "ubuntu",
    [string]$RemotePath = "~/mvp_printer_manager"
)

Write-Host "🚀 Quick Deployment Script" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Connecting to: $User@$Host" -ForegroundColor Yellow
Write-Host "Remote path: $RemotePath" -ForegroundColor Yellow
Write-Host ""

$commands = @(
    "cd $RemotePath",
    "git fetch origin",
    "git checkout dev",
    "git pull origin dev",
    "sudo docker compose down",
    "sudo docker compose up -d --build",
    "sudo docker compose ps"
)

Write-Host "Executing deployment commands..." -ForegroundColor Cyan

foreach ($cmd in $commands) {
    Write-Host ">>> $cmd" -ForegroundColor Green
}

Write-Host ""
Write-Host "To execute, run this command in your terminal:" -ForegroundColor Yellow
Write-Host ""
Write-Host "ssh $User@$Host 'cd $RemotePath && git fetch origin && git checkout dev && git pull origin dev && sudo docker compose down && sudo docker compose up -d --build && sudo docker compose ps'" -ForegroundColor Cyan
Write-Host ""
Write-Host "After deployment, verify the changes at: http://$Host:3000/settings" -ForegroundColor Magenta
