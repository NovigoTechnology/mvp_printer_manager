#!/bin/bash
# Script de actualización del servidor CON SUDO
# Ejecutar: bash update-sudo.sh

echo "🚀 Iniciando actualización del Printer Fleet Manager..."

# Ir al directorio del proyecto
cd ~/mvp_printer_manager || exit 1

# Detener servicios actuales
echo "⏸️  Deteniendo servicios..."
sudo docker compose down

# Actualizar código
echo "📥 Actualizando código desde Git..."
git fetch origin
git reset --hard origin/main
git pull origin main

# Verificar archivo .env.production
echo "🔧 Verificando configuración de producción..."
if [ ! -f ".env.production" ]; then
    echo "⚠️  Advertencia: No se encontró .env.production"
    echo "Creando desde .env.example..."
    cp .env.example .env.production
fi

# Rebuild y reiniciar servicios
echo "🔨 Reconstruyendo imágenes Docker..."
sudo docker compose build --no-cache

echo "▶️  Iniciando servicios..."
sudo docker compose up -d

# Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios inicien..."
sleep 15

# Verificar estado
echo "📊 Estado de los servicios:"
sudo docker compose ps

echo ""
echo "✅ Actualización completada!"
echo ""
echo "URLs del servicio:"
echo "  - Frontend: http://10.10.10.193:3000"
echo "  - API: http://10.10.10.193:8000"
echo "  - Docs API: http://10.10.10.193:8000/docs"
echo ""
echo "Ver logs:"
echo "  sudo docker compose logs -f"
echo "  sudo docker compose logs -f api"
echo "  sudo docker compose logs -f web"
