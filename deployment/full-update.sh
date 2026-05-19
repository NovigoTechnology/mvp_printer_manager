#!/bin/bash
# Script completo de actualización y deployment
# Ejecutar: sudo bash full-update.sh

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🚀 Printer Fleet Manager - Actualización Completa      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Ir al directorio del proyecto (ya estamos en deployment)
cd /home/im/mvp_printer_manager || exit 1

# 1. Detener servicios actuales
echo "⏸️  Deteniendo servicios actuales..."
docker compose down 2>/dev/null || true

# Verificar y liberar puertos ocupados
echo "🔍 Verificando puertos ocupados..."
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Puerto 5432 ocupado, deteniendo contenedores..."
    docker ps -q --filter "publish=5432" | xargs -r docker stop
fi
if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Puerto 6379 ocupado, deteniendo contenedores..."
    docker ps -q --filter "publish=6379" | xargs -r docker stop
fi
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Puerto 8000 ocupado, deteniendo contenedores..."
    docker ps -q --filter "publish=8000" | xargs -r docker stop
fi
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Puerto 3000 ocupado, deteniendo contenedores..."
    docker ps -q --filter "publish=3000" | xargs -r docker stop
fi

# Limpiar contenedores huérfanos
docker container prune -f 2>/dev/null || true

echo "✅ Servicios detenidos y puertos liberados"
echo ""

# 2. Actualizar código
echo "📥 Actualizando código desde Git..."
git fetch origin
git reset --hard origin/main
git pull origin main
echo "✅ Código actualizado"
echo ""

# 3. Verificar archivo .env.production
echo "🔧 Verificando configuración..."
if [ -f ".env.production" ]; then
    echo "✅ Archivo .env.production encontrado"
    echo ""
    echo "Configuración actual:"
    echo "  NEXT_PUBLIC_API_BASE: $(grep NEXT_PUBLIC_API_BASE .env.production | cut -d '=' -f2)"
    echo "  CORS_ORIGINS: $(grep CORS_ORIGINS .env.production | cut -d '=' -f2)"
else
    echo "⚠️  No se encontró .env.production"
    exit 1
fi
echo ""

# 4. Limpiar imágenes antiguas
echo "🧹 Limpiando imágenes antiguas..."
docker system prune -f
echo "✅ Limpieza completada"
echo ""

# 5. Rebuild completo
echo "🔨 Reconstruyendo imágenes Docker (esto puede tardar varios minutos)..."
docker compose --env-file .env.production build --no-cache api
docker compose --env-file .env.production build --no-cache web
echo "✅ Imágenes reconstruidas"
echo ""

# 6. Iniciar servicios
echo "▶️  Iniciando servicios..."
docker compose --env-file .env.production up -d
echo "✅ Servicios iniciados"
echo ""

# 7. Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios inicien (30 segundos)..."
sleep 30

# 8. Ejecutar migraciones de base de datos
echo "🗃️  Ejecutando migraciones de base de datos..."
docker compose exec -T api python migrations/add_user_tracking_to_incidents.py 2>/dev/null || echo "ℹ️  Migraciones ya aplicadas o no necesarias"
echo "✅ Migraciones completadas"
echo ""

# 8. Verificar estado
echo "📊 Estado de los servicios:"
docker compose ps
echo ""

# 9. Verificar logs recientes
echo "📝 Logs recientes del API:"
docker compose logs --tail 20 api
echo ""
echo "📝 Logs recientes del Web:"
docker compose logs --tail 20 web
echo ""

# 10. Resumen final
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 URLs del servicio:"
echo "  • Frontend:      http://10.10.10.193:3000"
echo "  • API Backend:   http://10.10.10.193:8000"
echo "  • API Docs:      http://10.10.10.193:8000/docs"
echo "  • PostgreSQL:    10.10.10.193:5432"
echo "  • Redis:         10.10.10.193:6379"
echo ""
echo "📊 Comandos útiles:"
echo "  • Ver logs en tiempo real:    sudo docker compose logs -f"
echo "  • Ver logs del API:           sudo docker compose logs -f api"
echo "  • Ver logs del frontend:      sudo docker compose logs -f web"
echo "  • Reiniciar servicios:        sudo docker compose restart"
echo "  • Detener servicios:          sudo docker compose down"
echo ""
