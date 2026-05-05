# Configuración de Credenciales SNMPv3

Este directorio contiene configuraciones sensibles para autenticación SNMPv3 con impresoras.

## 📁 Archivos

- **`snmp_credentials.json`** - Credenciales SNMPv3 reales (NO commitear)
- **`snmp_credentials.json.example`** - Plantilla de ejemplo

## 🔒 Seguridad

### ⚠️ IMPORTANTE

1. **NUNCA** commitear `snmp_credentials.json` a Git
2. El archivo debe tener permisos restrictivos: `chmod 600`
3. Solo el usuario que ejecuta el servicio debe tener acceso

### Verificación

```bash
# Verificar que el archivo real NO está en Git
git status api/config/snmp_credentials.json
# Debería mostrar: "Untracked files" o no aparecer

# Verificar permisos
ls -la api/config/snmp_credentials.json
# Debería mostrar: -rw------- (600)
```

## 🚀 Uso en Desarrollo

### 1. Copiar Plantilla

```bash
cp api/config/snmp_credentials.json.example api/config/snmp_credentials.json
```

### 2. Editar con Credenciales Reales

```bash
nano api/config/snmp_credentials.json
```

**Estructura del archivo:**

```json
{
  "IP_IMPRESORA": {
    "username": "usuario_snmpv3",
    "auth_key": "password_autenticacion",
    "priv_key": "password_privacidad",
    "context_name": "v3context"
  }
}
```

### 3. Configurar Permisos

```bash
chmod 600 api/config/snmp_credentials.json
```

### 4. Configurar Variable de Entorno

```bash
# En .env o .env.production
SNMP_CONFIG_PATH=/app/config/snmp_credentials.json
```

## 📝 Ejemplo Completo

```json
{
  "10.10.9.11": {
    "username": "admin_snmp",
    "auth_key": "Mi_Password_Seguro_Auth_12345",
    "priv_key": "Mi_Password_Seguro_Priv_67890",
    "context_name": "v3context",
    "_note": "OKI ES5162LP - Radiología"
  },
  "10.10.9.7": {
    "username": "admin_snmp",
    "auth_key": "Otro_Password_Diferente_ABC",
    "priv_key": "Otro_Password_Diferente_XYZ",
    "context_name": "v3context",
    "_note": "OKI MFP - Administración"
  }
}
```

**Notas:**
- El campo `_note` es opcional y se ignora por el código
- Usa `auth_key` y `priv_key` diferentes para mayor seguridad
- Asegúrate que coincidan con la configuración de la impresora

## 🐳 Uso en Docker

El archivo debe montarse como volumen en docker-compose:

```yaml
services:
  api:
    volumes:
      - ./api/config:/app/config:ro  # Read-only
    environment:
      - SNMP_CONFIG_PATH=/app/config/snmp_credentials.json
```

## 🔍 Troubleshooting

### Error: "SNMPv3 config file not found"

**Causa:** El archivo no existe o la ruta es incorrecta

**Solución:**
```bash
# Verificar que existe
ls -la api/config/snmp_credentials.json

# Verificar variable de entorno
echo $SNMP_CONFIG_PATH

# En Docker
docker exec printer_fleet_api ls -la /app/config/snmp_credentials.json
```

### Error: "Error parsing SNMPv3 config file"

**Causa:** JSON inválido

**Solución:**
```bash
# Validar JSON
cat api/config/snmp_credentials.json | python -m json.tool

# o con jq
cat api/config/snmp_credentials.json | jq .
```

### Warning: "SNMPv3 will not be available"

**Causa:** Archivo no encontrado, pero no es crítico

**Impacto:** Las impresoras con SNMPv2c seguirán funcionando, solo SNMPv3 no estará disponible

**Solución:** Crear el archivo si necesitas SNMPv3

## 📚 Referencias

- [Documentación SNMPv3](https://en.wikipedia.org/wiki/Simple_Network_Management_Protocol#Version_3)
- [Auditoría de Seguridad](../docs/AUDITORIA_HARDCODED_VALUES.md)
- [Checklist de Despliegue](../docs/DEPLOYMENT_SECURITY_CHECKLIST.md)

---

**Última Actualización:** Diciembre 2025  
**Mantenido por:** Equipo de Desarrollo
