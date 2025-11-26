# 🔍 Detección Automática de Cambio de Cartucho - Análisis y Propuesta

**Fecha:** 25 de Noviembre, 2025  
**Sistema:** DRYPIX Medical Printers  
**Objetivo:** Detectar automáticamente cuándo se cambia un cartucho de films

---

## 📊 ESTADO ACTUAL

### Flujo Manual Actual:

```
1. Técnico cambia cartucho físicamente en DRYPIX
2. DRYPIX resetea su contador interno (100 films disponibles)
3. ❌ Sistema NO detecta el cambio automáticamente
4. ✋ Usuario debe ir a UI y registrar manualmente:
   - Click en botón "+" de la bandeja
   - Completar formulario (cantidad, lote, proveedor)
   - Submit → POST /medical-printers/refills
```

### Problema:
- **100% dependiente del usuario**
- Si usuario olvida registrar → **datos incompletos**
- No hay trazabilidad automática
- Dificulta control de inventario

---

## 🎯 SOLUCIONES PROPUESTAS

### Opción 1: Detección por Incremento de Disponibles ⭐⭐⭐

**Principio:** Si los films disponibles AUMENTAN significativamente entre dos snapshots, se detectó un cambio de cartucho.

#### Lógica de Detección:

```python
# En cada polling (7:00 AM diario)
for tray in ['Tray1', 'Tray2', 'Tray3', 'Tray4', 'Tray5']:
    disponibles_hoy = snapshot_actual[tray]['available']
    disponibles_ayer = snapshot_anterior[tray]['available']
    
    # REGLA: Si disponibles aumentaron > 50 films
    if disponibles_hoy > disponibles_ayer + 50:
        # ¡CAMBIO DE CARTUCHO DETECTADO!
        auto_registrar_cambio_cartucho(
            printer_id=printer.id,
            tray_name=tray,
            films_antes=disponibles_ayer,
            films_despues=disponibles_hoy,
            films_agregados=disponibles_hoy - disponibles_ayer
        )
```

#### Escenarios:

**Caso A: Cartucho Completo Nuevo**
```
Ayer:  Tray1 = 15 disponibles, 85 impresos
Hoy:   Tray1 = 100 disponibles, 0 impresos
       ↑ Incremento: +85 films
       ✅ DETECCIÓN: Cartucho nuevo 100% cargado
```

**Caso B: Cartucho Parcialmente Usado**
```
Ayer:  Tray2 = 5 disponibles, 95 impresos
Hoy:   Tray2 = 70 disponibles, 30 impresos
       ↑ Incremento: +65 films
       ✅ DETECCIÓN: Cartucho usado (30 films ya gastados)
```

**Caso C: Uso Normal (NO es cambio)**
```
Ayer:  Tray3 = 80 disponibles, 20 impresos
Hoy:   Tray3 = 75 disponibles, 25 impresos
       ↑ Decremento: -5 films (uso normal)
       ❌ NO SE DETECTA (es consumo diario)
```

#### Ventajas:
- ✅ 100% automático
- ✅ No requiere intervención del usuario
- ✅ Funciona con el polling existente
- ✅ Histórico completo automático
- ✅ Fácil de implementar

#### Desventajas:
- ⚠️ Umbral de 50 films es arbitrario (ajustable)
- ⚠️ Si cambian cartucho entre snapshots múltiples veces, solo detecta el último

---

### Opción 2: Detección por Reset de Contador Impreso ⭐⭐

**Principio:** Si el contador de impresos BAJA (en lugar de subir), hubo reset = cambio de cartucho.

#### Lógica:

```python
impresos_hoy = snapshot_actual[tray]['printed']
impresos_ayer = snapshot_anterior[tray]['printed']

# DRYPIX resetea contador al cambiar cartucho
if impresos_hoy < impresos_ayer:
    # ¡RESET DETECTADO!
    detectar_cambio_cartucho()
```

#### Escenario:

```
Ayer:  Tray1 = 10 disponibles, 90 impresos
Hoy:   Tray1 = 100 disponibles, 0 impresos
       ↑ Impresos bajó de 90 → 0 (RESET)
       ✅ DETECCIÓN: Cambio de cartucho
```

#### Ventajas:
- ✅ Detección muy precisa (reset definitivo)
- ✅ No falsos positivos

#### Desventajas:
- ⚠️ **PROBLEMA:** DRYPIX NO resetea el contador de impresos
- ⚠️ El contador es acumulativo (siempre sube)
- ❌ Esta opción NO funciona con DRYPIX

---

### Opción 3: Detección Híbrida (Disponibles + Raw Data) ⭐⭐⭐⭐

**Principio:** Combina incremento de disponibles + análisis del JSON raw_data para confirmar.

#### Lógica:

```python
# Paso 1: Detectar incremento significativo
if disponibles_hoy > disponibles_ayer + 50:
    
    # Paso 2: Verificar en raw_data si cambió el estado de la bandeja
    raw_ayer = json.loads(snapshot_anterior.raw_data)
    raw_hoy = json.loads(snapshot_actual.raw_data)
    
    bandeja_vacia_ayer = (raw_ayer['trays'][tray]['available'] == 0)
    bandeja_llena_hoy = (raw_hoy['trays'][tray]['available'] >= 90)
    
    if bandeja_vacia_ayer and bandeja_llena_hoy:
        # ¡CONFIRMADO! Bandeja estaba vacía, ahora llena
        registrar_cambio_cartucho(confidence='high')
    else:
        # Incremento detectado pero no cambio total
        registrar_cambio_cartucho(confidence='medium')
```

#### Ventajas:
- ✅ Mayor precisión
- ✅ Niveles de confianza (high/medium/low)
- ✅ Menos falsos positivos

#### Desventajas:
- ⚠️ Más complejo de implementar
- ⚠️ Requiere parsear JSON en cada snapshot

---

### Opción 4: Notificación al Usuario para Confirmar ⭐⭐⭐

**Principio:** Sistema detecta posible cambio, notifica al usuario para que confirme.

#### Flujo:

```
1. Sistema detecta incremento de films (Opción 1)
2. Genera notificación pendiente:
   "⚠️ Se detectó posible cambio de cartucho en Tray1 (DRYPIX #227)"
3. Usuario ve notificación en dashboard
4. Usuario confirma:
   a) SÍ → Sistema registra automáticamente con datos detectados
   b) NO → Sistema ignora la detección
   c) Usuario puede editar datos (lote, proveedor, etc.)
```

#### Ventajas:
- ✅ Balance entre automático y manual
- ✅ Usuario puede corregir datos
- ✅ Mayor precisión (confirmación humana)
- ✅ Mantiene trazabilidad

#### Desventajas:
- ⚠️ Requiere interacción del usuario
- ⚠️ Más complejo en UI (sistema de notificaciones)

---

## 🔧 IMPLEMENTACIÓN RECOMENDADA

### Solución Híbrida (Opción 1 + Opción 4):

```
Detección Automática con Confirmación Opcional
```

#### Fase 1: Detección Automática (Backend)

**Archivo:** `api/app/workers/polling.py`

```python
def detect_cartridge_changes(db, printer_id, current_snapshot, previous_snapshot):
    """
    Detecta cambios de cartucho comparando snapshots consecutivos
    """
    if not previous_snapshot:
        return []
    
    changes_detected = []
    current_data = json.loads(current_snapshot.raw_data)
    previous_data = json.loads(previous_snapshot.raw_data)
    
    THRESHOLD = 50  # Films mínimos para considerar cambio
    
    for tray_name in current_data['trays'].keys():
        current_available = current_data['trays'][tray_name]['available']
        previous_available = previous_data['trays'][tray_name]['available']
        
        # Detectar incremento significativo
        increment = current_available - previous_available
        
        if increment > THRESHOLD:
            changes_detected.append({
                'tray_name': tray_name,
                'previous_available': previous_available,
                'current_available': current_available,
                'films_added': increment,
                'detection_confidence': 'high' if increment >= 80 else 'medium',
                'detected_at': datetime.utcnow(),
                'requires_confirmation': False  # Cambiar a True si quieres confirmación
            })
    
    return changes_detected

# En poll_medical_printers(), después de guardar snapshot:
changes = detect_cartridge_changes(db, printer.id, counter_record, previous_snapshot)

for change in changes:
    if not change['requires_confirmation']:
        # Auto-registrar cambio de cartucho
        refill = MedicalPrinterRefill(
            printer_id=printer.id,
            tray_name=change['tray_name'],
            cartridge_quantity=1,
            plates_per_cartridge=change['films_added'],
            total_plates_added=change['films_added'],
            counter_before_refill=100 - change['previous_available'],
            available_before_refill=change['previous_available'],
            counter_after_refill=100 - change['current_available'],
            available_after_refill=change['current_available'],
            loaded_by='AUTO-DETECT',
            notes=f"Cambio detectado automáticamente. Incremento: +{change['films_added']} films. Confianza: {change['detection_confidence']}",
            refill_date=change['detected_at']
        )
        db.add(refill)
        db.commit()
        print(f"✅ Auto-registered cartridge change for {printer.id} - {change['tray_name']}")
    else:
        # Crear notificación pendiente para usuario
        notification = CartridgeChangeNotification(
            printer_id=printer.id,
            tray_name=change['tray_name'],
            films_added=change['films_added'],
            detected_at=change['detected_at'],
            status='pending_confirmation'
        )
        db.add(notification)
        db.commit()
        print(f"⚠️ Cartridge change detected, awaiting user confirmation")
```

#### Fase 2: Tabla de Notificaciones (Opcional)

```python
# api/app/models.py

class CartridgeChangeNotification(Base):
    """
    Notificaciones de cambios de cartucho detectados automáticamente
    que requieren confirmación del usuario
    """
    __tablename__ = "cartridge_change_notifications"
    
    id = Column(Integer, primary_key=True)
    printer_id = Column(Integer, ForeignKey("printers.id"))
    tray_name = Column(String(50))
    films_added = Column(Integer)
    detected_at = Column(DateTime, server_default=func.now())
    status = Column(String(20))  # pending_confirmation, confirmed, rejected
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)
    refill_id = Column(Integer, ForeignKey("medical_printer_refills.id"))
    
    printer = relationship("Printer")
    refill = relationship("MedicalPrinterRefill")
```

#### Fase 3: Endpoints para Confirmación

```python
# api/app/routers/medical_printers.py

@router.get("/cartridge-notifications")
async def get_pending_notifications(db: Session = Depends(get_db)):
    """
    Obtener notificaciones pendientes de cambios de cartucho
    """
    notifications = db.query(CartridgeChangeNotification).filter(
        CartridgeChangeNotification.status == 'pending_confirmation'
    ).order_by(desc(CartridgeChangeNotification.detected_at)).all()
    
    return notifications

@router.post("/cartridge-notifications/{notification_id}/confirm")
async def confirm_cartridge_change(
    notification_id: int,
    confirmed_by: str,
    batch_number: Optional[str] = None,
    supplier: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Confirmar un cambio de cartucho detectado automáticamente
    """
    notification = db.query(CartridgeChangeNotification).filter(
        CartridgeChangeNotification.id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Crear registro de recarga
    refill = MedicalPrinterRefill(
        printer_id=notification.printer_id,
        tray_name=notification.tray_name,
        cartridge_quantity=1,
        plates_per_cartridge=notification.films_added,
        total_plates_added=notification.films_added,
        loaded_by=confirmed_by,
        batch_number=batch_number,
        supplier=supplier,
        notes=f"Confirmado manualmente. Detectado automáticamente el {notification.detected_at}",
        refill_date=notification.detected_at
    )
    
    db.add(refill)
    db.commit()
    db.refresh(refill)
    
    # Actualizar notificación
    notification.status = 'confirmed'
    notification.confirmed_by = confirmed_by
    notification.confirmed_at = datetime.utcnow()
    notification.refill_id = refill.id
    db.commit()
    
    return {"success": True, "refill_id": refill.id}
```

---

## 🎨 UI - Notificaciones Pendientes

### Dashboard Widget:

```tsx
// web/app/medical-printers/page.tsx

const [pendingNotifications, setPendingNotifications] = useState<any[]>([])

useEffect(() => {
  fetchPendingNotifications()
}, [])

const fetchPendingNotifications = async () => {
  const response = await fetch(`${API_BASE}/medical-printers/cartridge-notifications`)
  const data = await response.json()
  setPendingNotifications(data)
}

// UI
{pendingNotifications.length > 0 && (
  <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <h3 className="text-yellow-900 font-semibold mb-2">
      ⚠️ Cambios de Cartucho Detectados ({pendingNotifications.length})
    </h3>
    {pendingNotifications.map(notif => (
      <div key={notif.id} className="flex justify-between items-center p-3 bg-white rounded mb-2">
        <div>
          <p className="font-medium">
            {notif.printer.brand} {notif.printer.model} - {notif.tray_name}
          </p>
          <p className="text-sm text-gray-600">
            +{notif.films_added} films detectados el {formatDateTime(notif.detected_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => confirmChange(notif.id)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            ✓ Confirmar
          </button>
          <button
            onClick={() => rejectChange(notif.id)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            ✗ Rechazar
          </button>
        </div>
      </div>
    ))}
  </div>
)}
```

---

## 📊 COMPARATIVA DE OPCIONES

| Opción | Automatización | Precisión | Complejidad | Tiempo Desarrollo |
|--------|----------------|-----------|-------------|-------------------|
| 1. Incremento Disponibles | ⭐⭐⭐ Alta | ⭐⭐⭐ Buena | ⭐⭐ Baja | 2-3 horas |
| 2. Reset Contador | ⭐⭐⭐ Alta | ⭐⭐⭐⭐ Excelente | ⭐⭐ Baja | ❌ No funciona DRYPIX |
| 3. Híbrida Raw Data | ⭐⭐⭐ Alta | ⭐⭐⭐⭐ Excelente | ⭐⭐⭐ Media | 4-5 horas |
| 4. Con Confirmación | ⭐⭐ Media | ⭐⭐⭐⭐⭐ Perfecta | ⭐⭐⭐⭐ Alta | 6-8 horas |
| **Recomendada (1+4)** | **⭐⭐⭐ Alta** | **⭐⭐⭐⭐ Excelente** | **⭐⭐⭐ Media** | **5-6 horas** |

---

## ✅ IMPLEMENTACIÓN MÍNIMA (Quick Win)

Si quieres algo **rápido y funcional**, implementa solo la **Opción 1 en modo automático**:

### Código Mínimo:

```python
# En api/app/workers/polling.py, línea 135 (después de guardar snapshot)

# Obtener snapshot anterior
previous = db.query(MedicalPrinterCounter).filter(
    MedicalPrinterCounter.printer_id == printer.id,
    MedicalPrinterCounter.id < counter_record.id
).order_by(desc(MedicalPrinterCounter.timestamp)).first()

if previous:
    prev_data = json.loads(previous.raw_data)
    curr_data = json.loads(counter_record.raw_data)
    
    for tray in curr_data['trays'].keys():
        prev_avail = prev_data['trays'][tray]['available']
        curr_avail = curr_data['trays'][tray]['available']
        
        if curr_avail > prev_avail + 50:  # Umbral de 50 films
            # Auto-registrar cambio
            refill = MedicalPrinterRefill(
                printer_id=printer.id,
                tray_name=tray,
                cartridge_quantity=1,
                plates_per_cartridge=curr_avail - prev_avail,
                total_plates_added=curr_avail - prev_avail,
                counter_before_refill=100 - prev_avail,
                available_before_refill=prev_avail,
                counter_after_refill=100 - curr_avail,
                available_after_refill=curr_avail,
                loaded_by='SISTEMA',
                notes=f'Auto-detectado: +{curr_avail - prev_avail} films'
            )
            db.add(refill)
    
    db.commit()
```

**Tiempo:** ~1 hora  
**Resultado:** Detección automática funcionando

---

## 🎯 RECOMENDACIÓN FINAL

Para un balance entre **efectividad** y **tiempo de desarrollo**:

### Fase 1 (Inmediata): Opción 1 - Detección Automática Simple
- ✅ 2-3 horas de desarrollo
- ✅ Resuelve 80% de los casos
- ✅ Sin intervención del usuario
- ✅ Se integra con polling existente

### Fase 2 (Futura): Agregar Confirmación Manual
- ⏳ Implementar cuando se necesite mayor control
- ⏳ Dashboard de notificaciones
- ⏳ Usuario puede editar lote/proveedor

---

**¿Quieres que implemente la Opción 1 (detección automática) ahora?** 🚀
