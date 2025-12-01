#!/usr/bin/env bash
# Script de Limpieza y Mantenimiento del Proyecto
# Uso: ./scripts/cleanup.sh

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧹 Iniciando limpieza del proyecto...${NC}\n"

# 1. Limpiar cache de Python
echo -e "${YELLOW}📦 Limpiando cache de Python...${NC}"
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
echo -e "${GREEN}✅ Cache de Python limpiado${NC}\n"

# 2. Limpiar archivos de backup
echo -e "${YELLOW}💾 Buscando archivos de backup...${NC}"
backup_files=$(find . -type f \( -name "*.backup" -o -name "*.bak" -o -name "*_backup.*" -o -name "*backup.tsx" -o -name "*backup.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" 2>/dev/null || true)

if [ -n "$backup_files" ]; then
    echo -e "${RED}⚠️  Se encontraron archivos de backup:${NC}"
    echo "$backup_files"
    read -p "¿Eliminar estos archivos? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$backup_files" | xargs rm -f
        echo -e "${GREEN}✅ Archivos de backup eliminados${NC}\n"
    else
        echo -e "${YELLOW}⚠️  Archivos de backup preservados${NC}\n"
    fi
else
    echo -e "${GREEN}✅ No se encontraron archivos de backup${NC}\n"
fi

# 3. Limpiar archivos temporales
echo -e "${YELLOW}🗑️  Limpiando archivos temporales...${NC}"
find . -type f \( -name "*.tmp" -o -name "*.temp" -o -name "*~" \) ! -path "./node_modules/*" ! -path "./.git/*" -delete 2>/dev/null || true
echo -e "${GREEN}✅ Archivos temporales eliminados${NC}\n"

# 4. Limpiar build de Next.js
echo -e "${YELLOW}🏗️  Limpiando build de Next.js...${NC}"
if [ -d "web/.next" ]; then
    rm -rf web/.next
    echo -e "${GREEN}✅ Build de Next.js limpiado${NC}\n"
else
    echo -e "${GREEN}✅ No hay build de Next.js para limpiar${NC}\n"
fi

# 5. Verificar node_modules (opcional)
echo -e "${YELLOW}📦 Verificando node_modules...${NC}"
if [ -d "web/node_modules" ]; then
    size=$(du -sh web/node_modules | cut -f1)
    echo -e "Tamaño de node_modules: ${size}"
    read -p "¿Reinstalar dependencias? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Reinstalando dependencias...${NC}"
        cd web && rm -rf node_modules package-lock.json && npm install && cd ..
        echo -e "${GREEN}✅ Dependencias reinstaladas${NC}\n"
    else
        echo -e "${GREEN}✅ Dependencias preservadas${NC}\n"
    fi
else
    echo -e "${YELLOW}⚠️  No se encontró node_modules${NC}\n"
fi

# 6. Verificar git status
echo -e "${YELLOW}📊 Estado del repositorio Git...${NC}"
git status --short

# Resumen final
echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 Limpieza completada exitosamente  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}\n"

echo -e "Acciones realizadas:"
echo -e "  ✅ Cache de Python limpiado"
echo -e "  ✅ Archivos de backup verificados"
echo -e "  ✅ Archivos temporales eliminados"
echo -e "  ✅ Build de Next.js limpiado"
echo -e "\nEjecuta 'git status' para ver cambios pendientes."
