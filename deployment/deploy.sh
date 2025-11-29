#!/bin/bash

################################################################################
# Script de Despliegue - Printer Fleet Manager
# Servidor: 10.10.10.193
# Usuario: im
################################################################################

set -e  # Salir si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo "================================================================================"
echo "  Printer Fleet Manager - Script de Despliegue"
echo "  Servidor: 10.10.10.193"
echo "================================================================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.prod.yml" ]; then
    print_error "No se encontró docker-compose.prod.yml"
    print_info "Asegúrate de ejecutar este script desde el directorio /deployment"
    exit 1
fi

# 1. Verificar Docker y Docker Compose
print_info "Verificando Docker y Docker Compose..."
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose no está instalado"
    exit 1
fi
print_success "Docker y Docker Compose están instalados"

# 2. Verificar archivo .env.production
print_info "Verificando archivo .env.production..."
if [ ! -f "../.env.production" ]; then
    print_error "No se encontró el archivo .env.production"
    exit 1
fi
print_success "Archivo .env.production encontrado"

# 3. Detener contenedores existentes (si existen)
print_info "Deteniendo contenedores existentes (si existen)..."
docker compose -f docker-compose.prod.yml --env-file ../.env.production down 2>/dev/null || true
print_success "Contenedores detenidos"

# 4. Crear directorios necesarios
print_info "Creando directorios necesarios..."
mkdir -p backups
mkdir -p logs
print_success "Directorios creados"

# 5. Construir imágenes
print_info "Construyendo imágenes Docker..."
docker compose -f docker-compose.prod.yml --env-file ../.env.production build --no-cache
print_success "Imágenes construidas exitosamente"

# 6. Iniciar servicios
print_info "Iniciando servicios..."
docker compose -f docker-compose.prod.yml --env-file ../.env.production up -d
print_success "Servicios iniciados"

# 7. Esperar a que los servicios estén listos
print_info "Esperando a que los servicios estén listos..."
sleep 10

# 8. Verificar estado de los contenedores
print_info "Verificando estado de los contenedores..."
docker compose -f docker-compose.prod.yml ps

# 9. Verificar logs de los servicios
print_info "Verificando logs de los servicios..."
echo ""
echo "=== Logs de la Base de Datos ==="
docker compose -f docker-compose.prod.yml logs db --tail 5
echo ""
echo "=== Logs de Redis ==="
docker compose -f docker-compose.prod.yml logs redis --tail 5
echo ""
echo "=== Logs de la API ==="
docker compose -f docker-compose.prod.yml logs api --tail 10
echo ""
echo "=== Logs del Frontend ==="
docker compose -f docker-compose.prod.yml logs web --tail 10
echo ""
echo "=== Logs de Nginx ==="
docker compose -f docker-compose.prod.yml logs nginx --tail 5

# 10. Verificar conectividad
print_info "Verificando conectividad..."
sleep 5

# Verificar Nginx
if curl -f http://localhost/health &> /dev/null; then
    print_success "Nginx está respondiendo correctamente"
else
    print_warning "Nginx no está respondiendo en /health"
fi

# Verificar Frontend
if curl -f http://localhost/ &> /dev/null; then
    print_success "Frontend está accesible"
else
    print_warning "Frontend no está respondiendo"
fi

# Verificar API
if curl -f http://localhost/api/health &> /dev/null; then
    print_success "API está respondiendo correctamente"
else
    print_warning "API no está respondiendo en /api/health"
fi

# 11. Información final
echo ""
print_success "¡Despliegue completado!"
echo ""
echo "================================================================================"
echo "  Información del Despliegue"
echo "================================================================================"
echo ""
echo "  URL de la Aplicación:  http://10.10.10.193"
echo "  URL de la API:         http://10.10.10.193/api"
echo "  Health Check:          http://10.10.10.193/health"
echo ""
echo "  Comandos útiles:"
echo "  -----------------"
echo "  Ver logs en tiempo real:     docker compose -f docker-compose.prod.yml logs -f"
echo "  Detener servicios:           docker compose -f docker-compose.prod.yml down"
echo "  Reiniciar servicios:         docker compose -f docker-compose.prod.yml restart"
echo "  Ver estado de contenedores:  docker compose -f docker-compose.prod.yml ps"
echo ""
echo "================================================================================"
echo ""

# 12. Preguntar si configurar firewall
read -p "¿Deseas configurar el firewall UFW ahora? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Configurando firewall UFW..."
    
    # Permitir SSH (importante!)
    sudo ufw allow 22/tcp
    print_success "Puerto 22 (SSH) permitido"
    
    # Permitir HTTP
    sudo ufw allow 80/tcp
    print_success "Puerto 80 (HTTP) permitido"
    
    # Habilitar UFW
    print_warning "Habilitando UFW..."
    echo "y" | sudo ufw enable
    
    # Mostrar estado
    sudo ufw status verbose
    
    print_success "Firewall configurado correctamente"
fi

print_success "¡Todo listo! La aplicación está en ejecución."
