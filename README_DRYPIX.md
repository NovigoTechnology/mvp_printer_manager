# DRYPIX SMART - Extracción Automática de Contadores

## Descripción

El DRYPIX SMART es una impresora médica de placas radiográficas (films) fabricada por Fujifilm. A diferencia de las impresoras de oficina, **NO soporta SNMP** ya que es un dispositivo médico que utiliza el protocolo DICOM.

Para obtener los contadores de uso (cantidad de films impresos por bandeja), se desarrolló un sistema de web scraping que se autentica en el modo de mantenimiento y extrae los datos de la interfaz web.

## Información del Equipo

- **Marca**: Fuji
- **Modelo**: DRYPIX SMART
- **Número de Serie**: 17155942
- **S/N Scanner**: Y078808
- **Versión Software**: V10.9
- **IP**: 10.1.10.20
- **Puerto Web**: 20051
- **Protocolo**: HTTP (no HTTPS)

### Protocolo DICOM
- **Puerto**: 5040
- **AE Title**: AEP01
- **Fine-PRT**: DRYPIXHIGH

## Credenciales de Acceso

- **Usuario**: `dryprinter`
- **Contraseña**: `fujifilm`
- **Idioma**: `en` (inglés) o `jp` (japonés)

## Script de Extracción Automática

### `get_counters.py`

Este script obtiene automáticamente los contadores de uso de las 5 bandejas del DRYPIX SMART.

#### Uso

```bash
python get_counters.py
```

#### Salida

```
================================================================================
DRYPIX SMART - Extracción Automática de Contadores
================================================================================

Impresora: http://10.1.10.20:20051
Usuario: dryprinter

Obteniendo contadores...

✓ Contadores obtenidos exitosamente:

  Tray1:     99 films
  Tray2:      0 films
  Tray3:      0 films
  Tray4:      0 films
  Tray5:      0 films
  ────────────────────
  Total:      99 films

✓ Contadores guardados en: drypix_counters.json
```

#### Archivo JSON Generado

El script genera `drypix_counters.json` con el siguiente formato:

```json
{
  "printer_ip": "10.1.10.20",
  "printer_port": 20051,
  "model": "DRYPIX SMART",
  "timestamp": "2025-11-20T15:30:45.123456",
  "counters": {
    "Tray1": 99,
    "Tray2": 0,
    "Tray3": 0,
    "Tray4": 0,
    "Tray5": 0
  },
  "total_films": 99
}
```

## Funcionamiento Técnico

### 1. Autenticación

El script hace login en el modo de mantenimiento mediante una petición GET:

```
http://10.1.10.20:20051/USER/chkin=dryprinter&passwd=fujifilm&Language=en
```

### 2. Acceso a Setting2

Los contadores se encuentran en la página "Setting2" (settingMode=5):

```
http://10.1.10.20:20051/SETTING/?settingMode=5
```

### 3. Extracción de Datos

El HTML contiene una tabla con los contadores:

```html
<B>Check Counters</B>
<TABLE WIDTH="150" BORDER="1">
  <TR>
    <TD>Tray1</TD>
    <TD ALIGN="RIGHT">99</TD>
  </TR>
  <TR>
    <TD>Tray2</TD>
    <TD ALIGN="RIGHT">0</TD>
  </TR>
  ...
</TABLE>
```

El script usa **BeautifulSoup** para parsear la tabla o **regex** como método alternativo.

## Integración con el Sistema Principal

### Estructura del Proyecto

```
mvp_printer_manager/
├── get_counters.py          # Script principal de extracción
├── drypix_counters.json     # Resultado de la última ejecución
├── README_DRYPIX.md         # Esta documentación
└── api/
    └── app/
        └── services/
            └── drypix_scraper.py  # (A crear) Servicio para integrar al backend
```

### Próximos Pasos para Integración

1. **Crear servicio en el backend** (`api/app/services/drypix_scraper.py`):
   - Importar la función `get_drypix_counters()` de `get_counters.py`
   - Crear endpoint en FastAPI para obtener contadores
   - Almacenar histórico en la base de datos

2. **Modificar el polling automático**:
   - Detectar el tipo de impresora (SNMP vs Web Scraping)
   - Para DRYPIX (ID 227), usar web scraping en lugar de SNMP
   - Ejecutar cada hora o según configuración

3. **Frontend - Dashboard**:
   - Mostrar contadores por bandeja
   - Gráfico de uso histórico
   - Alertas cuando las bandejas estén bajas

## Dependencias

```bash
pip install requests beautifulsoup4
```

## Notas Importantes

⚠️ **Este equipo NO soporta SNMP** - Es un dispositivo médico especializado

✓ **Web scraping es la única opción** - La interfaz web es estable

📊 **Contadores por bandeja** - El DRYPIX tiene 5 bandejas para diferentes tamaños de film

🔒 **Modo mantenimiento** - Requiere credenciales especiales (proporcionadas por el fabricante)

## Diferencias con Impresoras de Oficina

| Característica | Impresoras Oficina (HP/OKI) | DRYPIX SMART |
|----------------|----------------------------|--------------|
| Protocolo      | SNMP (puerto 161)          | DICOM (puerto 5040) |
| Monitoreo      | SNMP OIDs estándar         | Web scraping |
| Tipo de uso    | Páginas impresas           | Films expuestos |
| Consumibles    | Toner/Tinta                | Film radiográfico |
| Acceso         | Público (SNMP community)   | Login requerido |

## Troubleshooting

### Error: "ModuleNotFoundError: No module named 'bs4'"
```bash
pip install beautifulsoup4
```

### Error: "Error en login: Status 401"
Verificar credenciales en las constantes del script:
```python
LOGIN = "dryprinter"
PASSWORD = "fujifilm"
```

### Error: "No se pudo encontrar la sección Check Counters"
La estructura HTML puede haber cambiado. Verificar manualmente accediendo a:
```
http://10.1.10.20:20051/USER/chkin=dryprinter&passwd=fujifilm&Language=en
```

### Los contadores están en cero pero se ha usado el equipo
Verificar que se esté accediendo a la bandeja correcta (Tray1-Tray5) y que los contadores no hayan sido reseteados.

## Autor

Desarrollado como parte del sistema Printer Fleet Manager para monitoreo de equipos médicos y de oficina.

## Licencia

Uso interno - Hospital/Clínica
