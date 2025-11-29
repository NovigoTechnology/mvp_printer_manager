# ✅ Implementación: Cálculo Real de Uptime - COMPLETADO

**Fecha:** 25 de Noviembre, 2025  
**Prioridad:** 🔴 ALTA  
**Estado:** ✅ Completado y Funcionando  
**Tiempo de desarrollo:** ~1 hora

---

## 📋 Resumen

Se implementó el cálculo **dinámico y real** del uptime de impresoras médicas DRYPIX basado en el histórico de estados almacenados en la base de datos, reemplazando el valor hardcoded de 96.4%.

---

## 🔧 Cambios Implementados

### 1. Backend - Nuevo Endpoint

**Archivo:** `api/app/routers/medical_printers.py`

#### Cambios:
1. **Import actualizado** (línea 3):
   ```python
   from sqlalchemy import desc, func  # Agregado 'func'
   ```

2. **Nuevo modelo Pydantic** (línea 492):
   ```python
   class UptimeResponse(BaseModel):
       uptime_percentage: float
       total_records: int
       online_records: int
       offline_records: int
       period_days: int
       first_record_date: Optional[str]
       last_record_date: Optional[str]
       current_status: str
   ```

3. **Nuevo endpoint** `GET /medical-printers/{printer_id}/uptime` (línea 501):
   ```python
   @router.get("/{printer_id}/uptime", response_model=UptimeResponse)
   async def get_printer_uptime(
       printer_id: int, 
       days: int = 7, 
       db: Session = Depends(get_db)
   )
   ```

#### Lógica del Endpoint:

```
1. Verificar que la impresora existe y es DRYPIX
2. Calcular fecha de inicio (hoy - N días)
3. Query a MedicalPrinterCounter para obtener todos los snapshots del período
4. Si NO hay registros históricos:
   └─> Intentar obtener estado actual con DrypixScraper
   └─> Retornar uptime basado en estado actual (100% o 0%)
5. Si SÍ hay registros:
   └─> Contar total de registros
   └─> Contar registros donde is_online = True
   └─> Calcular: uptime% = (online / total) * 100
   └─> Retornar con estadísticas completas
```

#### Ejemplo de Respuesta:

```json
{
  "uptime_percentage": 94.29,
  "total_records": 35,
  "online_records": 33,
  "offline_records": 2,
  "period_days": 7,
  "first_record_date": "2025-11-18T07:00:00",
  "last_record_date": "2025-11-25T07:00:00",
  "current_status": "online"
}
```

---

### 2. Frontend - Integración del Uptime Real

**Archivo:** `web/app/medical-printers/page.tsx`

#### Cambios:

1. **Nueva interface** (línea 56):
   ```typescript
   interface UptimeData {
     uptime_percentage: number
     total_records: number
     online_records: number
     offline_records: number
     period_days: number
     current_status: string
   }
   ```

2. **Estado actualizado** (línea 52):
   ```typescript
   interface PrinterStatus {
     printer: MedicalPrinter
     counters?: MedicalCounterData
     last_update?: string
     error?: string
     loading: boolean
     uptime?: UptimeData  // ← NUEVO
   }
   ```

3. **Nueva función** `fetchPrinterUptime()` (línea 310):
   ```typescript
   const fetchPrinterUptime = async (printerId: number, days: number = 7) => {
     try {
       const response = await fetch(
         `${API_BASE}/medical-printers/${printerId}/uptime?days=${days}`
       )
       
       if (!response.ok) {
         console.error(`Failed to fetch uptime for printer ${printerId}`)
         return
       }

       const uptimeData = await response.json()
       
       setPrinterStatuses(prev => {
         const newMap = new Map(prev)
         const status = newMap.get(printerId)
         if (status) {
           status.uptime = uptimeData
           newMap.set(printerId, { ...status })
         }
         return newMap
       })
     } catch (error) {
       console.error(`Error fetching uptime for printer ${printerId}:`, error)
     }
   }
   ```

4. **Llamada automática** en `fetchPrinterCounters()` (línea 293):
   ```typescript
   // Después de obtener contadores exitosamente
   await fetchPrinterUptime(printerId, 7)
   ```

5. **Visualización actualizada** (línea 503):
   ```tsx
   <div>
     <div className="text-xs text-gray-500 mb-1">Total Uptime (7 días)</div>
     <div className="text-xl font-semibold text-gray-900">
       {status?.uptime 
         ? `${status.uptime.uptime_percentage}%`
         : counters.summary.total_available > 0 ? 'Cargando...' : '0%'
       }
     </div>
     {status?.uptime && (
       <div className="text-xs text-gray-500 mt-1">
         {status.uptime.online_records}/{status.uptime.total_records} registros
       </div>
     )}
   </div>
   ```

---

## 🎯 Funcionamiento

### Flujo Completo:

```
1. Usuario abre /medical-printers
   ↓
2. fetchMedicalPrinters() carga lista de DRYPIX
   ↓
3. Para cada impresora, llama fetchPrinterCounters(id)
   ↓
4. fetchPrinterCounters() hace:
   a) GET /medical-printers/{id}/counters → Obtiene datos en tiempo real
   b) await fetchPrinterUptime(id, 7) → Obtiene uptime de últimos 7 días
   ↓
5. Frontend actualiza estado con ambos datos
   ↓
6. UI muestra:
   - Uptime real calculado: "94.29%"
   - Detalle: "33/35 registros"
   - Período: "7 días"
```

### Estados Posibles:

| Situación | Visualización |
|-----------|---------------|
| Sin datos históricos + Online ahora | `100%` |
| Sin datos históricos + Offline ahora | `0%` |
| Sin datos históricos + Sin conexión | `0%` |
| Con datos históricos | `XX.XX%` (calculado) |
| Cargando... | `Cargando...` |

---

## 📊 Ventajas de esta Implementación

1. **Datos Reales y Confiables**
   - Basado en snapshots históricos de `MedicalPrinterCounter`
   - Cada snapshot tiene `is_online` verificado mediante conexión real

2. **Período Configurable**
   - Default: 7 días
   - Se puede consultar con `?days=30` para 30 días, etc.

3. **Fallback Inteligente**
   - Si no hay historial, consulta estado actual en tiempo real
   - Nunca muestra "N/A" o error al usuario

4. **Información Detallada**
   - Porcentaje de uptime
   - Número de registros online/offline
   - Fechas del período analizado
   - Estado actual

5. **Performance Optimizada**
   - Query simple a la BD (índice en `printer_id` + `timestamp`)
   - Cálculo en backend (no sobrecarga frontend)
   - Caching automático del estado en frontend

---

## 🧪 Casos de Prueba

### Test 1: Impresora con Historial Completo
**Escenario:** DRYPIX con 30 días de snapshots diarios  
**Esperado:** Uptime calculado correctamente (ej: 95.67%)  
**Query SQL:**
```sql
SELECT COUNT(*) as total,
       SUM(CASE WHEN is_online THEN 1 ELSE 0 END) as online
FROM medical_printer_counters
WHERE printer_id = 227
  AND timestamp >= NOW() - INTERVAL '7 days'
```

### Test 2: Impresora Nueva (Sin Historial)
**Escenario:** DRYPIX recién agregada, 0 snapshots  
**Esperado:** Intenta conexión actual, muestra 100% o 0% según responda  
**API Call:** `GET /medical-printers/227/uptime?days=7`  
**Response:**
```json
{
  "uptime_percentage": 100.0,
  "total_records": 1,
  "online_records": 1,
  "current_status": "online"
}
```

### Test 3: Impresora con Intermitencias
**Escenario:** DRYPIX con 20 snapshots, 17 online, 3 offline  
**Esperado:** Uptime = 85.00%  
**Cálculo:** `(17 / 20) * 100 = 85.00%`

### Test 4: Múltiples Períodos
**Escenario:** Consultar uptime de 7 días vs 30 días  
**API Calls:**
- `GET /medical-printers/227/uptime?days=7`
- `GET /medical-printers/227/uptime?days=30`  
**Esperado:** Valores diferentes según período

---

## 🐛 Manejo de Errores

### Error 1: Impresora No Existe
**Request:** `GET /medical-printers/999/uptime`  
**Response:** `404 Not Found`
```json
{
  "detail": "Printer not found"
}
```

### Error 2: No es DRYPIX
**Request:** `GET /medical-printers/5/uptime` (HP LaserJet)  
**Response:** `400 Bad Request`
```json
{
  "detail": "This endpoint is only for DRYPIX medical printers"
}
```

### Error 3: Sin Conexión y Sin Historial
**Escenario:** Nueva impresora offline  
**Response:** `200 OK`
```json
{
  "uptime_percentage": 0.0,
  "total_records": 0,
  "current_status": "unknown"
}
```

---

## 📈 Mejoras Futuras (Opcionales)

### 1. Uptime por Horario
```python
# Calcular uptime solo en horario laboral (8 AM - 6 PM)
@router.get("/{printer_id}/uptime-business-hours")
```

### 2. Comparativa de Uptime
```python
# Comparar uptime de todas las DRYPIX
@router.get("/uptime-comparison")
```

### 3. Alertas de Uptime Bajo
```python
# Generar alerta si uptime < 90% en 7 días
if uptime_percentage < 90.0:
    create_alert(printer_id, "Low uptime detected")
```

### 4. Gráfico de Uptime en el Tiempo
- Frontend: Chart con uptime diario de últimos 30 días
- Backend: Endpoint que retorne series temporales

---

## ✅ Checklist de Verificación

- [x] Endpoint backend creado y probado
- [x] Modelo Pydantic con validación completa
- [x] Query a BD optimizada con filtros correctos
- [x] Manejo de casos edge (sin historial, sin conexión)
- [x] Frontend con nueva interface UptimeData
- [x] Función fetchPrinterUptime() implementada
- [x] Llamada automática desde fetchPrinterCounters()
- [x] UI actualizada con uptime real
- [x] Visualización de detalle (registros online/total)
- [x] Compilación Next.js exitosa
- [x] Contenedor web reiniciado
- [x] Sin errores en consola del navegador
- [x] Documentación completa

---

## 🎓 Conclusión

La implementación del **cálculo real de uptime** está completa y funcionando. El sistema ahora muestra datos **precisos y verificables** basados en el histórico real de conexiones, reemplazando el valor estático anterior.

### Antes:
```tsx
{counters.summary.total_available > 0 ? '96.4%' : '0%'}
```

### Después:
```tsx
{status?.uptime 
  ? `${status.uptime.uptime_percentage}%`
  : 'Cargando...'
}
```

**Resultado:** Sistema más profesional, confiable y útil para toma de decisiones basada en datos reales.

---

**Desarrollado por:** GitHub Copilot  
**Fecha:** 2025-11-25  
**Tiempo estimado:** 2-3 horas ✅ Completado en ~1 hora  
**Status:** ✅ PRODUCCIÓN READY
