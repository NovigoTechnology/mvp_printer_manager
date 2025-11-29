# 📚 Documentación del Proyecto

Esta carpeta contiene toda la documentación técnica del sistema Printer Fleet Manager.

## 📑 Índice de Documentos

### 🎨 Diseño y UI
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** - Sistema de diseño, paleta de colores y componentes UI
- **[INVENTORY_UI_IMPROVEMENTS.md](INVENTORY_UI_IMPROVEMENTS.md)** - Mejoras de interfaz en inventario

### 🏥 Impresoras Médicas
- **[MEDICAL_PRINTER_FLOW.md](MEDICAL_PRINTER_FLOW.md)** - Flujo completo de integración de impresoras médicas
- **[DESCUBRIMIENTO_IMPRESORAS_MEDICAS.md](DESCUBRIMIENTO_IMPRESORAS_MEDICAS.md)** - Implementación del descubrimiento web-based
- **[DETECCION_CAMBIO_CARTUCHO.md](DETECCION_CAMBIO_CARTUCHO.md)** - Sistema de detección de cambios de cartucho
- **[IMPLEMENTACION_UPTIME_REAL.md](IMPLEMENTACION_UPTIME_REAL.md)** - Implementación de monitoreo de uptime
- **[README_DRYPIX.md](README_DRYPIX.md)** - Documentación específica de FUJIFILM DRYPIX
- **[REVISION_IMPRESORAS_MEDICAS.md](REVISION_IMPRESORAS_MEDICAS.md)** - Revisión de funcionalidades médicas
- **[MEDICAL_INTEGRATION_SUMMARY.md](MEDICAL_INTEGRATION_SUMMARY.md)** - Resumen de integración completa

### 🔧 Implementación y Funcionalidades
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Resumen de implementaciones generales
- **[DISCOVERY_SORTING_FILTERING.md](DISCOVERY_SORTING_FILTERING.md)** - Sistema de ordenamiento y filtrado en descubrimiento

### 🚀 Deployment y DevOps
- **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)** - Guía completa de despliegue en producción
- **[GITHUB_SETUP.md](GITHUB_SETUP.md)** - Configuración del repositorio GitHub

### 🧹 Mantenimiento
- **[CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md)** - Resumen de limpiezas y reorganizaciones

## 📖 Cómo usar esta documentación

### Para Desarrolladores Nuevos
1. Comienza con el [README principal](../README.md)
2. Revisa [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) para entender la UI
3. Si trabajarás con impresoras médicas, lee [MEDICAL_PRINTER_FLOW.md](MEDICAL_PRINTER_FLOW.md)

### Para Deployment
1. Lee [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) para instrucciones de despliegue
2. Revisa [GITHUB_SETUP.md](GITHUB_SETUP.md) para configuración del repositorio

### Para Funcionalidades Específicas
- **Impresoras Médicas**: Consulta la sección "Impresoras Médicas"
- **UI/UX**: Revisa DESIGN_SYSTEM.md e INVENTORY_UI_IMPROVEMENTS.md
- **Descubrimiento**: Lee DESCUBRIMIENTO_IMPRESORAS_MEDICAS.md y DISCOVERY_SORTING_FILTERING.md

## 🔄 Mantener la Documentación

Al agregar nueva funcionalidad:
1. Actualiza el documento relevante existente o crea uno nuevo
2. Actualiza este índice (README.md) con el nuevo documento
3. Menciona el cambio en IMPLEMENTATION_SUMMARY.md
4. Si es un cambio mayor, actualiza el README principal del proyecto

## 📝 Convenciones

### Nombres de Archivos
- Usar `UPPER_CASE_WITH_UNDERSCORES.md` para documentos principales
- Usar descripción clara del contenido
- Prefijos comunes:
  - `IMPLEMENTATION_` - Documentos de implementación
  - `MEDICAL_` - Relacionado con impresoras médicas
  - Sin prefijo - Documentos generales del sistema

### Formato de Documentos
- Usar emojis para secciones (📚 🔧 ⚙️ etc.)
- Incluir tabla de contenidos para docs largos
- Usar bloques de código con sintaxis highlighting
- Incluir ejemplos cuando sea posible

---

**Última actualización**: 29 de Noviembre, 2025
