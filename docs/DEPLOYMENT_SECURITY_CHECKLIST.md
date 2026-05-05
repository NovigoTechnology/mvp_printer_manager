# Checklist de Seguridad y Despliegue - Printer Fleet Manager

**Fecha:** Diciembre 2025  
**Servidor Destino:** 10.10.10.193 (VMware Ubuntu Server)  
**Responsable:** Equipo de Desarrollo + SysAdmin

---

## 📋 Pre-Requisitos

- [ ] Acceso SSH al servidor (root@10.10.10.193)
- [ ] Docker y Docker Compose instalados en servidor
- [ ] Credenciales reales de impresora DRYPIX disponibles
- [ ] Credenciales SNMPv3 de impresoras OKI disponibles
- [ ] Ventana de mantenimiento coordinada

---

## 🔐 Fase 1: Generación de Secretos (CRÍTICO)

### 1.1 Generar Secretos Seguros

**En tu máquina local:**

```bash
cd /path/to/mvp_printer_manager
python scripts/generate_secrets.py
```

Este script generará:
- ✅ JWT_SECRET (64 caracteres hex)
- ✅ SECRET_KEY (64 caracteres hex)
- ✅ POSTGRES_PASSWORD (32 caracteres alfanuméricos)
- ✅ REDIS_PASSWORD (32 caracteres alfanuméricos)
- ✅ POLL_COMMUNITY (comunidad SNMP custom)

**Salida esperada:**
```
🔐 GENERADOR DE SECRETOS SEGUROS - Printer Fleet Manager
...
JWT_SECRET=a1b2c3d4...
SECRET_KEY=e5f6g7h8...
...
✅ Secretos también guardados en: .env.secrets.generated
```

### 1.2 Verificar Archivo Generado

```bash
# El archivo .env.secrets.generated NO debe commitearse
cat .env.secrets.generated

# Verificar que está en .gitignore
grep "secrets.generated" .gitignore
```

---

## 🚀 Fase 2: Configuración en Servidor de Producción

### 2.1 Conectar al Servidor

**Opción A - SSH Directo:**
```bash
ssh root@10.10.10.193
```

**Opción B - VS Code Remote-SSH:**
1. Abrir VS Code
2. F1 → "Remote-SSH: Connect to Host"
3. Seleccionar: `root@10.10.10.193`
4. Ingresar password cuando se solicite

### 2.2 Clonar/Actualizar Repositorio

```bash
# Si es la primera vez
cd /opt
git clone <URL_DEL_REPO> printer-manager
cd printer-manager

# Si ya existe
cd /opt/printer-manager
git pull origin main
```

### 2.3 Configurar .env.production

```bash
# Editar archivo de producción
nano .env.production
```

**Reemplazar los siguientes valores con los generados:**

```bash
# ❌ ANTES (INSEGURO)
POSTGRES_PASSWORD=admin123
REDIS_PASSWORD=admin123
SECRET_KEY=printer-fleet-secret-key-2025-imsa
JWT_SECRET=your-secret-key-change-in-production

# ✅ DESPUÉS (Copiar valores de .env.secrets.generated)
POSTGRES_PASSWORD=<VALOR_GENERADO_32_CHARS>
REDIS_PASSWORD=<VALOR_GENERADO_32_CHARS>
SECRET_KEY=<VALOR_GENERADO_HEX_64_CHARS>
JWT_SECRET=<VALOR_GENERADO_HEX_64_CHARS>
POLL_COMMUNITY=<VALOR_GENERADO_16_CHARS>
```

**Agregar configuraciones de impresoras médicas:**

```bash
# Medical Printers - DRYPIX Configuration
DRYPIX_LOGIN=<USUARIO_REAL_DRYPIX>
DRYPIX_PASSWORD=<PASSWORD_REAL_DRYPIX>

# SNMPv3 Configuration
SNMP_CONFIG_PATH=/app/config/snmp_credentials.json
```

**Guardar archivo:**
- Ctrl+O → Enter (guardar)
- Ctrl+X (salir)

### 2.4 Configurar Permisos del .env.production

```bash
# ⚠️ MUY IMPORTANTE - Permisos restrictivos
chmod 600 .env.production

# Verificar permisos
ls -la .env.production
# Debería mostrar: -rw------- 1 root root
```

---

## 🔧 Fase 3: Configuración SNMPv3

### 3.1 Crear Directorio de Configuración

```bash
mkdir -p /opt/printer-manager/api/config
chmod 700 /opt/printer-manager/api/config
```

### 3.2 Crear Archivo de Credenciales SNMPv3

```bash
nano /opt/printer-manager/api/config/snmp_credentials.json
```

**Contenido del archivo:**

```json
{
  "10.10.9.11": {
    "username": "root",
    "auth_key": "<PASSWORD_SNMPV3_REAL>",
    "priv_key": "<PASSWORD_SNMPV3_REAL>",
    "context_name": "v3context"
  },
  "10.10.9.7": {
    "username": "root",
    "auth_key": "<PASSWORD_SNMPV3_REAL>",
    "priv_key": "<PASSWORD_SNMPV3_REAL>",
    "context_name": "v3context"
  },
  "10.10.9.15": {
    "username": "root",
    "auth_key": "<PASSWORD_SNMPV3_REAL>",
    "priv_key": "<PASSWORD_SNMPV3_REAL>",
    "context_name": "v3context"
  }
}
```

**Nota:** Reemplazar `<PASSWORD_SNMPV3_REAL>` con las credenciales reales configuradas en las impresoras OKI.

### 3.3 Configurar Permisos

```bash
# ⚠️ MUY IMPORTANTE - Archivo sensible
chmod 600 /opt/printer-manager/api/config/snmp_credentials.json

# Verificar
ls -la /opt/printer-manager/api/config/
# Debería mostrar: -rw------- 1 root root ... snmp_credentials.json
```

---

## 🐳 Fase 4: Despliegue con Docker

### 4.1 Detener Contenedores Anteriores (si existen)

```bash
cd /opt/printer-manager
docker-compose -f deployment/docker-compose.prod.yml down
```

### 4.2 Construir Imágenes

```bash
docker-compose -f deployment/docker-compose.prod.yml build --no-cache
```

### 4.3 Iniciar Servicios

```bash
docker-compose -f deployment/docker-compose.prod.yml up -d
```

### 4.4 Verificar Estado

```bash
# Ver estado de contenedores
docker-compose -f deployment/docker-compose.prod.yml ps

# Debería mostrar:
# printer_fleet_db      running (healthy)
# printer_fleet_redis   running (healthy)
# printer_fleet_api     running (healthy)
# printer_fleet_web     running (healthy)
# printer_fleet_nginx   running (healthy)
```

### 4.5 Ver Logs

```bash
# Logs de todos los servicios
docker-compose -f deployment/docker-compose.prod.yml logs -f

# Logs específicos
docker-compose -f deployment/docker-compose.prod.yml logs -f api
docker-compose -f deployment/docker-compose.prod.yml logs -f web
```

---

## ✅ Fase 5: Validación y Testing

### 5.1 Test de Conectividad

```bash
# Health check del sistema
curl http://localhost/health

# Health check de API
curl http://localhost/api/health

# Desde otra máquina en la red
curl http://10.10.10.193/health
```

**Respuesta esperada:**
```json
{"status": "healthy", "timestamp": "2025-12-06T..."}
```

### 5.2 Test de Autenticación

```bash
# Test de login (usar credenciales de usuario admin)
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

**Respuesta esperada:**
```json
{"access_token": "eyJ...", "token_type": "bearer"}
```

### 5.3 Test de Base de Datos

```bash
# Verificar conexión a PostgreSQL
docker exec -it printer_fleet_db psql -U printer_admin -d printer_fleet -c "SELECT COUNT(*) FROM printers;"
```

### 5.4 Test de Redis

```bash
# Verificar Redis con password
docker exec -it printer_fleet_redis redis-cli -a <REDIS_PASSWORD> PING
# Debería retornar: PONG
```

### 5.5 Test de SNMPv3

```bash
# Ver logs de API para verificar carga de credenciales
docker-compose -f deployment/docker-compose.prod.yml logs api | grep -i "snmpv3"

# Debería mostrar:
# "Loaded SNMPv3 credentials for 3 printers from /app/config/snmp_credentials.json"
```

### 5.6 Test de DRYPIX

```bash
# Test de polling a impresora médica (reemplazar ID con ID real)
curl http://localhost/api/printers/227/poll

# Verificar en logs que usa credenciales correctas
docker-compose -f deployment/docker-compose.prod.yml logs api | grep -i "drypix"
```

---

## 🔍 Fase 6: Auditoría de Seguridad

### 6.1 Verificar que NO hay Credenciales en Logs

```bash
# Buscar credenciales expuestas en logs
docker-compose -f deployment/docker-compose.prod.yml logs | grep -i "postgres:postgres"
docker-compose -f deployment/docker-compose.prod.yml logs | grep -i "admin123"
docker-compose -f deployment/docker-compose.prod.yml logs | grep -i "12345678"

# ✅ No debería encontrar resultados
```

### 6.2 Verificar Variables de Entorno

```bash
# Ver configuración compilada (OCULTA SECRETOS)
docker-compose -f deployment/docker-compose.prod.yml config

# Verificar variables en contenedor API
docker exec printer_fleet_api env | grep -E "(JWT_SECRET|POSTGRES_PASSWORD|REDIS_PASSWORD|DRYPIX)"
```

**⚠️ IMPORTANTE:** Si los valores muestran credenciales débiles (admin123, postgres, etc.), DETENER y revisar configuración.

### 6.3 Verificar Permisos de Archivos

```bash
# Verificar permisos restrictivos
ls -la /opt/printer-manager/.env.production
ls -la /opt/printer-manager/api/config/snmp_credentials.json

# Ambos deben mostrar:
# -rw------- 1 root root
```

### 6.4 Verificar .gitignore

```bash
# Verificar que archivos sensibles están en .gitignore
cat .gitignore | grep -E "(snmp_credentials.json|.env.production|secrets.generated)"

# ✅ Debería encontrar estas entradas
```

---

## 📊 Fase 7: Monitoreo Post-Despliegue

### 7.1 Configurar Monitoreo de Logs

```bash
# Crear script de monitoreo
cat > /opt/printer-manager/monitor.sh << 'EOF'
#!/bin/bash
echo "📊 Printer Fleet Manager - Estado del Sistema"
echo "=============================================="
echo ""
echo "🐳 Estado de Contenedores:"
docker-compose -f deployment/docker-compose.prod.yml ps
echo ""
echo "💾 Uso de Recursos:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""
echo "📝 Últimos Logs (últimas 20 líneas):"
docker-compose -f deployment/docker-compose.prod.yml logs --tail=20
EOF

chmod +x /opt/printer-manager/monitor.sh
```

### 7.2 Ejecutar Monitoreo

```bash
/opt/printer-manager/monitor.sh
```

### 7.3 Verificar Health Checks

```bash
# Ver estado de health checks
docker inspect printer_fleet_api | grep -A 10 "Health"
docker inspect printer_fleet_db | grep -A 10 "Health"
```

---

## 🚨 Troubleshooting

### Problema: Contenedor API no inicia

**Solución:**
```bash
# Ver logs detallados
docker-compose -f deployment/docker-compose.prod.yml logs api

# Verificar variables de entorno
docker-compose -f deployment/docker-compose.prod.yml config | grep -A 20 "api:"

# Reintentar
docker-compose -f deployment/docker-compose.prod.yml restart api
```

### Problema: No puede conectar a PostgreSQL

**Solución:**
```bash
# Verificar que DB está corriendo
docker-compose -f deployment/docker-compose.prod.yml ps db

# Verificar DATABASE_URL en .env.production
cat .env.production | grep DATABASE_URL

# Conectar manualmente para probar credenciales
docker exec -it printer_fleet_db psql -U printer_admin -d printer_fleet
```

### Problema: SNMPv3 no funciona

**Solución:**
```bash
# Verificar que archivo existe
ls -la /opt/printer-manager/api/config/snmp_credentials.json

# Verificar sintaxis JSON
cat /opt/printer-manager/api/config/snmp_credentials.json | python -m json.tool

# Ver logs de carga de credenciales
docker-compose -f deployment/docker-compose.prod.yml logs api | grep -i snmp
```

### Problema: Error "Permission Denied" en archivos de configuración

**Solución:**
```bash
# Verificar permisos
ls -la /opt/printer-manager/api/config/

# Ajustar permisos si es necesario
chmod 600 /opt/printer-manager/api/config/snmp_credentials.json
chmod 600 /opt/printer-manager/.env.production

# Reiniciar contenedores
docker-compose -f deployment/docker-compose.prod.yml restart
```

---

## 📝 Checklist Final de Seguridad

### Credenciales
- [ ] ✅ JWT_SECRET generado con 64 caracteres aleatorios
- [ ] ✅ SECRET_KEY generado con 64 caracteres aleatorios
- [ ] ✅ POSTGRES_PASSWORD cambiado (NO es "admin123")
- [ ] ✅ REDIS_PASSWORD cambiado (NO es "admin123")
- [ ] ✅ POLL_COMMUNITY cambiado (NO es "public")
- [ ] ✅ DRYPIX_LOGIN y DRYPIX_PASSWORD configurados con valores reales
- [ ] ✅ Credenciales SNMPv3 configuradas en snmp_credentials.json

### Archivos y Permisos
- [ ] ✅ .env.production tiene chmod 600
- [ ] ✅ snmp_credentials.json tiene chmod 600
- [ ] ✅ .env.production NO está en Git
- [ ] ✅ snmp_credentials.json NO está en Git
- [ ] ✅ .env.secrets.generated NO está en Git

### Servicios
- [ ] ✅ Todos los contenedores están "healthy"
- [ ] ✅ API responde en /health
- [ ] ✅ Web UI accesible desde navegador
- [ ] ✅ Login funciona correctamente
- [ ] ✅ Base de datos conecta correctamente
- [ ] ✅ Redis conecta con password

### Testing
- [ ] ✅ SNMPv3 carga credenciales correctamente (ver logs)
- [ ] ✅ DRYPIX puede autenticarse (test de polling)
- [ ] ✅ No hay credenciales débiles en logs
- [ ] ✅ Variables de entorno correctamente cargadas

### Documentación
- [ ] ✅ Credenciales documentadas en gestor de passwords (LastPass, 1Password, etc.)
- [ ] ✅ Equipo de sistemas notificado del despliegue
- [ ] ✅ Plan de rollback documentado
- [ ] ✅ Contacto de emergencia disponible

---

## 🔄 Plan de Rollback

Si algo falla durante el despliegue:

```bash
# 1. Detener servicios nuevos
docker-compose -f deployment/docker-compose.prod.yml down

# 2. Restaurar .env.production anterior (si existe backup)
cp .env.production.backup .env.production

# 3. Iniciar versión anterior
docker-compose -f deployment/docker-compose.prod.yml up -d

# 4. Verificar
curl http://localhost/health
```

---

## 📞 Contacto y Soporte

**En caso de problemas:**
1. Revisar logs: `docker-compose logs -f`
2. Consultar documentación: `docs/AUDITORIA_HARDCODED_VALUES.md`
3. Contactar equipo de desarrollo

**Responsables:**
- **Desarrollo:** [Nombre]
- **SysAdmin:** [Nombre]
- **Emergencias:** [Teléfono/Email]

---

**Última Actualización:** Diciembre 2025  
**Versión del Checklist:** 1.0  
**Estado:** ✅ Listo para Producción
