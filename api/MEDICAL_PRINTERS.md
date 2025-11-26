# Módulo de Impresoras Médicas

## Descripción General

Este módulo permite integrar impresoras médicas (DRYPIX, CR, FCR) al sistema de gestión de impresoras. Las impresoras médicas no soportan SNMP estándar, por lo que utilizan **web scraping** para obtener contadores y estado.

## Arquitectura

```
api/
├── app/
│   ├── services/
│   │   ├── snmp.py                      # Servicio SNMP para impresoras estándar
│   │   └── medical_printer_service.py   # Servicio para impresoras médicas
│   └── routers/
│       └── printers.py                  # Endpoints unificados
```

## Servicios

### `MedicalPrinterService`

Servicio principal que detecta y maneja diferentes tipos de impresoras médicas.

**Métodos:**
- `poll_printer(printer: Printer) -> Dict`: Obtiene datos de la impresora según su modelo

### `DrypixScraper`

Web scraper específico para impresoras DRYPIX SMART de Fujifilm.

**Características:**
- Autenticación en modo mantenimiento
- Extracción de contadores de 5 bandejas
- Cálculo de films disponibles vs impresos
- Manejo de errores y timeouts

**Configuración:**
```python
DEFAULT_LOGIN = "dryprinter"
DEFAULT_PASSWORD = "fujifilm"
TRAY_CAPACITY = 100  # Films por bandeja
```

## Endpoints API

### 1. Poll de Impresora (Unificado)

**POST** `/printers/{printer_id}/poll`

Hace polling de cualquier impresora (médica o estándar). Detecta automáticamente el tipo.

**Respuesta para impresora médica:**
```json
{
  "message": "Medical printer polled successfully",
  "printer_type": "medical",
  "data": {
    "timestamp": "2025-11-20T19:12:09.430811",
    "tray_capacity": 100,
    "trays": {
      "Tray1": {
        "available": 99,
        "printed": 1
      },
      "Tray2": {
        "available": 0,
        "printed": 0
      }
    },
    "summary": {
      "total_available": 99,
      "total_printed": 1,
      "total_trays_loaded": 1
    },
    "status": "online"
  }
}
```

### 2. Estado de Impresora (Unificado)

**GET** `/printers/{printer_id}/status`

Obtiene el último estado registrado. Formato adaptado según tipo de impresora.

**Respuesta para impresora médica:**
```json
{
  "printer_id": 227,
  "printer_type": "medical",
  "model": "DRYPIX SMART",
  "status": "online",
  "last_update": "2025-11-20T19:12:09",
  "films_available": 99,
  "films_printed": 1,
  "message": "Medical printer - films data"
}
```

**Respuesta para impresora estándar:**
```json
{
  "printer_id": 1,
  "printer_type": "standard",
  "model": "HP LaserJet",
  "status": "online",
  "last_update": "2025-11-20T19:00:00",
  "toner_levels": {
    "black": 75,
    "cyan": 80,
    "magenta": 70,
    "yellow": 85
  },
  "paper_level": 500,
  "pages_printed": {
    "mono": 1500,
    "color": 300
  }
}
```

### 3. Detalles de Impresora Médica

**GET** `/printers/{printer_id}/medical-details`

Endpoint específico para obtener detalles en tiempo real de impresoras médicas.

**Respuesta:**
```json
{
  "printer_id": 227,
  "model": "DRYPIX SMART",
  "ip_address": "10.1.10.20",
  "timestamp": "2025-11-20T19:12:09.430811",
  "tray_capacity": 100,
  "trays": {
    "Tray1": {
      "available": 99,
      "printed": 1
    },
    "Tray2": {"available": 0, "printed": 0},
    "Tray3": {"available": 0, "printed": 0},
    "Tray4": {"available": 0, "printed": 0},
    "Tray5": {"available": 0, "printed": 0}
  },
  "summary": {
    "total_available": 99,
    "total_printed": 1,
    "total_trays_loaded": 1
  },
  "status": "online"
}
```

## Detección Automática

El sistema detecta automáticamente si una impresora es médica usando la función `is_medical_printer()`:

```python
def is_medical_printer(printer: Printer) -> bool:
    """Detecta si una impresora es médica por su modelo"""
    if not printer.model:
        return False
    
    model = printer.model.upper()
    medical_models = ["DRYPIX", "FCR", "CR", "DI-HL"]
    
    return any(medical_model in model for medical_model in medical_models)
```

**Modelos soportados:**
- `DRYPIX SMART` - Impresora de placas radiográficas Fujifilm
- `FCR` - Computed Radiography Fujifilm
- `CR` - Computed Radiography genérico
- `DI-HL` - Dry Imager High Luminance

## Almacenamiento en Base de Datos

Los datos de impresoras médicas se almacenan en `UsageReport` con adaptaciones:

| Campo DB | Impresora Médica | Impresora Estándar |
|----------|------------------|-------------------|
| `pages_printed_mono` | Films impresos | Páginas B/N |
| `pages_printed_color` | 0 (no aplica) | Páginas color |
| `paper_level` | Films disponibles | Nivel de papel |
| `toner_level_*` | NULL (no aplica) | Nivel de tóner |
| `status` | online/offline | Estado SNMP |

## Uso desde el Frontend

### Ejemplo: Mostrar estado de impresora

```javascript
// Obtener estado (funciona para médicas y estándar)
const response = await fetch(`/api/printers/${printerId}/status`);
const status = await response.json();

if (status.printer_type === 'medical') {
  console.log(`Films disponibles: ${status.films_available}`);
  console.log(`Films impresos: ${status.films_printed}`);
} else {
  console.log(`Páginas impresas: ${status.pages_printed.mono}`);
  console.log(`Nivel tóner: ${status.toner_levels.black}%`);
}
```

### Ejemplo: Polling manual

```javascript
// Forzar actualización de datos
const response = await fetch(`/api/printers/${printerId}/poll`, {
  method: 'POST'
});
const result = await response.json();

console.log(result.message); // "Medical printer polled successfully"
console.log(result.data.summary.total_printed); // Films impresos
```

### Ejemplo: Detalles de bandejas

```javascript
// Solo para impresoras médicas
const response = await fetch(`/api/printers/${printerId}/medical-details`);
const details = await response.json();

details.trays.forEach((tray, name) => {
  console.log(`${name}: ${tray.available} disponibles, ${tray.printed} impresos`);
});
```

## Agregar Nuevos Tipos de Impresoras Médicas

### 1. Crear scraper específico

```python
# En medical_printer_service.py

class NewMedicalScraper:
    """Scraper para [Modelo de Impresora]"""
    
    def __init__(self, ip_address: str, port: int = 80):
        self.base_url = f"http://{ip_address}:{port}"
        self.session = requests.Session()
    
    def authenticate(self) -> bool:
        # Implementar autenticación si es necesaria
        pass
    
    def get_counters(self) -> Optional[Dict]:
        # Implementar extracción de datos
        pass
```

### 2. Registrar en `MedicalPrinterService`

```python
def poll_printer(self, printer: Printer) -> Optional[Dict]:
    model = printer.model.upper() if printer.model else ""
    
    if "DRYPIX" in model:
        return self._poll_drypix(printer)
    elif "NUEVAIMPRESORA" in model:  # <-- Agregar aquí
        scraper = NewMedicalScraper(printer.ip_address, printer.port or 80)
        return scraper.get_counters()
    else:
        return None
```

### 3. Actualizar detección

```python
def is_medical_printer(printer: Printer) -> bool:
    model = printer.model.upper()
    medical_models = ["DRYPIX", "FCR", "CR", "DI-HL", "NUEVAIMPRESORA"]  # <-- Agregar
    return any(medical_model in model for medical_model in medical_models)
```

## Consideraciones de Seguridad

⚠️ **Credenciales hardcodeadas**: Las credenciales de mantenimiento están en el código. Para producción:
- Usar variables de entorno
- Encriptar credenciales en la BD
- Implementar rotación de credenciales

**Ejemplo seguro:**
```python
import os
from cryptography.fernet import Fernet

DEFAULT_LOGIN = os.getenv('DRYPIX_LOGIN', 'dryprinter')
DEFAULT_PASSWORD = os.getenv('DRYPIX_PASSWORD', 'fujifilm')
```

## Troubleshooting

### Error: "Failed to poll medical printer"
- Verificar conectividad de red: `ping 10.1.10.20`
- Verificar puerto abierto: `telnet 10.1.10.20 20051`
- Verificar credenciales en `medical_printer_service.py`

### Error: "This endpoint is only for medical printers"
- Verificar que `printer.model` contiene "DRYPIX", "FCR", etc.
- Actualizar modelo en la BD: `UPDATE printers SET model='DRYPIX SMART' WHERE id=227`

### Datos en cero
- Verificar que las bandejas tengan films cargados
- Los contadores muestran **disponibles**, no impresos
- Si disponibles = 0, la bandeja está vacía (no cargada o totalmente usada)

## Tests

### Test manual con curl

```bash
# Poll de impresora médica
curl -X POST http://localhost:8000/api/printers/227/poll

# Estado
curl http://localhost:8000/api/printers/227/status

# Detalles médicos
curl http://localhost:8000/api/printers/227/medical-details
```

### Test automatizado (pytest)

```python
def test_medical_printer_poll():
    response = client.post("/api/printers/227/poll")
    assert response.status_code == 200
    data = response.json()
    assert data["printer_type"] == "medical"
    assert "trays" in data["data"]
```

## Roadmap

- [ ] Soporte para FCR/CR (Computed Radiography)
- [ ] Caché de credenciales por modelo
- [ ] Polling automático programado
- [ ] Alertas cuando films < 10%
- [ ] Dashboard específico para impresoras médicas
- [ ] Exportar histórico de uso de films
- [ ] Multi-idioma en web scraping (JP, EN, ES)

## Autor

Sistema desarrollado para integrar equipamiento médico al sistema de gestión de impresoras.
