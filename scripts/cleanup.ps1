# Script de Limpieza y Mantenimiento del Proyecto
# Uso: .\scripts\cleanup.ps1

Write-Host "`n🧹 Iniciando limpieza del proyecto...`n" -ForegroundColor Green

# 1. Limpiar cache de Python
Write-Host "📦 Limpiando cache de Python..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -File -Filter "*.pyc" | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -File -Filter "*.pyo" | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "✅ Cache de Python limpiado`n" -ForegroundColor Green

# 2. Limpiar archivos de backup
Write-Host "💾 Buscando archivos de backup..." -ForegroundColor Yellow
$backupFiles = Get-ChildItem -Recurse -File | Where-Object { 
    ($_.Name -like "*.backup") -or 
    ($_.Name -like "*.bak") -or 
    ($_.Name -like "*_backup.*") -or 
    ($_.Name -like "*backup.tsx") -or 
    ($_.Name -like "*backup.ts") 
} | Where-Object { 
    $_.FullName -notlike "*\node_modules\*" -and 
    $_.FullName -notlike "*\.git\*" 
}

if ($backupFiles) {
    Write-Host "⚠️  Se encontraron archivos de backup:" -ForegroundColor Red
    $backupFiles | ForEach-Object { Write-Host "  - $($_.FullName)" }
    $response = Read-Host "`n¿Eliminar estos archivos? (s/n)"
    if ($response -eq "s" -or $response -eq "S") {
        $backupFiles | Remove-Item -Force
        Write-Host "✅ Archivos de backup eliminados`n" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Archivos de backup preservados`n" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ No se encontraron archivos de backup`n" -ForegroundColor Green
}

# 3. Limpiar archivos temporales
Write-Host "🗑️  Limpiando archivos temporales..." -ForegroundColor Yellow
Get-ChildItem -Recurse -File | Where-Object { 
    ($_.Name -like "*.tmp") -or 
    ($_.Name -like "*.temp") -or 
    ($_.Name -like "*~") 
} | Where-Object { 
    $_.FullName -notlike "*\node_modules\*" -and 
    $_.FullName -notlike "*\.git\*" 
} | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "✅ Archivos temporales eliminados`n" -ForegroundColor Green

# 4. Limpiar build de Next.js
Write-Host "🏗️  Limpiando build de Next.js..." -ForegroundColor Yellow
if (Test-Path "web\.next") {
    Remove-Item -Recurse -Force "web\.next"
    Write-Host "✅ Build de Next.js limpiado`n" -ForegroundColor Green
} else {
    Write-Host "✅ No hay build de Next.js para limpiar`n" -ForegroundColor Green
}

# 5. Verificar node_modules (opcional)
Write-Host "📦 Verificando node_modules..." -ForegroundColor Yellow
if (Test-Path "web\node_modules") {
    $size = (Get-ChildItem -Recurse "web\node_modules" | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host ("Tamaño de node_modules: {0:N2} MB" -f $size)
    $response = Read-Host "¿Reinstalar dependencias? (s/n)"
    if ($response -eq "s" -or $response -eq "S") {
        Write-Host "Reinstalando dependencias..." -ForegroundColor Yellow
        Push-Location web
        Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
        Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
        npm install
        Pop-Location
        Write-Host "✅ Dependencias reinstaladas`n" -ForegroundColor Green
    } else {
        Write-Host "✅ Dependencias preservadas`n" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  No se encontró node_modules`n" -ForegroundColor Yellow
}

# 6. Verificar git status
Write-Host "📊 Estado del repositorio Git..." -ForegroundColor Yellow
git status --short

# Resumen final
Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🎉 Limpieza completada exitosamente  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Acciones realizadas:"
Write-Host "  ✅ Cache de Python limpiado"
Write-Host "  ✅ Archivos de backup verificados"
Write-Host "  ✅ Archivos temporales eliminados"
Write-Host "  ✅ Build de Next.js limpiado"
Write-Host "`nEjecuta 'git status' para ver cambios pendientes."
