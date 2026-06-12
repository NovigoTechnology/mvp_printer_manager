#!/bin/bash
# Script de actualización del servidor
# Ejecutar en el servidor: bash update.sh

echo "🚀 Iniciando actualización del Printer Fleet Manager..."

# Ir al directorio del proyecto
cd ~/mvp_printer_manager || exit 1

# Detener servicios actuales
echo "⏸️  Deteniendo servicios..."
docker compose down

# Actualizar código
echo "📥 Actualizando código desde Git..."
git fetch origin
git reset --hard origin/main
git pull origin main

# Rebuild y reiniciar servicios
echo "🔨 Reconstruyendo imágenes Docker..."
docker compose build --no-cache

echo "▶️  Iniciando servicios..."
docker compose up -d

echo "🗃️  Ejecutando migraciones de base de datos..."
docker compose exec -T api python app/migrations/add_cost_center_fk_to_contracts_and_printers.py 2>/dev/null || echo "ℹ️  Migracion de centros de costo ya aplicada o no necesaria"

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios inicien..."
sleep 15

# Verificar estado
echo "📊 Estado de los servicios:"
docker compose ps

echo ""
echo "✅ Actualización completada!"
echo ""
echo "URLs del servicio:"
echo "  - Frontend: http://10.10.10.193:3000"
echo "  - API: http://10.10.10.193:8000"
echo "  - Docs API: http://10.10.10.193:8000/docs"
echo ""
echo "Ver logs:"
echo "  docker compose logs -f"
echo "  docker compose logs -f api"
echo "  docker compose logs -f web"
