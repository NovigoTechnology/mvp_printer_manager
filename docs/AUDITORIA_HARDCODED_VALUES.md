# Auditoría de Valores Hardcodeados - Printer Fleet Manager

**Fecha:** 2025-01-XX  
**Objetivo:** Identificar y catalogar TODOS los valores hardcodeados en el código para preparar el despliegue a producción  
**Prioridad:** ALTA - Seguridad y Configurabilidad

---

## 📋 Resumen Ejecutivo

Esta auditoría identifica **valores hardcodeados críticos** que deben externalizarse a variables de entorno antes del despliegue en producción en el servidor VMware (10.10.10.193).

### ⚠️ Hallazgos Críticos

| Categoría | Cantidad | Riesgo | Estado |
|-----------|----------|--------|--------|
| **Credenciales Expuestas** | 15+ | 🔴 CRÍTICO | Requiere acción inmediata |
| **IPs Hardcodeadas** | 30+ | 🟡 MEDIO | Documentado, algunas son ejemplos |
| **Puertos Hardcodeados** | 20+ | 🟢 BAJO | Mayoría son estándares |
| **URLs de API** | 20+ | 🟡 MEDIO | Ya usa variables de entorno con fallback |
| **Secretos JWT** | 3 | 🔴 CRÍTICO | Requiere generación segura |

---

## 🔴 CRÍTICO - Credenciales en Código

### 1. Credenciales de Base de Datos PostgreSQL

#### ❌ Hardcodeadas en Código
```python
# api/app/db.py (línea 6)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/printer_fleet")
```

**Usuario:** `postgres`  
**Password:** `postgres`  
**Ubicaciones:**
- `api/app/db.py`
- `api/app/migrations/create_medical_printer_refills.py`
- `api/app/migrations/create_medical_printer_counters_table.py`
- `api/migrations/add_user_tracking_to_incidents.py` (línea 48)
- `api/README.md` (línea 23)
- `docker-compose.yml` (líneas 6-7, 23)
- `scripts/setup_exchange_rate_sources.py` (líneas 12-13)
- `scripts/migration_add_ip_history.py` (líneas 19-20)

**Riesgo:** 🔴 CRÍTICO  
**Recomendación:** 
```bash
# .env.production
POSTGRES_USER=printer_admin_prod
POSTGRES_PASSWORD=<GENERAR_PASSWORD_SEGURO_32_CHARS>
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/printer_fleet
```

**Generación de password seguro:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

### 2. Credenciales DRYPIX (Impresoras Médicas)

#### ❌ Hardcodeadas en Código
```python
# api/app/services/medical_printer_service.py (líneas 52-53)
DEFAULT_LOGIN = "dryprinter"
DEFAULT_PASSWORD = "fujifilm"
```

**Usuario:** `dryprinter`  
**Password:** `fujifilm`  
**IP Objetivo:** `10.1.10.20:20051`  
**Ubicaciones:**
- `api/app/services/medical_printer_service.py` (líneas 52-53, 60-61)
- `docs/MEDICAL_PRINTER_FLOW.md` (múltiples referencias)
- `docs/README_DRYPIX.md`
- `docs/REVISION_IMPRESORAS_MEDICAS.md`

**Riesgo:** 🔴 CRÍTICO - Credenciales de equipo médico expuestas  
**Recomendación:**
```python
# Modificar DrypixScraper para usar variables de entorno
DEFAULT_LOGIN = os.getenv("DRYPIX_LOGIN", "dryprinter")
DEFAULT_PASSWORD = os.getenv("DRYPIX_PASSWORD", "fujifilm")
```

```bash
# .env.production
DRYPIX_LOGIN=<usuario_real>
DRYPIX_PASSWORD=<password_seguro>
```

---

### 3. Credenciales SNMPv3 (Impresoras OKI)

#### ❌ Hardcodeadas en Código
```python
# api/app/services/snmp.py (líneas 17-42)
self.v3_credentials = {
    '10.10.9.11': {  # OKI ES5162LP
        'username': 'root',
        'auth_key': '12345678',
        'priv_key': '12345678',
        'context_name': 'v3context',
    },
    '10.10.9.7': {
        'username': 'root',
        'auth_key': '12345678',
        'priv_key': '12345678',
    },
    '10.10.9.15': {
        'username': 'root',
        'auth_key': '12345678',
        'priv_key': '12345678',
    }
}
```

**Riesgo:** 🔴 CRÍTICO - Credenciales SNMPv3 expuestas con IPs específicas  
**Recomendación:**
```python
# Externalizar a configuración
def load_snmpv3_credentials(self):
    """Cargar credenciales SNMPv3 desde variables de entorno o archivo de configuración"""
    # Opción 1: Variables de entorno
    creds_json = os.getenv('SNMPV3_CREDENTIALS', '{}')
    return json.loads(creds_json)
    
    # Opción 2: Archivo de configuración externo (más seguro)
    config_path = os.getenv('SNMP_CONFIG_PATH', '/app/config/snmp_credentials.json')
    with open(config_path) as f:
        return json.load(f)
```

**Archivo de configuración:**
```json
// config/snmp_credentials.json (NO COMMITEAR A GIT)
{
    "10.10.9.11": {
        "username": "snmp_user",
        "auth_key": "<PASSWORD_SEGURO>",
        "priv_key": "<PASSWORD_SEGURO>",
        "context_name": "v3context"
    }
}
```

---

### 4. Secretos JWT y API

#### ❌ Hardcodeados en Código
```python
# api/app/routers/auth.py (línea 18)
SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
```

**Valor por defecto:** `your-secret-key-change-in-production`  
**Ubicaciones:**
- `api/app/routers/auth.py` (línea 18, 70, 93)
- `docker-compose.yml` (línea 25): `JWT_SECRET: your-secret-key-change-in-production`
- `.env.example` (línea 11)
- `api/README.md`

**Riesgo:** 🔴 CRÍTICO - Si se usa el valor por defecto, toda la autenticación es vulnerable  
**Recomendación:**
```bash
# Generar secreto seguro
openssl rand -hex 32
# o
python -c "import secrets; print(secrets.token_hex(32))"

# .env.production
JWT_SECRET=<64_caracteres_aleatorios_generados>
SECRET_KEY=<64_caracteres_aleatorios_generados>
```

**NOTA:** En `.env.production` existe:
```bash
SECRET_KEY=printer-fleet-secret-key-2025-imsa
```
⚠️ Este valor es predecible y debe regenerarse.

---

### 5. Credenciales Redis

#### ❌ Hardcodeadas en .env.production
```bash
# .env.production (línea 18)
REDIS_PASSWORD=admin123
```

**Riesgo:** 🔴 CRÍTICO - Password débil y predecible  
**Recomendación:**
```bash
# Generar password seguro
REDIS_PASSWORD=<GENERAR_PASSWORD_SEGURO_32_CHARS>
```

---

### 6. Comunidad SNMP por Defecto

#### ⚠️ Hardcodeada en Código
```python
# api/app/services/snmp.py (línea 15)
self.community = community or os.getenv('POLL_COMMUNITY', 'public')
```

**Valor:** `public` (comunidad SNMP estándar)  
**Riesgo:** 🟡 MEDIO - Expone información de impresoras si hay acceso a la red  
**Recomendación:**
```bash
# .env.production
POLL_COMMUNITY=<comunidad_custom_snmp>
```

---

## 🟡 MEDIO - IPs y Endpoints Hardcodeados

### 1. IP del Servidor de Producción

**IP:** `10.10.10.193`  
**Ubicaciones:**
- `deployment/update.sh` (líneas 39-41)
- `deployment/update-sudo.sh` (líneas 47-49)
- `deployment/nginx.conf` (líneas 49, 89)
- `deployment/GUIA_DESPLIEGUE_RAPIDO.md` (múltiples referencias)
- `deployment/docker-compose.prod.yml`

**Riesgo:** 🟡 MEDIO - Cambiar IP requiere modificar múltiples archivos  
**Recomendación:**
```bash
# .env.production
SERVER_IP=10.10.10.193
SERVER_HOSTNAME=printer-manager.local

# Usar variables en nginx.conf
server_name ${SERVER_IP};
```

---

### 2. IP Impresora DRYPIX

**IP:** `10.1.10.20`  
**Puerto:** `20051`  
**Ubicaciones:**
- `docs/MEDICAL_PRINTER_FLOW.md` (múltiples referencias)
- `docs/README_DRYPIX.md` (líneas 16, 50, 74, 96, 104, 203)
- `docs/REVISION_IMPRESORAS_MEDICAS.md` (líneas 1197, 1252-1253)
- `web/app/medical-printers/page.tsx` (líneas 653, 1042): Genera URLs `http://{ip}:20051`

**Riesgo:** 🟡 MEDIO - Si cambia la IP, hay que actualizar documentación  
**Estado:** ✅ El código ya usa la IP dinámica de la base de datos  
**Recomendación:** Mantener documentación actualizada

---

### 3. IPs Impresoras OKI con SNMPv3

**IPs Hardcodeadas:**
- `10.10.9.11` - OKI ES5162LP
- `10.10.9.7` - OKI ES5162LP MFP
- `10.10.9.15` - OKI

**Riesgo:** 🟡 MEDIO - Cambiadas con credenciales SNMPv3  
**Recomendación:** Externalizar junto con credenciales SNMPv3

---

### 4. URLs de API en Frontend

#### ✅ Ya Implementado Correctamente
```typescript
// Pattern usado en todos los archivos
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
```

**Archivos (20+):**
- `web/app/printing-history/page.tsx`
- `web/app/supply-requests/page.tsx`
- `web/app/stock/page.tsx`
- `web/app/settings/page.tsx`
- `web/app/printers/page.tsx`
- `web/app/medical-printers/page.tsx`
- `web/app/login/page.tsx`
- `web/app/inventory/page.tsx`
- `web/app/incidents/page.tsx`
- `web/app/exchange-rates/page.tsx`
- `web/app/counters/page.tsx`
- `web/app/contracts/page.tsx`
- `web/app/contracts/new/page.tsx`
- `web/components/UsersManagement.tsx`
- `web/components/BillingWizard.tsx`
- `web/components/OptimizedBillingWizard.tsx`
- `web/components/PartialBillingWizard.tsx`
- `web/components/IPHistoryComponent.tsx`
- `web/app/inventory/TonerHistoryTab.tsx`

**Estado:** ✅ CORRECTO - Usa variable de entorno con fallback para desarrollo  
**Riesgo:** 🟢 BAJO  
**Recomendación:** Mantener patrón actual

---

## 🟢 BAJO - Puertos y Configuraciones Estándar

### Puertos por Defecto

| Servicio | Puerto | Ubicación | Justificación |
|----------|--------|-----------|---------------|
| **PostgreSQL** | 5432 | docker-compose.yml, migrations | Puerto estándar PostgreSQL |
| **Redis** | 6379 | docker-compose.yml | Puerto estándar Redis |
| **FastAPI** | 8000 | Múltiples | Puerto estándar para desarrollo Python |
| **Next.js** | 3000 | Múltiples | Puerto estándar Next.js |
| **Nginx** | 80, 443 | deployment/nginx.conf | Puertos estándar HTTP/HTTPS |
| **DRYPIX** | 20051 | medical_printer_service.py | Puerto específico del fabricante |

**Riesgo:** 🟢 BAJO - Puertos estándares ampliamente usados  
**Recomendación:** Mantener puertos actuales (son estándares de industria)

---

## 📊 Estadísticas de Hallazgos

### Por Severidad
- 🔴 **CRÍTICO:** 6 categorías (requieren acción inmediata)
- 🟡 **MEDIO:** 4 categorías (documentar y monitorear)
- 🟢 **BAJO:** 1 categoría (aceptable)

### Por Tipo
- **Credenciales:** 15+ instancias
- **IPs:** 30+ referencias
- **URLs:** 20+ archivos (mayoría correctamente implementados)
- **Puertos:** 20+ referencias (mayoría estándares)
- **Secretos:** 3 instancias

---

## 🎯 Plan de Acción Recomendado

### Fase 1: CRÍTICO - Antes de Producción (URGENTE)

#### 1. Generar Secretos Seguros
```bash
# Ejecutar en servidor de producción
python3 << 'EOF'
import secrets
import json

config = {
    "JWT_SECRET": secrets.token_hex(32),
    "SECRET_KEY": secrets.token_hex(32),
    "POSTGRES_PASSWORD": secrets.token_urlsafe(32),
    "REDIS_PASSWORD": secrets.token_urlsafe(32),
}

print("# Agregar a .env.production:")
for key, value in config.items():
    print(f"{key}={value}")
EOF
```

#### 2. Crear Archivo de Configuración SNMPv3
```bash
# En servidor de producción
mkdir -p /opt/printer-manager/config
touch /opt/printer-manager/config/snmp_credentials.json
chmod 600 /opt/printer-manager/config/snmp_credentials.json

# Editar con credenciales reales
nano /opt/printer-manager/config/snmp_credentials.json
```

#### 3. Actualizar .env.production
```bash
# Regenerar TODAS las credenciales
nano /opt/printer-manager/.env.production

# Verificar que NO contenga:
# - postgres:postgres
# - admin123
# - your-secret-key-change-in-production
# - printer-fleet-secret-key-2025-imsa (predecible)
```

#### 4. Modificar Código para SNMPv3 y DRYPIX
```python
# api/app/services/snmp.py
def __init__(self, community: str = None):
    self.community = community or os.getenv('POLL_COMMUNITY', 'public')
    self.v3_credentials = self._load_snmpv3_credentials()

def _load_snmpv3_credentials(self):
    config_path = os.getenv('SNMP_CONFIG_PATH', '/app/config/snmp_credentials.json')
    try:
        with open(config_path) as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(f"SNMPv3 config not found: {config_path}")
        return {}

# api/app/services/medical_printer_service.py
DEFAULT_LOGIN = os.getenv("DRYPIX_LOGIN", "dryprinter")
DEFAULT_PASSWORD = os.getenv("DRYPIX_PASSWORD", "fujifilm")
```

---

### Fase 2: MEDIO - Mejoras de Configuración

#### 1. Centralizar Configuración de Servidor
```bash
# .env.production
SERVER_IP=10.10.10.193
SERVER_HOSTNAME=printer-manager.imsa.local
```

#### 2. Documentar IPs de Impresoras
Crear archivo: `config/printer_network.md` con:
- Mapa de red de impresoras
- Rangos IP por ubicación
- IPs reservadas para equipos médicos

---

### Fase 3: Validación y Testing

#### 1. Verificar que NO existan credenciales en código
```bash
# Ejecutar en desarrollo
grep -r "postgres:postgres" --exclude-dir=.git --exclude-dir=node_modules .
grep -r "admin123" --exclude-dir=.git --exclude-dir=node_modules .
grep -r "dryprinter.*fujifilm" --exclude-dir=.git --exclude-dir=node_modules .
grep -r "12345678" --exclude-dir=.git --exclude-dir=node_modules .
```

#### 2. Verificar Variables de Entorno en Producción
```bash
# En servidor de producción
docker-compose -f deployment/docker-compose.prod.yml config
# Verificar que muestre las variables correctas
```

#### 3. Test de Seguridad
- [ ] JWT_SECRET único y aleatorio
- [ ] PostgreSQL password fuerte (32+ caracteres)
- [ ] Redis password configurado
- [ ] SNMPv3 credentials externalizadas
- [ ] DRYPIX credentials externalizadas
- [ ] No hay secretos en logs

---

## 📝 Checklist de Seguridad Pre-Producción

### Credenciales
- [ ] ❌ Eliminar `postgres:postgres` del código
- [ ] ❌ Cambiar `admin123` en .env.production
- [ ] ❌ Generar JWT_SECRET aleatorio de 64 caracteres
- [ ] ❌ Generar SECRET_KEY aleatorio de 64 caracteres
- [ ] ❌ Externalizar credenciales DRYPIX
- [ ] ❌ Externalizar credenciales SNMPv3
- [ ] ❌ Cambiar comunidad SNMP de "public" a valor custom

### Configuración
- [ ] ✅ Variables de entorno en .env.production verificadas
- [ ] ❌ Archivo snmp_credentials.json creado y protegido (chmod 600)
- [ ] ❌ .env.production con permisos restrictivos (chmod 600)
- [ ] ❌ Secrets en .gitignore verificados
- [ ] ❌ docker-compose.prod.yml sin credenciales hardcodeadas

### Validación
- [ ] ❌ Grep de credenciales comunes retorna 0 resultados
- [ ] ❌ Variables de entorno cargadas en contenedores
- [ ] ❌ Logs no muestran credenciales
- [ ] ❌ Test de conexión a DB exitoso con nuevas credenciales
- [ ] ❌ Test de autenticación JWT exitoso

---

## 🔒 Recomendaciones de Seguridad Adicionales

### 1. Gestión de Secretos
**Opción A - Variables de Entorno (Actual)**
```bash
# Pros: Simple, ya implementado
# Contras: Secretos visibles en docker-compose config
```

**Opción B - Docker Secrets (Recomendado para Producción)**
```yaml
# docker-compose.prod.yml
secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt

services:
  api:
    secrets:
      - db_password
      - jwt_secret
```

**Opción C - Vault/AWS Secrets Manager (Empresarial)**
```python
# Para entornos de alta seguridad
from aws_secretsmanager import get_secret
JWT_SECRET = get_secret('printer-manager/jwt-secret')
```

### 2. Rotación de Credenciales
- **JWT_SECRET:** Cada 90 días
- **Database Password:** Cada 180 días
- **SNMPv3 Keys:** Anualmente
- **Redis Password:** Cada 180 días

### 3. Auditoría Continua
```bash
# Script de auditoría automática
#!/bin/bash
echo "🔍 Buscando credenciales expuestas..."
grep -r "password.*=.*['\"]" --include="*.py" --include="*.ts" api/ web/ || echo "✅ OK"
grep -r "secret.*=.*['\"]" --include="*.py" --include="*.ts" api/ web/ || echo "✅ OK"
```

---

## 📚 Referencias

1. **OWASP Top 10 - A02:2021 Cryptographic Failures**
   - https://owasp.org/Top10/A02_2021-Cryptographic_Failures/

2. **12 Factor App - Config**
   - https://12factor.net/config

3. **Docker Secrets Best Practices**
   - https://docs.docker.com/engine/swarm/secrets/

4. **NIST Password Guidelines**
   - https://pages.nist.gov/800-63-3/sp800-63b.html

---

## 🎓 Lecciones Aprendidas

### ❌ Malas Prácticas Encontradas
1. Credenciales de base de datos en fallback de código
2. Passwords débiles en archivos de configuración (`admin123`)
3. Secretos JWT predecibles
4. Credenciales SNMPv3 hardcodeadas con IPs específicas
5. Credenciales de equipos médicos en código fuente

### ✅ Buenas Prácticas Encontradas
1. Uso consistente de `process.env.NEXT_PUBLIC_API_BASE` en frontend
2. Patrón de fallback para desarrollo (`|| 'http://localhost:8000'`)
3. Variables de entorno documentadas en `.env.example`
4. Separación de configuración dev/prod

### 🎯 Recomendaciones para Futuros Desarrollos
1. **NUNCA** commitear credenciales reales
2. Usar `.env.example` con valores de ejemplo
3. Implementar validación de secretos en CI/CD
4. Usar herramientas como `git-secrets` o `truffleHog`
5. Revisar PRs específicamente para credenciales expuestas

---

## 📞 Contacto y Soporte

Para implementación de estas recomendaciones:
1. Revisar este documento con equipo de sistemas
2. Coordinar ventana de mantenimiento para cambio de credenciales
3. Planificar rollback en caso de problemas
4. Documentar credenciales nuevas en gestor de passwords (LastPass, 1Password, etc.)

---

**Estado del Documento:** 🔴 DRAFT - Requiere Validación  
**Próxima Revisión:** Antes del despliegue a producción  
**Responsable:** Equipo de Desarrollo + SysAdmin
