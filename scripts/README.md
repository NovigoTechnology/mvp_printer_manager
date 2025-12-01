# Scripts de Utilidad

Este directorio contiene scripts útiles para el mantenimiento y operación del proyecto.

---

## 📋 Scripts Disponibles

### 🧹 cleanup.ps1 / cleanup.sh
**Script de limpieza y mantenimiento del proyecto**

Elimina archivos temporales, cache y backups innecesarios.

**Uso (Windows):**
```powershell
.\scripts\cleanup.ps1
```

**Uso (Linux/Mac):**
```bash
chmod +x scripts/cleanup.sh
./scripts/cleanup.sh
```

**Acciones que realiza:**
- ✅ Elimina directorios `__pycache__` y archivos `.pyc/.pyo`
- ✅ Busca y elimina archivos de backup (`.backup`, `.bak`, etc.)
- ✅ Elimina archivos temporales (`.tmp`, `.temp`, `*~`)
- ✅ Limpia el build de Next.js (`web/.next`)
- ✅ Opción para reinstalar `node_modules`
- ✅ Muestra el estado de Git

---

### 📊 migration_add_ip_history.py
**Migración para agregar historial de IPs**

Script de migración de base de datos para agregar historial de cambios de IP a las impresoras.

**Uso:**
```bash
cd api
python ../scripts/migration_add_ip_history.py
```

---

### 💱 setup_exchange_rate_sources.py
**Configuración inicial de fuentes de tasas de cambio**

Script de configuración inicial para fuentes de tasas de cambio.

**Uso:**
```bash
cd api
python ../scripts/setup_exchange_rate_sources.py
```

---

## 🔧 Mantenimiento Regular

### Limpieza Recomendada

**Semanal:**
```powershell
# Limpiar archivos temporales y cache
.\scripts\cleanup.ps1
```

**Mensual:**
```powershell
# Limpieza completa incluyendo reinstalación de dependencias
.\scripts\cleanup.ps1
# Responder "s" cuando pregunte por reinstalar node_modules
```

---

## 📝 Notas

### Archivos que NO se Eliminan

Los scripts preservan:
- ✅ Archivos en `.git/`
- ✅ Archivos en `node_modules/`
- ✅ Archivos de configuración
- ✅ Código fuente
- ✅ Documentación

### Archivos que SÍ se Eliminan

- ❌ Cache de Python (`__pycache__/`, `*.pyc`, `*.pyo`)
- ❌ Archivos de backup (`*.backup`, `*.bak`)
- ❌ Archivos temporales (`*.tmp`, `*.temp`, `*~`)
- ❌ Build de Next.js (`web/.next/`)

---

## ⚠️ Advertencias

- Los scripts de migración deben ejecutarse con precaución en producción
- El script de limpieza pregunta antes de eliminar backups
- Siempre revisa `git status` después de ejecutar scripts de limpieza

---

**Ver también:** `docs/CLEANUP_COMPLETED.md` para más información sobre la organización del proyecto.
