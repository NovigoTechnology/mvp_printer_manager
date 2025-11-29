# Implementación de Descubrimiento Web-Based para Impresoras Médicas

## Resumen de Cambios

Se ha implementado la funcionalidad de descubrimiento automático de impresoras médicas (DRYPIX, FCR, CR) mediante escaneo web en el puerto 20051, integrándolo con el sistema de descubrimiento existente.

## Archivos Modificados

### 1. Backend - Servicio de Impresoras Médicas
**Archivo**: `api/app/services/medical_printer_service.py`

#### Nuevos Métodos:

##### `MedicalPrinterService.discover_medical_printer(ip, port, timeout)`
Descubre una impresora médica individual en la IP especificada.

```python
@staticmethod
def discover_medical_printer(ip: str, port: int = 20051, timeout: int = 3) -> Optional[Dict]:
    """
    Intenta descubrir una impresora médica en la IP especificada
    
    Returns:
        Dict con información de la impresora si se detecta, None si no
    """
```

**Funcionalidad**:
- Intenta acceder a `/USER/Login.htm` en el puerto especificado
- Detecta interfaces DRYPIX buscando "DRYPIX" o "FUJIFILM" en el HTML
- Intenta autenticación para obtener información de contadores
- Detecta otros tipos (FCR, CR) si se encuentran en el HTML
- Maneja timeouts y errores de conexión silenciosamente

**Retorna**:
```json
{
  "ip": "10.1.10.20",
  "port": 20051,
  "type": "medical",
  "model": "FUJI DRYPIX SMART",
  "brand": "FUJIFILM",
  "is_medical": true,
  "connection_method": "web_interface",
  "status": "online",
  "trays_info": {...},
  "authenticated": true
}
```

##### `MedicalPrinterService.discover_medical_printers_in_range(ip_range, port, timeout, max_workers)`
Escanea un rango completo de IPs en busca de impresoras médicas.

```python
@staticmethod
def discover_medical_printers_in_range(
    ip_range: str,
    port: int = 20051,
    timeout: int = 2,
    max_workers: int = 50
) -> List[Dict]:
    """
    Escanea un rango de IPs buscando impresoras médicas
    
    Args:
        ip_range: "10.1.10.0/24" o "10.1.10.1-10.1.10.50"
        port: Puerto a escanear (default: 20051)
        timeout: Timeout por IP en segundos
        max_workers: Número de workers paralelos
    """
```

**Funcionalidad**:
- Parsea rangos CIDR o rangos de IPs
- Escaneo paralelo con ThreadPoolExecutor
- Logging detallado del progreso
- Retorna lista de impresoras médicas encontradas

---

### 2. Backend - Router de Impresoras
**Archivo**: `api/app/routers/printers.py`

#### Modificaciones en Modelos:

##### `DiscoveredDevice` (BaseModel)
Agregados nuevos campos:
```python
is_medical: bool = False  # Bandera para impresoras médicas
connection_method: Optional[str] = None  # "snmp", "web_interface", "combined"
port: Optional[int] = None  # Puerto de conexión
```

##### `DiscoveryRequest` (BaseModel)
Agregados nuevos parámetros:
```python
include_medical: bool = True  # Si debe buscar impresoras médicas
medical_port: int = 20051  # Puerto para escaneo médico
```

#### Modificaciones en Funciones:

##### `discover_single_device(ip, timeout, include_medical, medical_port)`
**Cambio Principal**: Prioriza descubrimiento de impresoras médicas antes de SNMP

```python
def discover_single_device(
    ip: str, 
    timeout: int = 3, 
    include_medical: bool = True, 
    medical_port: int = 20051
) -> DiscoveredDevice:
```

**Flujo de Descubrimiento**:
1. **Ping ICMP** - Verificar respuesta básica
2. **PRIORIDAD 1: Impresoras Médicas** (si `include_medical=True`)
   - Intentar `MedicalPrinterService.discover_medical_printer()`
   - Si detecta DRYPIX/FCR/CR → retornar inmediatamente
3. **PRIORIDAD 2: SNMP** (si no es médica)
   - Verificar conexión SNMP
   - Obtener información combinada SNMP+HTTP

**Ventaja**: Evita falsos negativos al intentar SNMP en equipos médicos.

##### `discover_printers(request: DiscoveryRequest)`
**Modificaciones**:
- Pasa parámetros `include_medical` y `medical_port` a `discover_single_device()`
- Logging mejorado mostrando tipo de descubrimiento
- Estadísticas separadas de impresoras SNMP vs Médicas

```python
# Estadísticas de descubrimiento
total_discovered = len([d for d in discovered_devices if d.is_printer])
medical_discovered = len([d for d in discovered_devices if d.is_medical])
snmp_discovered = total_discovered - medical_discovered

print(f"✅ Descubrimiento completado:")
print(f"   📊 Total dispositivos: {len(discovered_devices)}")
print(f"   🖨️  Impresoras encontradas: {total_discovered}")
print(f"   🏥 Impresoras médicas: {medical_discovered}")
print(f"   📡 Impresoras SNMP: {snmp_discovered}")
```

#### Nuevo Endpoint:

##### `POST /api/printers/discover/medical`
Endpoint especializado para descubrimiento exclusivo de impresoras médicas.

```python
@router.post("/discover/medical", response_model=List[DiscoveredDevice])
def discover_medical_printers(
    ip_range: str,
    port: int = 20051,
    timeout: int = 2,
    max_workers: int = 50,
    db: Session = Depends(get_db)
):
    """
    Descubre SOLO impresoras médicas (DRYPIX, FCR, CR, etc.)
    
    Especializado para descubrimiento de impresoras que no soportan SNMP
    """
```

**Uso**:
```bash
curl -X POST "http://localhost:8000/api/printers/discover/medical?ip_range=10.1.10.0/24&port=20051&timeout=2&max_workers=50"
```

**Respuesta**:
```json
[
  {
    "ip": "10.1.10.20",
    "brand": "FUJIFILM",
    "model": "FUJI DRYPIX SMART",
    "is_printer": true,
    "is_medical": true,
    "connection_method": "web_interface",
    "port": 20051,
    "device_info": {
      "type": "medical",
      "status": "online",
      "authenticated": true,
      "trays_info": {
        "total_available": 255,
        "total_printed": 145,
        "total_trays_loaded": 4
      }
    }
  }
]
```

---

### 3. Frontend - Página de Impresoras
**Archivo**: `web/app/printers/page.tsx`

#### Modificaciones en Interfaces:

##### `DiscoveredDevice`
```typescript
interface DiscoveredDevice {
  // ... campos existentes
  is_medical?: boolean  // Nueva propiedad
  connection_method?: string  // "snmp", "web_interface", "combined"
  port?: number  // Puerto de conexión
}
```

##### `DiscoveryRequest`
```typescript
interface DiscoveryRequest {
  // ... campos existentes
  include_medical?: boolean  // Incluir búsqueda de médicas
  medical_port?: number  // Puerto para descubrimiento médico
}
```

#### Modificaciones en Estado:

##### `discoverySettings`
```typescript
const [discoverySettings, setDiscoverySettings] = useState({
  timeout: 5,
  max_workers: 10,
  include_medical: true,  // ✅ Habilitado por defecto
  medical_port: 20051     // Puerto DRYPIX por defecto
})
```

#### Modificaciones en UI:

##### Panel de Controles de Descubrimiento
Agregados nuevos controles:

```tsx
{/* Checkbox para incluir impresoras médicas */}
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-2">
    <input
      type="checkbox"
      checked={discoverySettings.include_medical}
      onChange={(e) => setDiscoverySettings(prev => ({ 
        ...prev, 
        include_medical: e.target.checked 
      }))}
      className="mr-2"
    />
    Incluir Médicas
  </label>
  <p className="text-xs text-gray-500 mt-1">DRYPIX, FCR, CR</p>
</div>

{/* Input condicional para puerto médico */}
{discoverySettings.include_medical && (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      Puerto Médico
    </label>
    <input
      type="number"
      value={discoverySettings.medical_port}
      onChange={(e) => setDiscoverySettings(prev => ({ 
        ...prev, 
        medical_port: parseInt(e.target.value) 
      }))}
      className="w-24 px-3 py-2 border border-gray-300 rounded-md"
      min="1"
      max="65535"
    />
  </div>
)}
```

##### Tabla de Resultados
Mejoras visuales para impresoras médicas:

```tsx
const isMedical = device.is_medical || false

// Row highlighting
<tr className={`${
  isExisting ? 'bg-yellow-50' : 
  isMedical ? 'bg-green-50' :  // ✅ Fondo verde para médicas
  'hover:bg-gray-50'
}`}>

// Badge de tipo
<span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
  isExisting 
    ? 'bg-yellow-100 text-yellow-800' 
    : isMedical
    ? 'bg-green-100 text-green-800'  // ✅ Verde para médicas
    : 'bg-blue-100 text-blue-800'
}`}>
  {isExisting ? 'Ya agregada' : isMedical ? '🏥 Médica' : 'Nueva'}
</span>

// Indicador de conexión
{isMedical ? (
  <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
    🌐 Web OK
  </span>
) : (
  <span className={`... ${snmpOk ? 'bg-blue-100' : 'bg-gray-100'}`}>
    📡 {snmpOk ? 'SNMP OK' : 'Sin SNMP'}
  </span>
)}

// Mostrar puerto si no es estándar
{device.port && device.port !== 161 && (
  <div className="text-xs text-gray-500">Puerto: {device.port}</div>
)}
```

#### Modificaciones en Request:

##### Función `startDiscovery`
```typescript
const request: DiscoveryRequest = {
  ip_list: responsiveIPsInRange,
  timeout: discoverySettings.timeout,
  max_workers: discoverySettings.max_workers,
  include_medical: discoverySettings.include_medical,  // ✅ Nuevo
  medical_port: discoverySettings.medical_port         // ✅ Nuevo
}
```

---

## Flujo de Descubrimiento Completo

### Modo Híbrido (SNMP + Médicas) - DEFAULT

```
1. Usuario configura:
   ✅ Incluir Médicas: ON
   ⚙️ Puerto Médico: 20051
   ⏱️ Timeout: 5 seg
   👥 Workers: 10

2. Inicia descubrimiento en "10.1.10.0/24"

3. Para cada IP (ej: 10.1.10.20):
   
   a) 🏓 ICMP Ping
      ├─ OK → Continuar
      └─ FAIL → Marcar como no disponible

   b) 🌐 Web Discovery (PRIORIDAD 1)
      ├─ Intentar: http://10.1.10.20:20051/USER/Login.htm
      ├─ Si detecta DRYPIX/FCR/CR:
      │  ├─ Autenticar con dryprinter/fujifilm
      │  ├─ Obtener contadores de bandejas
      │  ├─ Retornar: is_medical=true, port=20051
      │  └─ ✅ COMPLETADO (saltar SNMP)
      └─ Si no es médica: Continuar con SNMP

   c) 📡 SNMP Discovery (PRIORIDAD 2)
      ├─ Test conexión puerto 161
      ├─ Obtener info combinada SNMP+HTTP
      └─ Retornar: is_medical=false, port=161

4. Mostrar resultados:
   🖨️ Total: 15 impresoras
   🏥 Médicas: 2 (DRYPIX)
   📡 SNMP: 13 (HP, OKI, Brother)
```

### Modo Solo Médicas (Endpoint Especializado)

```bash
# Descubrimiento exclusivo de médicas
POST /api/printers/discover/medical
{
  "ip_range": "10.1.10.0/24",
  "port": 20051,
  "timeout": 2,
  "max_workers": 50
}

# Solo busca en puerto 20051, no intenta SNMP
# Más rápido para escaneos focalizados
```

---

## Casos de Uso

### Caso 1: Hospital con Red Mixta
**Escenario**: 
- Piso 1-2: Impresoras de oficina HP/Brother (SNMP puerto 161)
- Piso 3: Radiología con DRYPIX (Web puerto 20051)

**Solución**:
```
✅ Incluir Médicas: ON
Rango: 10.1.0.0/16
```

**Resultado**:
- Descubre automáticamente AMBOS tipos
- No genera falsos negativos al intentar SNMP en DRYPIX
- UI diferencia visualmente con colores y badges

### Caso 2: Centro de Imagenología (Solo Médicas)
**Escenario**:
- Solo equipos DRYPIX, FCR, CR
- Red segmentada 10.20.0.0/24

**Solución**:
```bash
curl -X POST "http://api:8000/api/printers/discover/medical?ip_range=10.20.0.0/24"
```

**Resultado**:
- Escaneo rápido solo en puerto 20051
- No pierde tiempo intentando SNMP
- Logs claros: "🏥 Iniciando descubrimiento de impresoras médicas"

### Caso 3: Oficina Corporativa (Sin Médicas)
**Escenario**:
- Solo impresoras HP/OKI/Brother
- No hay equipos médicos

**Solución**:
```
❌ Incluir Médicas: OFF
Rango: 192.168.1.0/24
```

**Resultado**:
- Descubrimiento tradicional solo SNMP
- Sin overhead de escaneo web
- Comportamiento idéntico a versión anterior

---

## Pruebas de Funcionalidad

### Test 1: Discovery de DRYPIX Individual
```python
from app.services.medical_printer_service import MedicalPrinterService

# Descubrir impresora médica específica
result = MedicalPrinterService.discover_medical_printer(
    ip="10.1.10.20",
    port=20051,
    timeout=3
)

print(result)
# {
#   "ip": "10.1.10.20",
#   "model": "FUJI DRYPIX SMART",
#   "is_medical": true,
#   "authenticated": true,
#   "trays_info": {...}
# }
```

### Test 2: Discovery de Rango Completo
```python
# Escanear subnet completa
devices = MedicalPrinterService.discover_medical_printers_in_range(
    ip_range="10.1.10.0/24",
    port=20051,
    timeout=2,
    max_workers=50
)

print(f"Encontradas {len(devices)} impresoras médicas")
for device in devices:
    print(f"  - {device['ip']}: {device['model']}")
```

### Test 3: API Request Híbrido
```bash
# Test desde frontend
curl -X POST http://localhost:8000/api/printers/discover \
  -H "Content-Type: application/json" \
  -d '{
    "ip_range": "10.1.10.0/24",
    "timeout": 5,
    "max_workers": 10,
    "include_medical": true,
    "medical_port": 20051
  }'
```

**Respuesta Esperada**:
```json
[
  {
    "ip": "10.1.10.20",
    "is_medical": true,
    "connection_method": "web_interface",
    "brand": "FUJIFILM",
    "model": "FUJI DRYPIX SMART",
    "port": 20051
  },
  {
    "ip": "10.1.10.50",
    "is_medical": false,
    "connection_method": "snmp",
    "brand": "HP",
    "model": "LaserJet Pro M404dn",
    "port": 161
  }
]
```

---

## Logs de Ejemplo

### Discovery Exitoso
```
🔍 Escaneando 254 IPs en busca de impresoras médicas en puerto 20051...
✅ Impresora médica encontrada en 10.1.10.20:20051 - FUJI DRYPIX SMART
🎯 Descubrimiento completado: 1 impresoras médicas encontradas

🔌 Iniciando descubrimiento completo (SNMP + Médicas) en 254 IPs...
📡 Respuesta SNMP/Médica recibida para 10.1.10.0/24, status: 200
✅ Descubrimiento completado:
   📊 Total dispositivos: 254
   🖨️  Impresoras encontradas: 15
   🏥 Impresoras médicas: 2
   📡 Impresoras SNMP: 13
```

### Médica No Autenticada
```
✅ Impresora médica encontrada en 10.1.10.25:20051 - FUJI DRYPIX SMART
⚠️  Detectado pero no se pudo autenticar
```

### Sin Impresoras Médicas
```
🔍 Escaneando 50 IPs en busca de impresoras médicas en puerto 20051...
🎯 Descubrimiento completado: 0 impresoras médicas encontradas
```

---

## Configuración Recomendada

### Producción
```typescript
// web/app/printers/page.tsx
const [discoverySettings] = useState({
  timeout: 5,           // 5 segundos por IP (red estable)
  max_workers: 10,      // 10 threads paralelos (balanceado)
  include_medical: true, // Siempre buscar médicas
  medical_port: 20051   // Puerto estándar DRYPIX
})
```

### Desarrollo/Testing
```typescript
const [discoverySettings] = useState({
  timeout: 3,           // Más rápido para tests
  max_workers: 20,      // Más agresivo
  include_medical: true,
  medical_port: 20051
})
```

### Red Lenta/Inestable
```typescript
const [discoverySettings] = useState({
  timeout: 10,          // Más tolerante
  max_workers: 5,       // Menos concurrencia
  include_medical: true,
  medical_port: 20051
})
```

---

## Beneficios de la Implementación

### 1. ✅ Descubrimiento Unificado
- **Antes**: Discovery separado SNMP vs Manual para médicas
- **Ahora**: Un solo escaneo detecta ambos tipos

### 2. 🚀 Priorización Inteligente
- **Antes**: Intentaba SNMP en DRYPIX (fallaba, lento)
- **Ahora**: Detecta médica primero, evita SNMP innecesario

### 3. 🎨 UX Mejorada
- **Antes**: Mismo aspecto para todas
- **Ahora**: 
  - 🏥 Badge verde "Médica"
  - Fondo verde claro en tabla
  - 🌐 "Web OK" vs 📡 "SNMP OK"
  - Muestra puerto cuando no es estándar

### 4. 📊 Estadísticas Detalladas
- **Antes**: Solo conteo total
- **Ahora**: 
  - Total impresoras
  - Desglose: Médicas vs SNMP
  - Logs informativos con emojis

### 5. 🔧 Configuración Flexible
- **Toggle ON/OFF** para médicas
- **Puerto configurable** (no hardcoded)
- **Modo híbrido o especializado**

### 6. 🏥 Soporte Multi-Modelo
- DRYPIX (implementado)
- FCR (detectado, pendiente scraper)
- CR (detectado, pendiente scraper)
- Extensible para DI-HL y otros

---

## Próximos Pasos

### Fase 1: Validación (Inmediato)
- [ ] Probar discovery en red con DRYPIX real
- [ ] Validar que no rompe discovery SNMP existente
- [ ] Verificar logs y estadísticas

### Fase 2: Mejoras UX (Corto plazo)
- [ ] Agregar tooltip explicando "🏥 Médica"
- [ ] Botón "Solo Médicas" en UI para usar endpoint `/discover/medical`
- [ ] Filtro en tabla para mostrar solo médicas

### Fase 3: Expansión (Mediano plazo)
- [ ] Implementar scraper para FCR/CR
- [ ] Agregar soporte para DI-HL
- [ ] Auto-detectar puertos no estándar

### Fase 4: Optimización (Largo plazo)
- [ ] Cache de IPs conocidas para evitar re-escaneo
- [ ] Discovery incremental (solo IPs nuevas)
- [ ] Programación de escaneos automáticos

---

## Documentación de Referencia

- [MEDICAL_PRINTER_FLOW.md](./MEDICAL_PRINTER_FLOW.md) - Flujo completo de impresoras médicas
- [api/app/services/medical_printer_service.py](./api/app/services/medical_printer_service.py) - Servicio de descubrimiento
- [api/app/routers/printers.py](./api/app/routers/printers.py) - Endpoints de API
- [web/app/printers/page.tsx](./web/app/printers/page.tsx) - Frontend de descubrimiento

---

**Fecha de Implementación**: 27 de Noviembre, 2025  
**Versión**: 1.0  
**Status**: ✅ Completado - Listo para Testing
