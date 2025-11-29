# Flujo Completo de Impresoras Médicas - Sistema de Gestión de Flota

## Resumen Ejecutivo

Este documento describe el flujo completo de monitoreo, registro y gestión de impresoras médicas radiológicas (FUJI DRYPIX SMART) que no soportan protocolo SNMP y requieren acceso mediante scraping web.

### Impresoras Médicas Soportadas
- **FUJI DRYPIX SMART** (implementado)
- FCR (Computed Radiography) - pendiente
- CR (Computed Radiography) - pendiente
- DI-HL (Digital Imaging) - pendiente

---

## 1. Arquitectura del Sistema

### 1.1 Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                       │
│  - Dashboard de impresoras                                   │
│  - Formulario de registro manual                            │
│  - Visualización de contadores                              │
│  - Gestión de solicitudes de tóner                          │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP API
┌───────────────▼─────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  api/app/routers/printers.py                         │   │
│  │  - Endpoints unificados SNMP + Médicas               │   │
│  │  - POST /printers/                                    │   │
│  │  - GET /printers/{id}                                 │   │
│  │  - GET /printers/poll/{id}                            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  api/app/services/medical_printer_service.py         │   │
│  │  - MedicalPrinterService (coordinador)               │   │
│  │  - DrypixScraper (web scraping)                      │   │
│  │  - is_medical_printer()                              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  api/app/services/snmp_service.py                    │   │
│  │  - Para impresoras de oficina HP/OKI/Brother         │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│           IMPRESORA MÉDICA (FUJI DRYPIX)                    │
│  IP: 10.1.10.20:20051                                       │
│  Protocolo: HTTP Web Interface                              │
│  ❌ SNMP no disponible (seguridad médica)                   │
│  ✅ Interfaz web de mantenimiento                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Base de Datos

```sql
-- Tabla principal de impresoras
CREATE TABLE printers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    ip_address VARCHAR(50),
    port INTEGER DEFAULT 20051,
    model VARCHAR(100),           -- "FUJI DRYPIX SMART"
    location VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    last_poll TIMESTAMP,
    status VARCHAR(50),            -- 'online', 'offline', 'error'
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Reportes de uso (contadores)
CREATE TABLE usage_reports (
    id SERIAL PRIMARY KEY,
    printer_id INTEGER REFERENCES printers(id),
    timestamp TIMESTAMP,
    pages_printed INTEGER,         -- Total films impresos
    tray_details JSONB,           -- {"Tray1": {"available": 0, "printed": 100}, ...}
    status VARCHAR(50),
    created_at TIMESTAMP
);

-- Solicitudes de tóner/films
CREATE TABLE toner_requests (
    id SERIAL PRIMARY KEY,
    printer_id INTEGER REFERENCES printers(id),
    requested_by VARCHAR(100),
    supply_type VARCHAR(50),       -- 'insumos' o 'servicio'
    quantity INTEGER,
    status VARCHAR(50),            -- 'pending', 'approved', 'completed', 'rejected'
    notes TEXT,
    requested_at TIMESTAMP,
    completed_at TIMESTAMP,
    incident_id INTEGER            -- Vinculado con tabla incidents
);
```

---

## 2. Flujo de Descubrimiento y Registro

### 2.1 Problema Actual: Discovery SNMP

**Estado**: ❌ No funcional para impresoras médicas

El sistema actual utiliza descubrimiento basado en SNMP:
```python
# api/app/services/discovery_service.py
# Escanea rango de IPs buscando respuesta SNMP
# ❌ Impresoras médicas NO responden a SNMP (puerto 161)
```

**Resultado**: "Descubrimiento optimizado completado - 0 impresoras encontradas"

### 2.2 Registro Manual (Implementado)

**Estado**: ✅ Funcional

```http
POST /api/printers/
Content-Type: application/json

{
  "name": "DRYPIX Radiología Piso 3",
  "ip_address": "10.1.10.20",
  "port": 20051,
  "model": "FUJI DRYPIX SMART",
  "location": "Sala de Radiología - Piso 3",
  "is_active": true
}
```

### 2.3 Soluciones Propuestas de Discovery

#### Opción A: Web-Based Discovery (Recomendado)
Escanear rango de IPs en puerto 20051 buscando interfaz web DRYPIX:

```python
def discover_medical_printers(ip_range: str = "10.1.10.0/24") -> List[Dict]:
    """
    Escanea red buscando interfaces web de impresoras médicas
    """
    discovered = []
    for ip in ip_network(ip_range).hosts():
        try:
            # Intentar acceso a interfaz web
            response = requests.get(
                f"http://{ip}:20051/USER/Login.htm",
                timeout=2
            )
            if response.status_code == 200 and "DRYPIX" in response.text:
                discovered.append({
                    "ip": str(ip),
                    "port": 20051,
                    "model": "FUJI DRYPIX SMART",
                    "type": "medical"
                })
        except:
            continue
    return discovered
```

#### Opción B: Importación desde CSV/Excel
Interfaz para cargar lista de impresoras médicas desde archivo:

```csv
name,ip_address,port,model,location
DRYPIX Radiología,10.1.10.20,20051,FUJI DRYPIX SMART,Piso 3
```

#### Opción C: Registro Asistido con Validación
Formulario web que valida conectividad antes de guardar:

```typescript
// web/app/printers/register/MedicalPrinterForm.tsx
async function validateConnection(ip: string, port: number) {
  const response = await fetch('/api/printers/validate', {
    method: 'POST',
    body: JSON.stringify({ ip_address: ip, port })
  });
  return response.ok; // Intenta autenticación y obtener contadores
}
```

---

## 3. Flujo de Autenticación Web

### 3.1 Credenciales de Mantenimiento

```python
# Credenciales estándar FUJI DRYPIX
DEFAULT_LOGIN = "dryprinter"
DEFAULT_PASSWORD = "fujifilm"
DEFAULT_LANGUAGE = "en"
```

### 3.2 Proceso de Login

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Cliente HTTP                                             │
│    GET http://10.1.10.20:20051/USER/chkin=dryprinter       │
│        &passwd=fujifilm&Language=en                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Servidor DRYPIX                                          │
│    - Valida credenciales                                    │
│    - Crea sesión de mantenimiento                           │
│    - Retorna página principal con frames                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Validación Cliente                                       │
│    if "main" in response.text.lower():                      │
│        return True  # Login exitoso                         │
└─────────────────────────────────────────────────────────────┘
```

**Código actual**:
```python
# api/app/services/medical_printer_service.py (líneas 64-81)
def authenticate(self) -> bool:
    try:
        login_url = (f"{self.base_url}/USER/chkin={self.login}"
                    f"&passwd={self.password}&Language={self.DEFAULT_LANGUAGE}")
        
        response = self.session.get(login_url, timeout=10)
        
        if response.status_code == 200 and "main" in response.text.lower():
            return True
        return False
        
    except Exception as e:
        print(f"Error en autenticación DRYPIX: {e}")
        return False
```

---

## 4. Flujo de Extracción de Contadores

### 4.1 Endpoint de Contadores

**URL**: `http://10.1.10.20:20051/SETTING/?settingMode=5`

Este endpoint retorna una página HTML completa (1584 líneas) con múltiples secciones de configuración.

### 4.2 Estructura HTML de Contadores

```html
<!-- Sección relevante: líneas 1219-1275 de setting2_page.html -->
<B>Check Counters</B>

<TABLE WIDTH="150" BORDER="1">
  <TR>
    <TD>Tray1</TD>
    <TD ALIGN="RIGHT">0</TD>    <!-- Films disponibles -->
  </TR>
  <TR>
    <TD>Tray2</TD>
    <TD ALIGN="RIGHT">0</TD>
  </TR>
  <TR>
    <TD>Tray3</TD>
    <TD ALIGN="RIGHT">0</TD>
  </TR>
  <TR>
    <TD>Tray4</TD>
    <TD ALIGN="RIGHT">0</TD>
  </TR>
  <TR>
    <TD>Tray5</TD>
    <TD ALIGN="RIGHT">0</TD>
  </TR>
</TABLE>
```

### 4.3 Lógica de Parsing

**Método 1: BeautifulSoup (primario)**
```python
# api/app/services/medical_printer_service.py (líneas 159-175)
soup = BeautifulSoup(html, 'html.parser')
tables = soup.find_all('table', width="150", border="1")

counters = {}
if tables:
    counter_table = tables[0]
    rows = counter_table.find_all('tr')
    
    for row in rows:
        cells = row.find_all('td')
        if len(cells) == 2:
            tray_name = cells[0].get_text().strip()  # "Tray1"
            count = cells[1].get_text().strip()       # "0"
            
            if tray_name.startswith('Tray'):
                counters[tray_name] = int(count)
```

**Método 2: Regex (fallback)**
```python
# api/app/services/medical_printer_service.py (líneas 176-190)
match = re.search(
    r'<B>Check Counters</B>.*?<TABLE[^>]*>(.*?)</TABLE>',
    html, re.DOTALL | re.IGNORECASE
)

if match:
    table_html = match.group(1)
    tray_matches = re.findall(
        r'(Tray\d+).*?ALIGN="RIGHT"[^>]*>\s*(\d+)',
        table_html, re.DOTALL
    )
    
    for tray_name, count in tray_matches:
        counters[tray_name] = int(count)
```

### 4.4 Cálculo de Films Impresos

```python
# Capacidad estándar por bandeja
TRAY_CAPACITY = 100

# Para cada bandeja
for tray, available in counters.items():
    if available > 0:
        printed = TRAY_CAPACITY - available
    else:
        printed = 0  # Bandeja vacía
    
    tray_details[tray] = {
        "available": available,    # Films restantes
        "printed": printed          # Films consumidos
    }
```

**Ejemplo**:
- Bandeja 1: 75 disponibles → 25 impresos
- Bandeja 2: 0 disponibles → 0 impresos (vacía)
- Bandeja 3: 50 disponibles → 50 impresos

### 4.5 Respuesta JSON Final

```json
{
  "timestamp": "2025-06-15T10:30:00",
  "tray_capacity": 100,
  "trays": {
    "Tray1": {
      "available": 75,
      "printed": 25
    },
    "Tray2": {
      "available": 0,
      "printed": 0
    },
    "Tray3": {
      "available": 50,
      "printed": 50
    },
    "Tray4": {
      "available": 100,
      "printed": 0
    },
    "Tray5": {
      "available": 30,
      "printed": 70
    }
  },
  "summary": {
    "total_available": 255,
    "total_printed": 145,
    "total_trays_loaded": 4
  },
  "status": "online",
  "pages_printed": 145,
  "is_online": true
}
```

---

## 5. Flujo de Polling Automático

### 5.1 Scheduler con APScheduler

```python
# api/app/main.py
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

@app.on_event("startup")
async def startup_event():
    # Polling cada 15 minutos
    scheduler.add_job(
        poll_all_printers,
        'interval',
        minutes=15
    )
    scheduler.start()
```

### 5.2 Función de Polling

```python
async def poll_all_printers():
    """Consulta todas las impresoras activas"""
    db = SessionLocal()
    try:
        printers = db.query(Printer).filter(Printer.is_active == True).all()
        
        for printer in printers:
            if is_medical_printer(printer):
                # Web scraping
                service = MedicalPrinterService()
                data = service.poll_printer(printer)
            else:
                # SNMP
                data = poll_snmp_printer(printer)
            
            if data:
                # Guardar en usage_reports
                report = UsageReport(
                    printer_id=printer.id,
                    timestamp=datetime.now(),
                    pages_printed=data.get('pages_printed'),
                    tray_details=data.get('trays'),
                    status=data.get('status')
                )
                db.add(report)
                
                # Actualizar last_poll
                printer.last_poll = datetime.now()
                printer.status = data.get('status')
        
        db.commit()
    finally:
        db.close()
```

### 5.3 Diagrama de Flujo de Polling

```
┌──────────────────────────────────────────────────────────────┐
│ APScheduler (cada 15 minutos)                                │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ poll_all_printers()                                          │
│ - Query: SELECT * FROM printers WHERE is_active = true       │
└────────────────────┬─────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
┌─────────────────┐   ┌─────────────────────┐
│ is_medical?     │   │ SNMP Printer        │
│ = True          │   │ = False             │
└────────┬────────┘   └─────────┬───────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐   ┌─────────────────────┐
│ authenticate()  │   │ SNMP query          │
│ get_counters()  │   │ OID polling         │
└────────┬────────┘   └─────────┬───────────┘
         │                      │
         └──────────┬───────────┘
                    ▼
         ┌─────────────────────┐
         │ INSERT usage_report │
         │ UPDATE printer      │
         │ SET last_poll       │
         └─────────────────────┘
```

---

## 6. Gestión de Solicitudes de Films/Tóner

### 6.1 Flujo de Creación de Solicitud

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Usuario detecta bandeja vacía o baja                      │
│    Dashboard muestra: "Tray1: 5 disponibles (95% consumido)" │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Crear solicitud de reabastecimiento                       │
│    POST /api/toner-requests/                                 │
│    {                                                          │
│      "printer_id": 123,                                       │
│      "supply_type": "insumos",  // o "servicio"              │
│      "quantity": 1,              // 1 cartucho = 100 films   │
│      "notes": "Tray1 casi vacía"                             │
│    }                                                          │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Backend crea TonerRequest + Incident automático           │
│    - status: 'pending'                                        │
│    - requested_at: timestamp actual                           │
│    - incident_id: auto-generado                               │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Flujo de aprobación/procesamiento                         │
│    - Manager revisa solicitud                                │
│    - Aprueba → status: 'approved'                            │
│    - Rechaza → status: 'rejected'                            │
│    - Completa → status: 'completed', completed_at: timestamp │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Código Actual de Solicitud

```python
# api/app/routers/toner_requests.py (líneas 115-214)
@router.post("/", response_model=TonerRequestResponse)
def create_toner_request(
    request: TonerRequestCreate,
    db: Session = Depends(get_db)
):
    # 1. Verificar que printer existe
    printer = db.query(Printer).filter(Printer.id == request.printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # 2. Crear toner request
    db_request = TonerRequest(
        printer_id=request.printer_id,
        requested_by=request.requested_by,
        supply_type=request.supply_type,
        quantity=request.quantity,
        notes=request.notes,
        status="pending",
        requested_at=datetime.now()
    )
    db.add(db_request)
    db.flush()  # Obtener ID antes de commit
    
    # 3. AUTO-CREAR INCIDENT vinculado
    incident_description = (
        f"Solicitud de {request.supply_type} - {printer.name}\n"
        f"Cantidad: {request.quantity}\n"
        f"Solicitado por: {request.requested_by}\n"
        f"Notas: {request.notes or 'N/A'}"
    )
    
    incident = Incident(
        printer_id=printer.id,
        title=f"Reabastecimiento {request.supply_type}",
        description=incident_description,
        priority="medium",
        status="open",
        reported_at=datetime.now()
    )
    db.add(incident)
    db.flush()
    
    # 4. Vincular incident con request
    db_request.incident_id = incident.id
    
    db.commit()
    db.refresh(db_request)
    
    return db_request
```

### 6.3 Tipos de Suministro

```python
# supply_type field
supply_type: Literal["insumos", "servicio"]

# "insumos": Cartuchos de films (100 films por cartucho)
# "servicio": Mantenimiento preventivo o correctivo
```

---

## 7. Gestión de Inventario de Films (Propuesto)

### 7.1 Problema Identificado

**Usuario comentó**: "si se envian un cartucho de 100 deberia aparecer 100 disponibles para cargar en la impresora cuando vea que se que agotaron se deberia cargar para reiniciar el contador"

### 7.2 Flujo Propuesto de Stock

```
┌──────────────────────────────────────────────────────────────┐
│ 1. RECEPCIÓN DE CARTUCHO                                     │
│    - Se recibe cartucho de 100 films                         │
│    - Registrar en Stock: +1 cartucho (100 films)             │
│    - Estado: "en_almacen"                                    │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. DETECCIÓN DE BANDEJA VACÍA                                │
│    - Polling detecta: Tray1 = 0 disponibles                  │
│    - Sistema genera alerta: "Tray1 vacía - cargar cartucho"  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. CARGA FÍSICA DEL CARTUCHO                                 │
│    - Técnico físicamente coloca cartucho en Tray1            │
│    - En interfaz web: Marcar "Cartucho cargado en Tray1"     │
│    - Stock: -1 cartucho                                       │
│    - Estado cartucho: "en_uso" (asignado a Tray1)            │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. VERIFICACIÓN AUTOMÁTICA                                   │
│    - Siguiente polling detecta: Tray1 = 100 disponibles      │
│    - Confirma carga exitosa                                  │
│    - Registro histórico: "Tray1 recargada 2025-06-15 10:30"  │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Nueva Tabla: film_cartridges

```sql
CREATE TABLE film_cartridges (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(50),      -- Número de lote del proveedor
    capacity INTEGER DEFAULT 100,   -- Films por cartucho
    status VARCHAR(50),            -- 'en_almacen', 'en_uso', 'agotado'
    assigned_to_tray VARCHAR(20),  -- 'Tray1', 'Tray2', etc. (NULL si en almacén)
    printer_id INTEGER REFERENCES printers(id),
    received_at TIMESTAMP,
    loaded_at TIMESTAMP,           -- Cuándo se cargó en bandeja
    depleted_at TIMESTAMP,         -- Cuándo se agotó
    created_at TIMESTAMP
);
```

### 7.4 Endpoints Propuestos

```python
# POST /api/film-cartridges/receive
# Registrar recepción de cartuchos nuevos
{
  "batch_number": "FUJI-2025-001",
  "quantity": 5,
  "capacity": 100
}

# POST /api/film-cartridges/{id}/load
# Marcar cartucho como cargado en bandeja
{
  "printer_id": 123,
  "tray": "Tray1"
}

# GET /api/film-cartridges/stock
# Ver inventario disponible
{
  "total_cartridges": 15,
  "total_films": 1500,
  "in_storage": 10,
  "in_use": 5,
  "low_stock_alert": false
}
```

---

## 8. Mejoras Propuestas

### 8.1 ALTA PRIORIDAD

#### A. Discovery Automático Web-Based
**Problema**: Discovery SNMP no detecta impresoras médicas  
**Solución**: Escaneo de puerto 20051 en rango de red  
**Esfuerzo**: 2-3 días  
**Impacto**: Alto - Elimina registro manual  

**Implementación**:
```python
# api/app/services/medical_discovery.py
async def discover_medical_printers_async(ip_range: str):
    """Escaneo paralelo de red"""
    tasks = []
    for ip in ip_network(ip_range).hosts():
        tasks.append(check_drypix_endpoint(ip))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if r and not isinstance(r, Exception)]
```

#### B. Sistema de Alertas de Films Bajos
**Problema**: No hay notificación proactiva cuando films < 20%  
**Solución**: Alertas automáticas por email/webhook  
**Esfuerzo**: 1-2 días  
**Impacto**: Alto - Previene quedarse sin films  

**Implementación**:
```python
async def check_low_film_alerts():
    """Ejecutar después de cada polling"""
    for tray, data in tray_details.items():
        if data['available'] < 20 and data['available'] > 0:
            send_alert(
                type="low_film_warning",
                message=f"{printer.name} - {tray}: {data['available']} films restantes",
                priority="medium"
            )
        elif data['available'] == 0:
            send_alert(
                type="no_films",
                message=f"{printer.name} - {tray}: VACÍA - Requiere recarga",
                priority="high"
            )
```

#### C. Gestión de Inventario de Cartuchos
**Problema**: No hay tracking de stock de cartuchos  
**Solución**: Tabla film_cartridges + endpoints de gestión  
**Esfuerzo**: 3-4 días  
**Impacto**: Alto - Control completo de insumos  

### 8.2 PRIORIDAD MEDIA

#### D. Dashboard Especializado para Médicas
**Problema**: Dashboard actual optimizado para impresoras de oficina  
**Solución**: Vista específica para DRYPIX con bandejas  
**Esfuerzo**: 2-3 días  
**Impacto**: Medio - Mejor UX para radiólogos  

**Mockup**:
```
┌─────────────────────────────────────────────────────────┐
│ DRYPIX Radiología Piso 3          [●] Online           │
│ IP: 10.1.10.20:20051              Última actualización: │
│                                    15/06/2025 10:30     │
├─────────────────────────────────────────────────────────┤
│ BANDEJAS                                                │
│ Tray1 [14x17] ████████░░ 75/100  (25% consumido)       │
│ Tray2 [14x14] ░░░░░░░░░░  0/100  ⚠️ VACÍA             │
│ Tray3 [10x14] █████░░░░░ 50/100  (50% consumido)       │
│ Tray4 [10x12] ██████████ 100/100 (0% consumido)        │
│ Tray5 [8x10]  ███░░░░░░░ 30/100  (70% consumido)       │
│                                                         │
│ Total disponible: 255 films | Total consumido: 145     │
│                                                         │
│ [Solicitar Films] [Ver Histórico] [Detalle Técnico]    │
└─────────────────────────────────────────────────────────┘
```

#### E. Reportes Específicos de Radiología
**Problema**: Reportes actuales son genéricos  
**Solución**: Reportes de consumo por tipo de film, tendencias  
**Esfuerzo**: 2 días  
**Impacto**: Medio - Mejor análisis de costos  

**Reportes**:
- Consumo mensual por tamaño de film
- Proyección de agotamiento de stock
- Costo por estudio radiológico
- Comparativa entre equipos DRYPIX

#### F. Integración con PACS/RIS
**Problema**: No hay correlación entre films impresos y estudios  
**Solución**: API hook para recibir eventos de impresión desde PACS  
**Esfuerzo**: 5-7 días (requiere coordinación con PACS)  
**Impacto**: Medio-Alto - Trazabilidad completa  

### 8.3 PRIORIDAD BAJA

#### G. Soporte para Otros Modelos Médicos
**Problema**: Solo DRYPIX implementado  
**Solución**: Agregar scrapers para FCR, CR, DI-HL  
**Esfuerzo**: 3-4 días por modelo  
**Impacto**: Bajo - Depende de equipos disponibles  

#### H. Modo Mantenimiento desde Web
**Problema**: Cambios requieren acceder a interfaz DRYPIX  
**Solución**: Proxy para ejecutar comandos desde dashboard  
**Esfuerzo**: 4-5 días  
**Impacto**: Bajo - Conveniencia, no crítico  

---

## 9. Funcionalidades Faltantes Identificadas

### 9.1 Monitoreo en Tiempo Real
- [ ] WebSocket para actualización en vivo de contadores
- [ ] Notificaciones push cuando bandeja se vacía
- [ ] Indicador visual de impresión en progreso

### 9.2 Histórico y Tendencias
- [ ] Gráficas de consumo por bandeja (últimos 30 días)
- [ ] Predicción de cuándo se agotará cada bandeja
- [ ] Comparativa de consumo entre diferentes ubicaciones

### 9.3 Mantenimiento Preventivo
- [ ] Contador de ciclos de impresión total (desgaste)
- [ ] Alertas de mantenimiento programado cada X impresiones
- [ ] Registro de limpiezas y calibraciones

### 9.4 Control de Acceso
- [ ] Permisos por rol (Radiólogo, Técnico, Admin)
- [ ] Auditoría de quién solicitó qué insumos
- [ ] Restricción de operaciones según perfil

### 9.5 Integración Externa
- [ ] Webhook cuando se crea solicitud de film
- [ ] API REST pública para consumo externo
- [ ] Exportación de datos a CSV/Excel/PDF

---

## 10. Endpoints API Actuales

### 10.1 Impresoras

```http
# Listar todas las impresoras
GET /api/printers/
Response: List[PrinterResponse]

# Crear impresora médica
POST /api/printers/
Body: {
  "name": "DRYPIX Radiología",
  "ip_address": "10.1.10.20",
  "port": 20051,
  "model": "FUJI DRYPIX SMART"
}

# Obtener detalle
GET /api/printers/{id}
Response: PrinterResponse

# Polling manual
GET /api/printers/poll/{id}
Response: {
  "timestamp": "...",
  "trays": {...},
  "summary": {...}
}
```

### 10.2 Solicitudes de Films

```http
# Crear solicitud
POST /api/toner-requests/
Body: {
  "printer_id": 123,
  "supply_type": "insumos",
  "quantity": 1,
  "requested_by": "Dr. García",
  "notes": "Tray2 vacía"
}

# Listar solicitudes
GET /api/toner-requests/?status=pending&printer_id=123

# Actualizar estado
PUT /api/toner-requests/{id}
Body: {
  "status": "completed"
}

# Historial por impresora
GET /api/toner-requests/printer/{id}/history
```

---

## 11. Diagrama de Secuencia Completo

```
Usuario      Frontend       Backend API      MedicalService    DRYPIX
  │              │               │                  │              │
  │ 1. Registrar │               │                  │              │
  │   DRYPIX     │               │                  │              │
  ├──────────────>               │                  │              │
  │              ├───POST────────>                  │              │
  │              │ /printers/    │                  │              │
  │              │               ├──INSERT DB───────┤              │
  │              │               │                  │              │
  │              │<──201 Created─┤                  │              │
  │<─────────────┤               │                  │              │
  │              │               │                  │              │
  │              │  (15 min después - APScheduler)  │              │
  │              │               │                  │              │
  │              │               ├──poll_printer────>              │
  │              │               │                  ├──GET Login───>
  │              │               │                  │              │
  │              │               │                  │<─200 OK──────┤
  │              │               │                  │ (Session)    │
  │              │               │                  ├──GET Setting─>
  │              │               │                  │ Mode=5       │
  │              │               │                  │<─200 HTML────┤
  │              │               │                  │              │
  │              │               │                  ├──Parse HTML──┤
  │              │               │                  │ BeautifulSoup│
  │              │               │<─JSON Counters───┤              │
  │              │               │                  │              │
  │              │               ├──INSERT─────────>│              │
  │              │               │ usage_reports    │              │
  │              │               │                  │              │
  │ 2. Ver       │               │                  │              │
  │   Dashboard  │               │                  │              │
  ├──────────────>               │                  │              │
  │              ├───GET─────────>                  │              │
  │              │ /printers/123 │                  │              │
  │              │               ├──SELECT DB───────┤              │
  │              │<──PrinterData─┤                  │              │
  │<─────────────┤               │                  │              │
  │  [Tray1: 75] │               │                  │              │
  │              │               │                  │              │
  │ 3. Solicitar │               │                  │              │
  │   Films      │               │                  │              │
  ├──────────────>               │                  │              │
  │              ├───POST────────>                  │              │
  │              │/toner-requests│                  │              │
  │              │               ├──INSERT──────────┤              │
  │              │               │ toner_request    │              │
  │              │               ├──INSERT──────────┤              │
  │              │               │ incident (auto)  │              │
  │              │<──201─────────┤                  │              │
  │<─────────────┤               │                  │              │
  │              │               │                  │              │
```

---

## 12. Problemas Conocidos y Limitaciones

### 12.1 Limitaciones Técnicas

1. **No hay API nativa**: DRYPIX solo expone interfaz web HTML
2. **Parsing frágil**: Cambios en HTML rompen scraper
3. **Sin WebSocket**: Polling cada 15 min, no real-time
4. **Credenciales hardcoded**: dryprinter/fujifilm estándar
5. **Puerto no estándar**: 20051 (puede estar bloqueado por firewall)

### 12.2 Problemas de Negocio

1. **Manual vs Automático**: Discovery requiere registro manual
2. **Sin validación de carga**: Sistema confía que técnico cargó cartucho
3. **No hay alertas proactivas**: Usuario debe revisar dashboard
4. **Sin integración PACS**: No correlaciona films con estudios
5. **Un solo modelo**: Solo DRYPIX, no FCR/CR/DI-HL

### 12.3 Riesgos

1. **Cambio de firmware DRYPIX**: Puede romper endpoints
2. **Cambio de credenciales**: Requiere actualización manual
3. **Red médica segmentada**: Puede no tener acceso desde servidor
4. **Downtime impresora**: Polling falla sin recuperación automática

---

## 13. Roadmap de Implementación

### Fase 1: Estabilización (1-2 semanas)
- [x] Web scraping DRYPIX funcional
- [x] Registro manual de impresoras
- [x] Polling automático cada 15 min
- [x] Solicitudes de films con incident linking
- [ ] **Discovery web-based**
- [ ] **Alertas de films bajos**
- [ ] **Validación de conectividad en registro**

### Fase 2: Inventario (2-3 semanas)
- [ ] Tabla film_cartridges
- [ ] Endpoints de stock management
- [ ] Flujo de carga de cartuchos
- [ ] Alertas de stock bajo en almacén
- [ ] Reportes de consumo vs stock

### Fase 3: UX Médica (2 semanas)
- [ ] Dashboard especializado DRYPIX
- [ ] Gráficas de tendencias por bandeja
- [ ] Reportes específicos radiología
- [ ] Notificaciones push

### Fase 4: Integración (3-4 semanas)
- [ ] Webhooks para eventos
- [ ] API pública documentada
- [ ] Integración PACS/RIS (si disponible)
- [ ] Exportación de datos

### Fase 5: Expansión (4+ semanas)
- [ ] Soporte FCR/CR
- [ ] Soporte DI-HL
- [ ] Modo mantenimiento remoto
- [ ] WebSocket real-time

---

## 14. Conclusiones

### 14.1 Estado Actual: ✅ FUNCIONAL

El sistema actualmente permite:
- Registro manual de DRYPIX
- Polling automático cada 15 min
- Extracción de contadores por bandeja
- Cálculo de films disponibles/impresos
- Solicitudes de reabastecimiento con incident linking

### 14.2 Áreas de Mejora Críticas

1. **Discovery automático**: Eliminar registro manual
2. **Alertas proactivas**: No esperar a que usuario revise
3. **Inventario de cartuchos**: Tracking completo de stock
4. **Dashboard especializado**: UX optimizada para radiología

### 14.3 Valor Agregado

- **Visibilidad**: Monitoreo centralizado de equipos médicos críticos
- **Prevención**: Alertas antes de quedarse sin films
- **Trazabilidad**: Historial completo de consumo
- **Eficiencia**: Reducción de tiempos de respuesta en reabastecimiento

### 14.4 Próximos Pasos Recomendados

1. Implementar discovery web-based (prioridad alta)
2. Agregar sistema de alertas por email/Slack
3. Desarrollar módulo de inventario de cartuchos
4. Crear dashboard especializado para DRYPIX

---

## Anexos

### Anexo A: Scripts de Prueba

```bash
# Test de conectividad
curl -v http://10.1.10.20:20051/USER/Login.htm

# Test de autenticación
curl "http://10.1.10.20:20051/USER/chkin=dryprinter&passwd=fujifilm&Language=en"

# Test de contadores
curl -b cookies.txt "http://10.1.10.20:20051/SETTING/?settingMode=5"
```

### Anexo B: Configuración Recomendada

```yaml
# docker-compose.yml
services:
  api:
    environment:
      - DRYPIX_POLL_INTERVAL=900  # 15 minutos
      - FILM_LOW_THRESHOLD=20      # Alertar si < 20 films
      - FILM_CRITICAL_THRESHOLD=5  # Crítico si < 5 films
```

### Anexo C: Referencias

- FUJI DRYPIX SMART User Manual
- DICOM/HL7 Integration Guide (para PACS)
- PostgreSQL JSONB Best Practices
- FastAPI Async Patterns

---

**Documento generado**: 15/06/2025  
**Versión**: 1.0  
**Autor**: GitHub Copilot  
**Para**: Sistema de Gestión de Flota de Impresoras - Módulo Médico
