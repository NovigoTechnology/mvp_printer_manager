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
echo "✅ Servicios detenidos"
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
docker compose build --no-cache api
docker compose build --no-cache web
echo "✅ Imágenes reconstruidas"
echo ""

# 6. Iniciar servicios
echo "▶️  Iniciando servicios..."
docker compose up -d
echo "✅ Servicios iniciados"
echo ""

# 7. Esperar a que los servicios estén listos
echo "⏳ Esperando a que los servicios inicien (30 segundos)..."
sleep 30

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
