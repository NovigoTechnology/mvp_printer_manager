# Variables de Entorno - Documentación Completa

## Índice
- [Resumen General](#resumen-general)
- [Configuración Centralizada](#configuración-centralizada)
- [Variables por Categoría](#variables-por-categoría)
  - [Database](#database)
  - [JWT Authentication](#jwt-authentication)
  - [CORS](#cors)
  - [Medical Printers](#medical-printers)
  - [SNMP](#snmp)
  - [Rate Limiting](#rate-limiting)
  - [Application](#application)
  - [Redis](#redis)
  - [Frontend](#frontend)
- [Validación de Producción](#validación-de-producción)
- [Troubleshooting](#troubleshooting)

---

## Resumen General

El proyecto utiliza **Pydantic Settings** para gestión centralizada de configuración en `api/app/config.py`. Todas las variables de entorno se validan automáticamente al iniciar la aplicación.

### Métodos de Configuración

1. **Variables de Entorno del Sistema**
2. **Archivo `.env`** en el directorio raíz (desarrollo)
3. **docker-compose.yml** (contenedores)

### Prioridad de Carga

1. Variables de entorno del sistema (mayor prioridad)
2. Archivo `.env` 
3. Valores por defecto en `config.py` (si aplica)

---

## Configuración Centralizada

**Archivo:** `api/app/config.py`

```python
from .config import settings, get_settings, validate_production_config

# Uso directo
database_url = settings.database_url
jwt_secret = settings.jwt_secret

# Dependency injection en FastAPI
@app.get("/")
def root(config: Settings = Depends(get_settings)):
    return {"app": config.app_name}

# Validación de producción
validate_production_config()  # Lanza ValueError si hay problemas
```

### Ventajas

✅ **Validación automática** - Fail-fast si falta una variable crítica  
✅ **Type hints** - IDE autocomplete y type checking  
✅ **Documentación integrada** - Docstrings en cada variable  
✅ **Conversión automática** - String → int, bool, list, etc.  
✅ **Testing fácil** - Inyección de configuración mock  

---

## Variables por Categoría

### Database

#### `DATABASE_URL` (REQUIRED)

**Tipo:** `string`  
**Formato:** `postgresql://user:password@host:port/database`  
**Default:** None - **Aplicación no inicia sin esta variable**

```bash
# Desarrollo
DATABASE_URL=postgresql://postgres:postgres@db:5432/printer_fleet

# Producción (cambiar credenciales)
DATABASE_URL=postgresql://printer_user:SecurePass123@10.10.10.193:5432/printer_fleet_prod
```

**Configuración en:** `api/app/config.py` → `settings.database_url`  
**Usado en:** `api/app/db.py`

⚠️ **CRITICAL:** En producción, cambiar credenciales por defecto `postgres:postgres`

---

### JWT Authentication

#### `JWT_SECRET` (REQUIRED)

**Tipo:** `string` (64 caracteres hexadecimales recomendado)  
**Default:** None - **Aplicación no inicia sin esta variable**

```bash
# Desarrollo (NUNCA usar en producción)
JWT_SECRET=dev-secret-key-change-in-production-64-chars-minimum

# Producción (generar aleatorio)
JWT_SECRET=a7f8d3e2c9b1a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3
```

**Generar secreto:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
python scripts/generate_production_secrets.py
```

**Configuración en:** `api/app/config.py` → `settings.jwt_secret`  
**Usado en:** `api/app/routers/auth.py`

⚠️ **CRITICAL:** Generar un secreto aleatorio de 64 caracteres en producción

---

#### `JWT_ALGORITHM`

**Tipo:** `string`  
**Default:** `"HS256"`  
**Opciones:** `HS256`, `HS384`, `HS512`

```bash
JWT_ALGORITHM=HS256
```

**Configuración en:** `api/app/config.py` → `settings.jwt_algorithm`  
**Usado en:** `api/app/routers/auth.py`

---

#### `JWT_EXPIRY_MINUTES`

**Tipo:** `integer`  
**Default:** `120` (2 horas)  
**Recomendado Desarrollo:** `480` (8 horas)  
**Recomendado Producción:** `60-120` (1-2 horas)

```bash
# Desarrollo (comodidad)
JWT_EXPIRY_MINUTES=480

# Producción (seguridad)
JWT_EXPIRY_MINUTES=60
```

**Configuración en:** `api/app/config.py` → `settings.jwt_expiry_minutes`  
**Usado en:** `api/app/routers/auth.py`

⚠️ **SECURITY:** En producción usar 60-120 minutos para reducir ventana de ataque

---

### CORS

#### `CORS_ORIGINS`

**Tipo:** `string` (lista separada por comas)  
**Default:** `"http://localhost:3000"`  
**Formato:** URLs completas separadas por comas, **sin espacios**

```bash
# Desarrollo
CORS_ORIGINS=http://localhost:3000

# Producción (múltiples orígenes)
CORS_ORIGINS=https://printer-manager.imsa.local,https://10.10.10.193,https://backup.imsa.local
```

**Configuración en:** `api/app/config.py` → `settings.cors_origins_list` (convierte a lista)  
**Usado en:** `api/app/main.py`

⚠️ **CRITICAL:** NUNCA usar `"*"` en producción. Especificar solo dominios autorizados.

**Acceso:**
```python
# String original
settings.cors_origins
# → "http://localhost:3000,https://printer.imsa.local"

# Lista procesada (usar esta)
settings.cors_origins_list
# → ["http://localhost:3000", "https://printer.imsa.local"]
```

---

### Medical Printers

#### `DRYPIX_LOGIN` (REQUIRED para impresoras médicas)

**Tipo:** `string`  
**Default:** None - **Aplicación no inicia sin esta variable**  
**Valor estándar del fabricante:** `"dryprinter"`

```bash
DRYPIX_LOGIN=dryprinter
```

**Configuración en:** `api/app/config.py` → `settings.drypix_login`  
**Usado en:** 
- `api/app/services/medical_printer_service.py`
- `api/app/workers/hourly_medical_polling.py`

⚠️ **REQUIRED:** Necesaria para monitorear impresoras DRYPIX SMART

---

#### `DRYPIX_PASSWORD` (REQUIRED para impresoras médicas)

**Tipo:** `string`  
**Default:** None - **Aplicación no inicia sin esta variable**  
**Valor estándar del fabricante:** `"fujifilm"`

```bash
DRYPIX_PASSWORD=fujifilm
```

**Configuración en:** `api/app/config.py` → `settings.drypix_password`  
**Usado en:** 
- `api/app/services/medical_printer_service.py`
- `api/app/workers/hourly_medical_polling.py`

⚠️ **PRODUCTION:** Verificar credenciales actualizadas con el fabricante

---

### SNMP

#### `POLL_COMMUNITY`

**Tipo:** `string`  
**Default:** `"public"` (desde os.getenv en SNMPService)  
**Community string estándar:** `"public"` para lectura

```bash
POLL_COMMUNITY=public
```

**Usado en:** `api/app/services/snmp.py`

💡 **Nota:** Para SNMP v2c (impresoras HP, OKI, Brother)

---

#### `SNMP_CONFIG_PATH`

**Tipo:** `string` (path absoluto)  
**Default:** `"/app/config/snmp_credentials.json"`

```bash
# Docker (default)
SNMP_CONFIG_PATH=/app/config/snmp_credentials.json

# Desarrollo local
SNMP_CONFIG_PATH=./config/snmp_credentials.json
```

**Configuración en:** `api/app/config.py` → `settings.snmp_config_path`  
**Usado en:** `api/app/services/snmp.py`

**Formato del archivo JSON:**
```json
{
  "10.10.XX.XX": {
    "username": "root",
    "auth_key": "authkey123",
    "priv_key": "privkey456",
    "context_name": "v3context"
  }
}
```

💡 **Nota:** Solo necesario si se usan impresoras con SNMPv3. Ver `config/snmp_credentials.json.example`

---

### Rate Limiting

#### `RATE_LIMIT_DEFAULT`

**Tipo:** `string`  
**Default:** `"1000/hour"`  
**Formato:** `"count/period"` (period: `second`, `minute`, `hour`, `day`)

```bash
RATE_LIMIT_DEFAULT=1000/hour
```

**Configuración en:** `api/app/config.py` → `settings.rate_limit_default`  
**Usado en:** `api/app/main.py`

---

#### `RATE_LIMIT_AUTH`

**Tipo:** `string`  
**Default:** `"5/minute"`  
**Recomendado:** `5-10` intentos por minuto para prevenir brute force

```bash
RATE_LIMIT_AUTH=5/minute
```

**Configuración en:** `api/app/config.py` → `settings.rate_limit_auth`  
**Usado en:** `api/app/routers/auth.py`

💡 **Anti-Brute Force:** 5 intentos por minuto = 300 intentos/hora máximo

---

### Application

#### `APP_NAME`

**Tipo:** `string`  
**Default:** `"Printer Fleet Manager API"`

```bash
APP_NAME=Printer Fleet Manager API
```

**Configuración en:** `api/app/config.py` → `settings.app_name`

---

#### `APP_VERSION`

**Tipo:** `string`  
**Default:** `"1.0.0"`

```bash
APP_VERSION=1.0.0
```

**Configuración en:** `api/app/config.py` → `settings.app_version`

---

#### `DEBUG`

**Tipo:** `boolean`  
**Default:** `False`  
**Valores aceptados:** `True`, `False`, `1`, `0`, `yes`, `no`

```bash
# Desarrollo (verbose logging)
DEBUG=True

# Producción (SIEMPRE False)
DEBUG=False
```

**Configuración en:** `api/app/config.py` → `settings.debug`

⚠️ **CRITICAL:** SIEMPRE debe ser `False` en producción (expone información sensible)

---

### Redis

#### `REDIS_HOST`

**Tipo:** `string`  
**Default:** `"redis"` (nombre del servicio en docker-compose)

```bash
# Docker Compose (usar nombre del servicio)
REDIS_HOST=redis

# Servidor externo
REDIS_HOST=10.10.10.50
```

**Configuración en:** `api/app/config.py` → `settings.redis_host`

---

#### `REDIS_PORT`

**Tipo:** `integer`  
**Default:** `6379`

```bash
REDIS_PORT=6379
```

**Configuración en:** `api/app/config.py` → `settings.redis_port`

---

#### `REDIS_PASSWORD`

**Tipo:** `string | None`  
**Default:** `None` (sin autenticación)

```bash
# Sin contraseña (desarrollo)
# REDIS_PASSWORD=

# Con contraseña (producción)
REDIS_PASSWORD=SecureRedisPass123
```

**Configuración en:** `api/app/config.py` → `settings.redis_password`

⚠️ **PRODUCTION:** Configurar contraseña en Redis y establecer aquí

---

### Frontend

#### `NEXT_PUBLIC_API_BASE`

**Tipo:** `string` (URL completa)  
**Default:** `"http://localhost:8000"`

```bash
# Desarrollo
NEXT_PUBLIC_API_BASE=http://localhost:8000

# Producción
NEXT_PUBLIC_API_BASE=https://api.printer-manager.imsa.local
```

**Usado en:** `web/` (Next.js frontend)

💡 **Nota:** `NEXT_PUBLIC_*` variables son expuestas al navegador

---

## Validación de Producción

### Función `validate_production_config()`

**Ubicación:** `api/app/config.py`

```python
from .config import validate_production_config

# Ejecutar antes del despliegue
try:
    validate_production_config()
    print("✅ Configuración segura para producción")
except ValueError as e:
    print(f"⚠️ {e}")
    # Corregir problemas antes de continuar
```

### Validaciones Realizadas

1. ✅ **JWT_SECRET** no es un valor de desarrollo común
   - Rechaza: `your-secret-key`, `change-me`, `secret`, `dev-secret`, `test-secret`

2. ✅ **CORS_ORIGINS** no incluye wildcard `"*"`
   - Rechaza: `CORS_ORIGINS=*`
   - Rechaza: `CORS_ORIGINS=http://localhost:3000,*`

3. ✅ **JWT_EXPIRY_MINUTES** no es excesivamente largo
   - Warning si > 480 minutos (8 horas)

4. ✅ **DEBUG** está desactivado
   - Debe ser `False` en producción

### Ejemplo de Output

```
⚠️ CONFIGURACIÓN INSEGURA PARA PRODUCCIÓN:
  - JWT_SECRET parece ser un valor de desarrollo. Generar uno seguro con: python -c 'import secrets; print(secrets.token_hex(32))'
  - CORS_ORIGINS contiene '*' (wildcard). En producción debe especificar dominios exactos.
  - JWT_EXPIRY_MINUTES es 480 minutos (>8 horas). En producción se recomienda 60-120 minutos.
  - DEBUG=True está activado. En producción debe ser False.
```

---

## Troubleshooting

### Error: Application no inicia

#### Síntoma
```
ValueError: DATABASE_URL environment variable is required
```

**Causa:** Variable requerida no está configurada

**Solución:**
```bash
# Verificar variables de entorno
docker-compose exec api printenv | grep DATABASE_URL

# Si no existe, agregar a docker-compose.yml o .env
echo "DATABASE_URL=postgresql://postgres:postgres@db:5432/printer_fleet" >> .env
```

---

### Error: CORS blocked

#### Síntoma
```
Access to fetch at 'http://localhost:8000/api/...' from origin 'http://localhost:3001' 
has been blocked by CORS policy
```

**Causa:** Frontend no está en la lista de CORS_ORIGINS

**Solución:**
```bash
# Agregar el origen a CORS_ORIGINS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

### Error: SNMPv3 config file not found

#### Síntoma
```
WARNING: SNMPv3 config file not found at '/app/config/snmp_credentials.json'
```

**Causa:** Archivo de credenciales SNMPv3 no existe

**Solución (si NO usas SNMPv3):**
- ✅ Ignorar el warning - SNMPv2c funcionará normalmente

**Solución (si SÍ usas SNMPv3):**
```bash
# Crear el archivo
cp config/snmp_credentials.json.example config/snmp_credentials.json

# Editar con credenciales reales
nano config/snmp_credentials.json
```

---

### Error: Invalid JSON in SNMPv3 config

#### Síntoma
```
ERROR: Invalid JSON format in SNMPv3 config file: Expecting ',' delimiter: line 5 column 10
```

**Causa:** Sintaxis JSON incorrecta

**Solución:**
```bash
# Validar JSON online o con Python
python -m json.tool config/snmp_credentials.json

# Errores comunes:
# - Coma al final del último elemento
# - Comillas simples en lugar de dobles
# - Falta cerrar llaves/corchetes
```

---

### Error: Rate limit exceeded

#### Síntoma
```
429 Too Many Requests
```

**Causa:** Cliente excedió el rate limit configurado

**Solución (ajustar límites):**
```bash
# Aumentar límites (si es legítimo)
RATE_LIMIT_DEFAULT=2000/hour
RATE_LIMIT_AUTH=10/minute
```

**Solución (debugging):**
```bash
# Ver logs de rate limiting
docker-compose logs api | grep "rate limit"
```

---

### Error: Token expired

#### Síntoma
```
401 Unauthorized: Token has expired
```

**Causa:** JWT expiró según JWT_EXPIRY_MINUTES

**Solución (aumentar expiry para desarrollo):**
```bash
JWT_EXPIRY_MINUTES=480  # 8 horas
```

**Solución (producción - renovar token):**
- Frontend debe manejar renovación automática
- Usuario debe hacer login nuevamente

---

## Checklist de Producción

Antes de desplegar a producción, verificar:

- [ ] `DATABASE_URL` - Credenciales seguras (NO `postgres:postgres`)
- [ ] `JWT_SECRET` - 64 caracteres aleatorios (ejecutar `generate_production_secrets.py`)
- [ ] `JWT_EXPIRY_MINUTES` - 60-120 minutos
- [ ] `CORS_ORIGINS` - Dominios exactos (NO `"*"`)
- [ ] `DEBUG` - False
- [ ] `DRYPIX_LOGIN/PASSWORD` - Verificar con fabricante
- [ ] `SNMP_CONFIG_PATH` - Configurado si usa SNMPv3
- [ ] `REDIS_PASSWORD` - Configurado si Redis tiene autenticación
- [ ] Ejecutar `validate_production_config()` - Sin errores

---

## Referencias

- **Código fuente:** `api/app/config.py`
- **Ejemplo de configuración:** `.env.example`
- **Pydantic Settings docs:** https://docs.pydantic.dev/latest/concepts/pydantic_settings/
- **Documentos relacionados:**
  - `docs/RESUMEN_IMPLEMENTACION_SEGURIDAD.md`
  - `docs/IMPLEMENTACION_MEJORAS_CRITICAS.md`
  - `docs/IMPLEMENTACION_MEJORAS_PRIORIDAD_ALTA.md`
