# 📚 Documentación del Proyecto

Bienvenido a la documentación técnica del sistema Printer Fleet Manager.

## 📖 Documentación Disponible

### 🎨 Diseño y UI
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** - Sistema de diseño, componentes y guías de UI/UX

### 🔍 Funcionalidades
- **[DISCOVERY_SORTING_FILTERING.md](DISCOVERY_SORTING_FILTERING.md)** - Sistema de descubrimiento automático y filtrado de impresoras
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Resumen general de implementación del proyecto

### 🚀 Operaciones
- **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)** - Guía completa para despliegue en producción
- **[CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md)** - Limpieza y optimización del código

## 📂 Documentación por Carpeta

### `/deployment`
Configuraciones para producción:
- Docker Compose producción
- Nginx configuration
- Systemd service
- [Ver deployment/README.md](../deployment/README.md)

### `/scripts`
Scripts de utilidad y migraciones:
- Migración de base de datos
- Setup de tasas de cambio
- [Ver scripts/README.md](../scripts/README.md)

### `/api`
Backend FastAPI:
- Documentación de API endpoints en `/docs`
- Documentación interactiva en `/redoc`

### `/web`
Frontend Next.js:
- Componentes en `web/components/`
- Páginas en `web/app/`

## 🎯 Guías Rápidas

### Para Nuevos Desarrolladores
1. Leer [README principal](../README.md)
2. Revisar [Sistema de Diseño](DESIGN_SYSTEM.md)
3. Explorar [Resumen de Implementación](IMPLEMENTATION_SUMMARY.md)

### Para DevOps/Deployment
1. [Guía de Producción](PRODUCTION_DEPLOYMENT.md)
2. [Configuración Deployment](../deployment/README.md)
3. Variables de entorno

### Para Entender el Sistema
1. [Estructura del Proyecto](../README.md#estructura-del-proyecto)
2. [Discovery System](DISCOVERY_SORTING_FILTERING.md)
3. Revisar código fuente

## 🔗 Enlaces Externos

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js 14 Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Recharts](https://recharts.org/)
- [Docker Compose](https://docs.docker.com/compose/)

## 📝 Contribuir a la Documentación

Al agregar nueva documentación:
- Usar formato Markdown
- Incluir ejemplos de código
- Agregar capturas si es relevante
- Actualizar este índice
- Mantener estructura clara

---

**Última actualización:** Noviembre 2025  
**Mantenedor:** Equipo de Desarrollo