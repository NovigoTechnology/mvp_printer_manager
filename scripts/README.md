# Scripts

Utilidades y scripts de mantenimiento para el proyecto.

## Archivos

### `migration_add_ip_history.py`
Script de migración de base de datos para agregar historial de cambios de IP a las impresoras.

**Uso:**
```bash
cd api
python ../scripts/migration_add_ip_history.py
```

### `setup_exchange_rate_sources.py`
Script de configuración inicial para fuentes de tasas de cambio.

**Uso:**
```bash
cd api
python ../scripts/setup_exchange_rate_sources.py
```

## Notas

- Todos los scripts deben ejecutarse desde el directorio `api/` para tener acceso correcto a las variables de entorno y dependencias.
- Los scripts de migración deben ejecutarse con precaución en producción.
