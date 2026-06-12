# Script de Actualización del Servidor
# Actualiza la rama main y ejecuta migraciones de base de datos
# Uso: ./actualizar-servidor.ps1

param(
    [string]$Host = "10.10.10.193",
    [string]$User = "im",
    [string]$Password = "",
    [switch]$NoMigration = $false
)

$sshHost = "$User@$Host"

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Actualización del Servidor - MVP Printer Manager   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Detalles de la conexión:" -ForegroundColor Yellow
Write-Host "   Host: $Host"
Write-Host "   Usuario: $User"
Write-Host ""

# Crear comandos a ejecutar en el servidor
$commands = @(
    "cd ~/mvp_printer_manager",
    "echo '📥 Actualizando repositorio...'",
    "git checkout main",
    "git pull origin main",
    "echo '✅ Repositorio actualizado'"
)

# Agregar migración de BD si no está deshabilitada
if (-not $NoMigration) {
    $commands += @(
        "echo '🔄 Ejecutando migraciones de base de datos...'",
        "python api/migrations/add_user_tracking_to_incidents.py",
        "python api/app/migrations/add_cost_center_fk_to_contracts_and_printers.py",
        "echo '✅ Migraciones ejecutadas'"
    )
}

$commands += @(
    "echo '🐳 Reiniciando contenedores Docker...'",
    "docker compose restart",
    "echo '✅ Servidor actualizado correctamente!'"
)

$scriptBody = $commands -join "; "

Write-Host "🔐 Conectando al servidor..." -ForegroundColor Yellow

if ($Password) {
    # Si se proporciona contraseña, usar sshpass
    $Password | sshpass -p - ssh -o StrictHostKeyChecking=no $sshHost $scriptBody
} else {
    # Crear archivo de script temporal
    $tempScript = New-TemporaryFile -Suffix ".sh"
    $scriptBody | Out-File -Encoding UTF8 -FilePath $tempScript.FullName -Force
    
    # Ejecutar comandos uno a uno (requiere interacción)
    Write-Host ""
    Write-Host "⚠️  Ingrese la contraseña cuando se le solicite:" -ForegroundColor Yellow
    Write-Host ""
    
    ssh -o StrictHostKeyChecking=no $sshHost $scriptBody
    
    Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✨ Proceso completado" -ForegroundColor Green
