#!/bin/bash

# Script de actualización automática del servidor
# Descarga cambios de main y ejecuta migraciones de BD

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║   Actualización del Servidor - MVP Printer Manager ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

cd ~/mvp_printer_manager

echo "📥 Actualizando repositorio desde main..."
git checkout main
git pull origin main
echo "✅ Repositorio actualizado"
echo ""

echo "🔄 Ejecutando migraciones de base de datos..."
python api/migrations/add_user_tracking_to_incidents.py
python api/app/migrations/add_cost_center_fk_to_contracts_and_printers.py
echo "✅ Migraciones completadas"
echo ""

echo "🐳 Reiniciando contenedores Docker..."
docker compose restart
echo "✅ Contenedores reiniciados"
echo ""

echo "✨ Actualización completada exitosamente!"
