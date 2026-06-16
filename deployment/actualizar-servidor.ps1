# Script de Actualización del Servidor
# Actualiza la rama main y ejecuta migraciones de base de datos
# Uso: ./actualizar-servidor.ps1

param(
    [string]$ServerHost = "10.10.10.193",
    [string]$User = "im",
    [string]$Password = "",
    [switch]$NoMigration = $false
)

$sshHost = "$User@$ServerHost"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   Actualizacion del Servidor - MVP Printer Manager " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Detalles de la conexion:" -ForegroundColor Yellow
Write-Host "   Host: $ServerHost"
Write-Host "   Usuario: $User"
Write-Host ""

# Crear comandos a ejecutar en el servidor
$commands = @(
    "cd ~/mvp_printer_manager",
    "echo 'Actualizando repositorio...'",
    "git checkout main",
    "git stash push -u -m auto-pre-update || true",
    "git pull --ff-only origin main",
    "echo 'Repositorio actualizado'"
)

# Agregar migración de BD si no está deshabilitada
if (-not $NoMigration) {
    $commands += @(
        "echo 'Ejecutando migraciones de base de datos...'",
        "echo '$Password' | sudo -S docker compose exec -T api python migrations/add_user_tracking_to_incidents.py || true",
        "echo '$Password' | sudo -S docker compose exec -T api python app/migrations/add_cost_center_fk_to_contracts_and_printers.py || true",
        "echo '$Password' | sudo -S docker compose exec -T api python app/migrations/add_medical_alerts_and_manual_flag.py || true",
        "echo '$Password' | sudo -S docker compose exec -T api python app/migrations/add_smtp_config.py || true",
        "echo 'Migraciones ejecutadas'"
    )
}

$commands += @(
    "echo 'Reiniciando contenedores Docker...'",
    "echo '$Password' | sudo -S docker compose restart",
    "echo '$Password' | sudo -S docker compose ps",
    "echo 'Servidor actualizado correctamente'"
)

$scriptBody = $commands -join "; "

Write-Host "Conectando al servidor..." -ForegroundColor Yellow

if ($Password) {
    # Si se proporciona contraseña, no requerir ingreso interactivo en sudo remoto
    ssh -o StrictHostKeyChecking=no $sshHost $scriptBody
} else {
    # Crear archivo de script temporal
    $tempScript = New-TemporaryFile -Suffix ".sh"
    $scriptBody | Out-File -Encoding UTF8 -FilePath $tempScript.FullName -Force
    
    # Ejecutar comandos uno a uno (requiere interacción)
    Write-Host ""
    Write-Host "Ingrese la contrasena cuando se le solicite:" -ForegroundColor Yellow
    Write-Host ""
    
    ssh -o StrictHostKeyChecking=no $sshHost $scriptBody
    
    Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Proceso completado" -ForegroundColor Green
