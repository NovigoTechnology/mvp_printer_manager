from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import concurrent.futures
import ipaddress
import socket

from ..db import get_db
from ..models import Printer, UsageReport, PrinterSupply, StockItem, LeaseContract, ContractPrinter
from ..services.snmp import SNMPService

router = APIRouter()

def generate_sequential_asset_tag(db: Session, used_asset_tags: set) -> str:
    """
    Genera asset tags secuenciales en formato PRT-001, PRT-002, PRT-003, etc.
    
    Args:
        db: Sesión de base de datos
        used_asset_tags: Set de asset tags ya usados en el lote actual
    
    Returns:
        str: Asset tag único en formato PRT-XXX
    """
    # Obtener todos los asset tags existentes que siguen el patrón PRT-XXX
    existing_tags = db.query(Printer.asset_tag).filter(
        Printer.asset_tag.like('PRT-%')
    ).all()
    
    # Extraer números de los asset tags existentes
    existing_numbers = set()
    for tag_tuple in existing_tags:
        tag = tag_tuple[0]
        if tag and len(tag) == 7 and tag.startswith('PRT-'):
            try:
                number = int(tag[4:])  # Extraer los 3 dígitos después de "PRT-"
                existing_numbers.add(number)
            except ValueError:
                continue
    
    # También verificar números usados en el lote actual
    for tag in used_asset_tags:
        if tag and len(tag) == 7 and tag.startswith('PRT-'):
            try:
                number = int(tag[4:])
                existing_numbers.add(number)
            except ValueError:
                continue
    
    # Encontrar el siguiente número disponible (empezando desde 1)
    next_number = 1
    while next_number in existing_numbers:
        next_number += 1
    
    # Generar el asset tag con formato PRT-XXX (3 dígitos con ceros a la izquierda)
    return f"PRT-{next_number:03d}"
    
    # Encontrar el siguiente número disponible empezando desde 1
    next_number = 1
    while next_number in existing_numbers:
        next_number += 1
    
    # Formatear como PRT-XXX (3 dígitos con ceros a la izquierda)
    return f"PRT-{next_number:03d}"

class PrinterCreate(BaseModel):
    # Información básica
    brand: str
    model: str
    serial_number: Optional[str] = None
    asset_tag: str  # Obligatorio y único
    
    # Configuración de red
    ip: str
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    snmp_profile: str = "generic_v2c"
    
    # Características técnicas
    is_color: bool = False
    printer_type: str = "printer"
    print_technology: Optional[str] = None
    max_paper_size: Optional[str] = None
    duplex_capable: bool = False
    network_capable: bool = True
    wireless_capable: bool = False
    
    # Información de ubicación
    sector: Optional[str] = None
    location: Optional[str] = None
    floor: Optional[str] = None
    building: Optional[str] = None
    department: Optional[str] = None
    
    # Información de adquisición
    supplier: Optional[str] = None
    purchase_date: Optional[datetime] = None
    installation_date: Optional[datetime] = None
    warranty_expiry: Optional[datetime] = None
    lease_contract: Optional[str] = None
    
    # Estado y propiedad
    ownership_type: str = "owned"
    status: str = "active"
    condition: str = "good"
    equipment_condition: str = "new"  # new, used - obligatorio
    
    # Contadores iniciales (solo para equipos usados)
    initial_counter_bw: Optional[int] = 0
    initial_counter_color: Optional[int] = 0
    initial_counter_total: Optional[int] = 0
    
    # Información adicional
    notes: Optional[str] = None
    responsible_person: Optional[str] = None
    cost_center: Optional[str] = None
    
    # Información de insumos
    toner_black_code: Optional[str] = None
    toner_cyan_code: Optional[str] = None
    toner_magenta_code: Optional[str] = None
    toner_yellow_code: Optional[str] = None
    other_supplies: Optional[str] = None

class PrinterUpdate(BaseModel):
    # Información básica - todos opcionales para permitir actualizaciones parciales
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    asset_tag: Optional[str] = None
    
    # Configuración de red
    ip: Optional[str] = None
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    snmp_profile: Optional[str] = None
    
    # Características técnicas
    is_color: Optional[bool] = None
    printer_type: Optional[str] = None
    print_technology: Optional[str] = None
    max_paper_size: Optional[str] = None
    duplex_capable: Optional[bool] = None
    network_capable: Optional[bool] = None
    wireless_capable: Optional[bool] = None
    
    # Información de ubicación
    sector: Optional[str] = None
    location: Optional[str] = None
    floor: Optional[str] = None
    building: Optional[str] = None
    department: Optional[str] = None
    
    # Información de adquisición
    supplier: Optional[str] = None
    purchase_date: Optional[datetime] = None
    installation_date: Optional[datetime] = None
    warranty_expiry: Optional[datetime] = None
    lease_contract: Optional[str] = None
    
    # Estado y propiedad
    ownership_type: Optional[str] = None
    status: Optional[str] = None
    condition: Optional[str] = None
    equipment_condition: Optional[str] = None
    
    # Contadores iniciales
    initial_counter_bw: Optional[int] = None
    initial_counter_color: Optional[int] = None
    initial_counter_total: Optional[int] = None
    
    # Información adicional
    notes: Optional[str] = None
    responsible_person: Optional[str] = None
    cost_center: Optional[str] = None
    
    # Información de insumos
    toner_black_code: Optional[str] = None
    toner_cyan_code: Optional[str] = None
    toner_magenta_code: Optional[str] = None
    toner_yellow_code: Optional[str] = None
    other_supplies: Optional[str] = None

class PrinterResponse(BaseModel):
    id: int
    # Información básica
    brand: str
    model: str
    serial_number: Optional[str]
    asset_tag: str  # Obligatorio y único
    
    # Configuración de red
    ip: str
    mac_address: Optional[str]
    hostname: Optional[str]
    snmp_profile: str
    
    # Características técnicas
    is_color: bool
    printer_type: str
    print_technology: Optional[str]
    max_paper_size: Optional[str]
    duplex_capable: Optional[bool]
    network_capable: Optional[bool]
    wireless_capable: Optional[bool]
    
    # Información de ubicación
    sector: Optional[str]
    location: Optional[str]
    floor: Optional[str]
    building: Optional[str]
    department: Optional[str]
    
    # Información de adquisición
    supplier: Optional[str]
    purchase_date: Optional[datetime]
    installation_date: Optional[datetime]
    warranty_expiry: Optional[datetime]
    lease_contract: Optional[str]
    
    # Estado y propiedad
    ownership_type: Optional[str]
    status: str
    condition: str
    equipment_condition: str
    
    # Contadores iniciales (solo para equipos usados)
    initial_counter_bw: Optional[int]
    initial_counter_color: Optional[int]
    initial_counter_total: Optional[int]
    
    # Información adicional
    notes: Optional[str]
    responsible_person: Optional[str]
    cost_center: Optional[str]
    
    # Información de insumos
    toner_black_code: Optional[str]
    toner_cyan_code: Optional[str]
    toner_magenta_code: Optional[str]
    toner_yellow_code: Optional[str]
    other_supplies: Optional[str]
    
    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

@router.get("/available", response_model=List[PrinterResponse])
def list_available_printers(db: Session = Depends(get_db)):
    """List printers that are not currently assigned to any active contract"""
    # Obtener IDs de impresoras que están asignadas a contratos activos
    assigned_printer_ids = db.query(ContractPrinter.printer_id).filter(
        ContractPrinter.is_active == True
    ).distinct().all()
    
    # Extraer los IDs en una lista plana
    assigned_ids = [row[0] for row in assigned_printer_ids] if assigned_printer_ids else []
    
    # Obtener impresoras que NO están en la lista de asignadas
    available_printers = db.query(Printer).filter(
        ~Printer.id.in_(assigned_ids)
    ).all()
    
    return available_printers

@router.get("/", response_model=List[PrinterResponse])
def list_printers(db: Session = Depends(get_db)):
    """List all printers"""
    printers = db.query(Printer).all()
    return printers

@router.post("/", response_model=PrinterResponse)
def create_printer(printer: PrinterCreate, db: Session = Depends(get_db)):
    """Create a new printer"""
    # Check if IP already exists
    existing_ip = db.query(Printer).filter(Printer.ip == printer.ip).first()
    if existing_ip:
        raise HTTPException(status_code=400, detail="Printer with this IP already exists")
    
    # Check if serial number already exists (if provided)
    if printer.serial_number:
        existing_serial = db.query(Printer).filter(Printer.serial_number == printer.serial_number).first()
        if existing_serial:
            raise HTTPException(status_code=400, detail="Printer with this serial number already exists")
    
    # Check if asset tag already exists (now mandatory)
    existing_asset = db.query(Printer).filter(Printer.asset_tag == printer.asset_tag).first()
    if existing_asset:
        raise HTTPException(status_code=400, detail="Printer with this asset tag already exists")
    
    db_printer = Printer(**printer.dict())
    db.add(db_printer)
    db.commit()
    db.refresh(db_printer)
    return db_printer

@router.get("/{printer_id}", response_model=PrinterResponse)
def get_printer(printer_id: int, db: Session = Depends(get_db)):
    """Get a specific printer"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    return printer

@router.put("/{printer_id}", response_model=PrinterResponse)
def update_printer(printer_id: int, printer_update: PrinterUpdate, db: Session = Depends(get_db)):
    """Update a printer"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Validar duplicados solo si se están actualizando esos campos
    update_data = printer_update.dict(exclude_unset=True)
    
    # Verificar IP único si se está actualizando
    if 'ip' in update_data and update_data['ip'] != printer.ip:
        existing_ip = db.query(Printer).filter(
            Printer.ip == update_data['ip'],
            Printer.id != printer_id
        ).first()
        if existing_ip:
            raise HTTPException(status_code=400, detail="Printer with this IP already exists")
    
    # Verificar serial único si se está actualizando
    if 'serial_number' in update_data and update_data['serial_number'] and update_data['serial_number'] != printer.serial_number:
        existing_serial = db.query(Printer).filter(
            Printer.serial_number == update_data['serial_number'],
            Printer.id != printer_id
        ).first()
        if existing_serial:
            raise HTTPException(status_code=400, detail="Printer with this serial number already exists")
    
    # Verificar asset tag único si se está actualizando
    if 'asset_tag' in update_data and update_data['asset_tag'] != printer.asset_tag:
        existing_asset = db.query(Printer).filter(
            Printer.asset_tag == update_data['asset_tag'],
            Printer.id != printer_id
        ).first()
        if existing_asset:
            raise HTTPException(status_code=400, detail="Printer with this asset tag already exists")
    
    # Actualizar solo los campos proporcionados
    for field, value in update_data.items():
        setattr(printer, field, value)
    
    # Actualizar timestamp
    printer.updated_at = datetime.now()
    
    db.commit()
    db.refresh(printer)
    return printer

@router.delete("/{printer_id}")
def delete_printer(printer_id: int, db: Session = Depends(get_db)):
    """Delete a printer"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    # Check for related records
    from ..models import MonthlyCounter, UsageReport
    
    # Check monthly counters
    monthly_counters_count = db.query(MonthlyCounter).filter(MonthlyCounter.printer_id == printer_id).count()
    
    # Check usage reports
    usage_reports_count = db.query(UsageReport).filter(UsageReport.printer_id == printer_id).count()
    
    if monthly_counters_count > 0 or usage_reports_count > 0:
        # Delete related records first
        db.query(MonthlyCounter).filter(MonthlyCounter.printer_id == printer_id).delete()
        db.query(UsageReport).filter(UsageReport.printer_id == printer_id).delete()
    
    # Now delete the printer
    db.delete(printer)
    db.commit()
    
    return {
        "message": "Printer deleted successfully",
        "deleted_monthly_counters": monthly_counters_count,
        "deleted_usage_reports": usage_reports_count
    }

@router.post("/{printer_id}/poll")
def poll_printer(printer_id: int, db: Session = Depends(get_db)):
    """Force SNMP poll for a specific printer"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    try:
        snmp_service = SNMPService()
        data = snmp_service.poll_printer(printer.ip, printer.snmp_profile)
        
        # Create usage report
        usage_report = UsageReport(
            printer_id=printer.id,
            date=datetime.utcnow(),
            pages_printed_mono=data.get('pages_printed_mono', 0),
            pages_printed_color=data.get('pages_printed_color', 0),
            toner_level_black=data.get('toner_level_black'),
            toner_level_cyan=data.get('toner_level_cyan'),
            toner_level_magenta=data.get('toner_level_magenta'),
            toner_level_yellow=data.get('toner_level_yellow'),
            paper_level=data.get('paper_level'),
            status=data.get('status', 'unknown')
        )
        
        db.add(usage_report)
        db.commit()
        
        return {"message": "Printer polled successfully", "data": data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to poll printer: {str(e)}")

@router.get("/{printer_id}/status")
def get_printer_status(printer_id: int, db: Session = Depends(get_db)):
    """Get latest status of a printer"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    latest_report = db.query(UsageReport).filter(
        UsageReport.printer_id == printer_id
    ).order_by(UsageReport.created_at.desc()).first()
    
    if not latest_report:
        return {"message": "No status data available"}
    
    return {
        "printer_id": printer.id,
        "status": latest_report.status,
        "last_update": latest_report.created_at,
        "toner_levels": {
            "black": latest_report.toner_level_black,
            "cyan": latest_report.toner_level_cyan,
            "magenta": latest_report.toner_level_magenta,
            "yellow": latest_report.toner_level_yellow
        },
        "paper_level": latest_report.paper_level,
        "pages_printed": {
            "mono": latest_report.pages_printed_mono,
            "color": latest_report.pages_printed_color
        }
    }

@router.get("/inventory/stats")
def get_inventory_stats(db: Session = Depends(get_db)):
    """Get inventory statistics"""
    from sqlalchemy import func
    
    total_printers = db.query(Printer).count()
    
    # Group by ownership type
    ownership_stats = db.query(
        Printer.ownership_type,
        func.count(Printer.id).label('count')
    ).group_by(Printer.ownership_type).all()
    
    # Group by status
    status_stats = db.query(
        Printer.status,
        func.count(Printer.id).label('count')
    ).group_by(Printer.status).all()
    
    # Group by brand
    brand_stats = db.query(
        Printer.brand,
        func.count(Printer.id).label('count')
    ).group_by(Printer.brand).all()
    
    # Group by condition
    condition_stats = db.query(
        Printer.condition,
        func.count(Printer.id).label('count')
    ).group_by(Printer.condition).all()
    
    # Warranties expiring soon (next 30 days)
    from datetime import datetime, timedelta
    future_date = datetime.utcnow() + timedelta(days=30)
    expiring_warranties = db.query(Printer).filter(
        Printer.warranty_expiry.between(datetime.utcnow(), future_date)
    ).count()
    
    return {
        "total_printers": total_printers,
        "ownership_distribution": [{"type": row.ownership_type, "count": row.count} for row in ownership_stats],
        "status_distribution": [{"status": row.status, "count": row.count} for row in status_stats],
        "brand_distribution": [{"brand": row.brand, "count": row.count} for row in brand_stats],
        "condition_distribution": [{"condition": row.condition, "count": row.count} for row in condition_stats],
        "warranties_expiring_soon": expiring_warranties
    }

@router.get("/inventory/search")
def search_printers(
    query: Optional[str] = None,
    brand: Optional[str] = None,
    status: Optional[str] = None,
    supplier: Optional[str] = None,
    location: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Search printers with multiple filters"""
    printers_query = db.query(Printer)
    
    if query:
        printers_query = printers_query.filter(
            (Printer.brand.ilike(f"%{query}%")) |
            (Printer.model.ilike(f"%{query}%")) |
            (Printer.serial_number.ilike(f"%{query}%")) |
            (Printer.asset_tag.ilike(f"%{query}%")) |
            (Printer.location.ilike(f"%{query}%"))
        )
    
    if brand:
        printers_query = printers_query.filter(Printer.brand == brand)
    
    if status:
        printers_query = printers_query.filter(Printer.status == status)
    
    if supplier and supplier != 'all':
        printers_query = printers_query.filter(Printer.supplier == supplier)
    
    if location:
        printers_query = printers_query.filter(Printer.location.ilike(f"%{location}%"))
    
    if department:
        printers_query = printers_query.filter(Printer.department == department)
    
    printers = printers_query.all()
    return printers

# Printer Supplies Management
class PrinterSupplyCreate(BaseModel):
    stock_item_ids: List[int]

class PrinterSupplyResponse(BaseModel):
    id: int
    printer_id: int
    stock_item_id: int
    is_primary: bool
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/{printer_id}/supplies", response_model=List[PrinterSupplyResponse])
def get_printer_supplies(printer_id: int, db: Session = Depends(get_db)):
    """Obtener todos los insumos asignados a una impresora"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    supplies = db.query(PrinterSupply).filter(
        PrinterSupply.printer_id == printer_id
    ).all()
    
    return supplies

@router.post("/{printer_id}/supplies", response_model=dict)
def update_printer_supplies(
    printer_id: int, 
    supply_data: PrinterSupplyCreate, 
    db: Session = Depends(get_db)
):
    """Actualizar los insumos asignados a una impresora"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    # Verificar que todos los stock_item_ids existen
    for item_id in supply_data.stock_item_ids:
        stock_item = db.query(StockItem).filter(StockItem.id == item_id).first()
        if not stock_item:
            raise HTTPException(
                status_code=404, 
                detail=f"Insumo con ID {item_id} no encontrado"
            )
    
    # Eliminar asignaciones existentes
    db.query(PrinterSupply).filter(
        PrinterSupply.printer_id == printer_id
    ).delete()
    
    # Crear nuevas asignaciones
    new_supplies = []
    for i, item_id in enumerate(supply_data.stock_item_ids):
        printer_supply = PrinterSupply(
            printer_id=printer_id,
            stock_item_id=item_id,
            is_primary=(i == 0)  # El primero se marca como principal
        )
        db.add(printer_supply)
        new_supplies.append(printer_supply)
    
    db.commit()
    
    return {
        "message": "Insumos actualizados exitosamente",
        "printer_id": printer_id,
        "supplies_count": len(supply_data.stock_item_ids)
    }

@router.delete("/{printer_id}/supplies/{supply_id}")
def remove_printer_supply(
    printer_id: int, 
    supply_id: int, 
    db: Session = Depends(get_db)
):
    """Eliminar un insumo específico de una impresora"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    supply = db.query(PrinterSupply).filter(
        PrinterSupply.id == supply_id,
        PrinterSupply.printer_id == printer_id
    ).first()
    
    if not supply:
        raise HTTPException(status_code=404, detail="Asignación de insumo no encontrada")
    
    db.delete(supply)
    db.commit()
    
    return {"message": "Insumo eliminado exitosamente"}

@router.get("/{printer_id}/supplies/available")
def get_available_supplies_for_printer(printer_id: int, db: Session = Depends(get_db)):
    """Obtener insumos disponibles que pueden ser asignados a la impresora"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    # Obtener todos los insumos activos
    all_supplies = db.query(StockItem).filter(StockItem.is_active == True).all()
    
    # Obtener insumos ya asignados a esta impresora
    assigned_supplies = db.query(PrinterSupply.stock_item_id).filter(
        PrinterSupply.printer_id == printer_id
    ).all()
    assigned_ids = [item[0] for item in assigned_supplies]
    
    # Filtrar insumos disponibles (no asignados)
    available_supplies = [
        supply for supply in all_supplies 
        if supply.id not in assigned_ids
    ]
    
    return available_supplies

@router.post("/{printer_id}/sync")
def sync_printer_snmp_data(printer_id: int, db: Session = Depends(get_db)):
    """Sincronizar datos de la impresora vía SNMP"""
    
    # Obtener la impresora
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    try:
        snmp_service = SNMPService()
        
        # Verificar conectividad SNMP
        if not snmp_service.test_connection(printer.ip):
            raise HTTPException(
                status_code=400, 
                detail=f"No se puede conectar vía SNMP a la impresora {printer.ip}"
            )
        
        # Obtener información del dispositivo vía SNMP
        device_info = snmp_service.get_device_info(printer.ip, printer.snmp_profile)
        
        # Actualizar campos si se obtuvieron datos válidos
        updated_fields = []
        
        if device_info.get('serial_number'):
            old_serial = printer.serial_number
            printer.serial_number = device_info['serial_number']
            if old_serial != device_info['serial_number']:
                updated_fields.append(f"serial_number: {old_serial} → {device_info['serial_number']}")
        
        if device_info.get('system_name'):
            old_hostname = printer.hostname
            printer.hostname = device_info['system_name']
            if old_hostname != device_info['system_name']:
                updated_fields.append(f"hostname: {old_hostname} → {device_info['system_name']}")
        
        if device_info.get('system_location'):
            old_location = printer.location
            printer.location = device_info['system_location']
            if old_location != device_info['system_location']:
                updated_fields.append(f"location: {old_location} → {device_info['system_location']}")
        
        if device_info.get('is_color') is not None:
            old_is_color = printer.is_color
            printer.is_color = device_info['is_color']
            if old_is_color != device_info['is_color']:
                color_text = "COLOR" if device_info['is_color'] else "MONOCROMÁTICA"
                old_color_text = "COLOR" if old_is_color else "MONOCROMÁTICA"
                updated_fields.append(f"capacidad: {old_color_text} → {color_text}")
        
        # Actualizar timestamp
        printer.updated_at = datetime.now()
        
        # Guardar cambios
        db.commit()
        db.refresh(printer)
        
        return {
            "success": True,
            "message": "Sincronización SNMP completada exitosamente",
            "updated_fields": updated_fields,
            "device_info": device_info,
            "sync_timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Error durante la sincronización SNMP: {str(e)}"
        )

@router.post("/sync-multiple")
def sync_multiple_printers_snmp_data(printer_ids: List[int], db: Session = Depends(get_db)):
    """Sincronizar datos de múltiples impresoras vía SNMP"""
    
    if not printer_ids:
        raise HTTPException(status_code=400, detail="Debe proporcionar al menos un ID de impresora")
    
    snmp_service = SNMPService()
    results = []
    
    for printer_id in printer_ids:
        printer = db.query(Printer).filter(Printer.id == printer_id).first()
        if not printer:
            results.append({
                "printer_id": printer_id,
                "success": False,
                "error": "Impresora no encontrada"
            })
            continue
        
        try:
            # Verificar conectividad SNMP
            if not snmp_service.test_connection(printer.ip):
                results.append({
                    "printer_id": printer_id,
                    "printer_name": f"{printer.brand} {printer.model}",
                    "ip": printer.ip,
                    "success": False,
                    "error": f"No se puede conectar vía SNMP a {printer.ip}"
                })
                continue
            
            # Obtener información del dispositivo vía SNMP
            device_info = snmp_service.get_device_info(printer.ip, printer.snmp_profile)
            
            # Actualizar campos si se obtuvieron datos válidos
            updated_fields = []
            
            if device_info.get('serial_number'):
                old_serial = printer.serial_number
                printer.serial_number = device_info['serial_number']
                if old_serial != device_info['serial_number']:
                    updated_fields.append(f"serial_number: {old_serial} → {device_info['serial_number']}")
            
            if device_info.get('system_name'):
                old_hostname = printer.hostname
                printer.hostname = device_info['system_name']
                if old_hostname != device_info['system_name']:
                    updated_fields.append(f"hostname: {old_hostname} → {device_info['system_name']}")
            
            if device_info.get('system_location'):
                old_location = printer.location
                printer.location = device_info['system_location']
                if old_location != device_info['system_location']:
                    updated_fields.append(f"location: {old_location} → {device_info['system_location']}")
            
            if device_info.get('is_color') is not None:
                old_is_color = printer.is_color
                printer.is_color = device_info['is_color']
                if old_is_color != device_info['is_color']:
                    color_text = "COLOR" if device_info['is_color'] else "MONOCROMÁTICA"
                    old_color_text = "COLOR" if old_is_color else "MONOCROMÁTICA"
                    updated_fields.append(f"capacidad: {old_color_text} → {color_text}")
            
            # Actualizar timestamp
            printer.updated_at = datetime.now()
            
            results.append({
                "printer_id": printer_id,
                "printer_name": f"{printer.brand} {printer.model}",
                "ip": printer.ip,
                "success": True,
                "updated_fields": updated_fields,
                "sync_timestamp": datetime.now().isoformat()
            })
            
        except Exception as e:
            results.append({
                "printer_id": printer_id,
                "printer_name": f"{printer.brand} {printer.model}",
                "ip": printer.ip,
                "success": False,
                "error": str(e)
            })
    
    # Guardar todos los cambios
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar los cambios: {str(e)}"
        )
    
    success_count = sum(1 for result in results if result["success"])
    total_count = len(results)
    
    return {
        "success": True,
        "message": f"Sincronización completada: {success_count}/{total_count} impresoras actualizadas",
        "results": results,
        "summary": {
            "total": total_count,
            "successful": success_count,
            "failed": total_count - success_count
        }
    }

# ============================================================================
# PRINTER DISCOVERY MODULE - Módulo de Descubrimiento de Impresoras
# ============================================================================

import threading

def ping_icmp(ip: str, timeout: int = 1) -> bool:
    """Verifica si un host responde a ping TCP en varios puertos comunes"""
    try:
        # Lista de puertos comunes para probar conectividad
        common_ports = [80, 443, 161, 9100, 515, 631]  # HTTP, HTTPS, SNMP, IPP, LPR, CUPS
        
        for port in common_ports:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                result = sock.connect_ex((ip, port))
                sock.close()
                
                # Si cualquier puerto responde, el host está "vivo"
                if result == 0:
                    return True
            except:
                continue
        
        return False
        
    except Exception:
        return False

class DiscoveredDevice(BaseModel):
    ip: str
    hostname: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    is_color: Optional[bool] = None
    snmp_profile: Optional[str] = None
    device_info: Optional[Dict[str, Any]] = None
    response_time: Optional[float] = None
    is_printer: bool = False
    ping_response: Optional[bool] = None
    error: Optional[str] = None

class DiscoveryRequest(BaseModel):
    ip_range: Optional[str] = None  # Puede ser "192.168.1.1-192.168.1.100" o "192.168.1.50" o "192.168.1.0/24"
    ip_list: Optional[List[str]] = None  # Lista específica de IPs para verificar (para la fase 2 del descubrimiento)
    timeout: int = 3  # Timeout en segundos para cada IP
    max_workers: int = 50  # Número máximo de threads concurrentes

def ping_host(ip: str, timeout: int = 1) -> bool:
    """Verifica si un host responde a ping TCP en puerto 161 (SNMP)"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, 161))
        sock.close()
        return result == 0
    except:
        return False

def discover_single_device(ip: str, timeout: int = 3) -> DiscoveredDevice:
    """Descubre un dispositivo individual en la IP especificada"""
    import time
    start_time = time.time()
    
    device = DiscoveredDevice(ip=ip)
    
    try:
        # Verificar respuesta a ping ICMP primero
        device.ping_response = ping_icmp(ip, timeout=1)
        
        # Verificar conexión SNMP directamente
        snmp_service = SNMPService()
        if not snmp_service.test_connection(ip):
            device.error = "No responde a SNMP"
            return device
        
        # Obtener hostname si es posible
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            device.hostname = hostname
        except:
            pass
        
        # Usar el servicio SNMP+HTTP combinado para obtener información más completa
        combined_info = snmp_service.get_device_info_combined(ip)
        
        end_time = time.time()
        device.response_time = round(end_time - start_time, 2)
        
        # Verificar si se obtuvo información útil del dispositivo
        has_device_info = (
            combined_info.get('brand') or 
            combined_info.get('model') or 
            combined_info.get('serial_number')
        )
        
        if has_device_info:
            device.is_printer = True
            device.brand = combined_info.get('brand')
            device.model = combined_info.get('model')
            device.serial_number = combined_info.get('serial_number')
            device.is_color = combined_info.get('is_color', False)
            device.snmp_profile = 'combined'  # Nuevo perfil para método combinado
            device.device_info = {
                'success': True,
                'method': combined_info.get('method', 'SNMP+HTTP'),
                'brand': combined_info.get('brand'),
                'model': combined_info.get('model'),
                'serial_number': combined_info.get('serial_number'),
                'status': combined_info.get('status'),
                'is_color': combined_info.get('is_color', False)
            }
        else:
            device.error = 'No se pudo obtener información del dispositivo vía SNMP ni HTTP'
            
    except Exception as e:
        end_time = time.time()
        device.response_time = round(end_time - start_time, 2)
        device.error = f"Error de descubrimiento: {str(e)}"
        
        # Asegurar que ping_response esté establecido incluso en caso de error
        if device.ping_response is None:
            device.ping_response = ping_icmp(ip, timeout=1)
    
    return device

def parse_ip_range(ip_range: str) -> List[str]:
    """Convierte un rango de IPs en una lista de IPs individuales"""
    ips = []
    
    try:
        if '-' in ip_range:
            # Formato: 192.168.1.1-192.168.1.100
            start_ip, end_ip = ip_range.split('-')
            start = ipaddress.IPv4Address(start_ip.strip())
            end = ipaddress.IPv4Address(end_ip.strip())
            
            current = start
            while current <= end:
                ips.append(str(current))
                current += 1
                
        elif '/' in ip_range:
            # Formato CIDR: 192.168.1.0/24
            network = ipaddress.IPv4Network(ip_range, strict=False)
            ips = [str(ip) for ip in network.hosts()]
            
        else:
            # IP individual: 192.168.1.50
            ip = ipaddress.IPv4Address(ip_range.strip())
            ips = [str(ip)]
            
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de IP inválido: {str(e)}"
        )
    
    return ips

# Modelo para requests de ping
class PingRangeRequest(BaseModel):
    ip_range: str
    timeout: Optional[int] = 1  # El timeout se optimiza internamente

# Modelo para respuesta de ping
class PingRangeResponse(BaseModel):
    responsive_ips: List[str]
    total_ips_checked: int
    responsive_count: int
    elapsed_time: float

def ping_single_ip(ip: str, timeout: int = 1) -> bool:
    """
    Verifica rápidamente si una IP tiene servicios de impresora usando timeouts optimizados.
    Usa una estrategia de salida temprana y timeouts agresivos para máxima velocidad.
    
    Args:
        ip: Dirección IP a verificar
        timeout: Timeout base en segundos (se optimiza internamente)
        
    Returns:
        bool: True si la IP tiene servicios típicos de impresoras, False si no
    """
    # Puertos de impresoras en orden de prioridad - balanceando velocidad y precisión
    priority_ports = [
        80,   # HTTP - El más común en impresoras modernas (rápido)
        9100, # Raw printing (HP JetDirect) - Muy común (rápido)
        515,  # LPR (Line Printer Remote) - Impresoras más antiguas
        631,  # IPP (Internet Printing Protocol) - Estándar moderno
        443,  # HTTPS - Impresoras empresariales (más lento)
    ]
    
    # Timeout balanceado: más generoso para evitar perder dispositivos lentos
    balanced_timeout = min(2.0, timeout * 0.8)  # Máximo 2s por puerto, usar 80% del timeout total
    
    # Probar puertos en orden de prioridad con salida temprana
    for port in priority_ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(balanced_timeout)
            result = sock.connect_ex((ip, port))
            sock.close()
            
            if result == 0:
                # ¡Encontramos un puerto abierto! Salir inmediatamente
                return True
                
        except Exception:
            # Error de red, continuar con siguiente puerto
            continue
    
    return False

@router.post("/ping-range", response_model=PingRangeResponse)
def ping_ip_range(request: PingRangeRequest):
    """
    Verifica conectividad básica (ping) para un rango de IPs.
    Esta es la primera fase del descubrimiento optimizado.
    
    Formatos de IP soportados:
    - IP individual: "192.168.1.50"
    - Rango: "192.168.1.1-192.168.1.100"  
    - CIDR: "192.168.1.0/24"
    """
    import time
    
    start_time = time.time()
    
    # Parsear rango de IPs usando la función existente
    try:
        ip_list = parse_ip_range(request.ip_range)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error parseando rango de IPs: {str(e)}"
        )
    
    if len(ip_list) > 2000:  # Límite más alto para ping
        raise HTTPException(
            status_code=400,
            detail="Rango de IPs demasiado grande para ping (máximo 2000 IPs)"
        )
    
    print(f"🏓 Iniciando ping en {len(ip_list)} IPs con timeout de {request.timeout}s...")
    print(f"📋 Rango parseado: {request.ip_range} → {len(ip_list)} IPs")
    if len(ip_list) <= 10:
        print(f"🔍 IPs a verificar: {ip_list}")
    else:
        print(f"🔍 Primer IP: {ip_list[0]}, Última IP: {ip_list[-1]}")
    
    responsive_ips = []
    checked_count = 0
    
    # Usar ThreadPoolExecutor optimizado para ping rápido 
    # Más workers para compensar los timeouts más cortos
    max_workers = min(100, len(ip_list))  # Hasta 100 workers o el número de IPs
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Crear tasks para cada IP
        future_to_ip = {
            executor.submit(ping_single_ip, ip, request.timeout): ip 
            for ip in ip_list
        }
        
        # Procesar resultados conforme van completándose
        for future in concurrent.futures.as_completed(future_to_ip):
            ip = future_to_ip[future]
            checked_count += 1
            try:
                is_responsive = future.result()
                if is_responsive:  # Si el ping fue exitoso
                    responsive_ips.append(ip)
                    print(f"✅ IP responsiva encontrada: {ip}")
                    # Solo log para ranges pequeños para evitar spam
                    if len(ip_list) <= 20:
                        print(f"🔍 Detalles: IP {ip} respondió correctamente")
                        
                # Log progreso cada 100 IPs en ranges grandes, cada 10 en pequeños  
                log_interval = 10 if len(ip_list) <= 50 else 100
                if checked_count % log_interval == 0:
                    print(f"📊 Progreso ping: {checked_count}/{len(ip_list)} IPs verificadas, {len(responsive_ips)} responsivas")
            except Exception as e:
                print(f"❌ Error procesando ping para {ip}: {str(e)}")
                # No agregamos IPs con error a la lista de responsivas
    
    # Ordenar IPs responsivas
    responsive_ips.sort(key=lambda x: ipaddress.IPv4Address(x))
    
    elapsed_time = time.time() - start_time
    
    print(f"✅ Ping completado: {len(responsive_ips)}/{len(ip_list)} IPs responden ({elapsed_time:.2f}s)")
    
    return PingRangeResponse(
        responsive_ips=responsive_ips,
        total_ips_checked=len(ip_list),
        responsive_count=len(responsive_ips),
        elapsed_time=elapsed_time
    )

@router.post("/discover", response_model=List[DiscoveredDevice])
def discover_printers(request: DiscoveryRequest, db: Session = Depends(get_db)):
    """
    Descubre impresoras en un rango de IPs especificado o en una lista específica de IPs
    
    Modos de operación:
    1. ip_range: Para descubrimiento completo con rangos
       - IP individual: "192.168.1.50"
       - Rango: "192.168.1.1-192.168.1.100" 
       - CIDR: "192.168.1.0/24"
       
    2. ip_list: Para descubrimiento optimizado de IPs específicas (segunda fase)
       - Lista de IPs que ya respondieron al ping
    """
    
    # Determinar lista de IPs a procesar
    if request.ip_list is not None:
        # Modo 2: Lista específica de IPs (descubrimiento optimizado fase 2)
        ip_list = request.ip_list
        print(f"🔌 Iniciando descubrimiento SNMP optimizado en {len(ip_list)} IPs que respondieron al ping...")
    elif request.ip_range is not None:
        # Modo 1: Parsear rango de IPs (descubrimiento tradicional)
        try:
            ip_list = parse_ip_range(request.ip_range)
            print(f"🔍 Iniciando descubrimiento tradicional en {len(ip_list)} IPs del rango {request.ip_range}...")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error parseando rango de IPs: {str(e)}"
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Debe especificar 'ip_range' o 'ip_list'"
        )
    
    if len(ip_list) > 1000:
        raise HTTPException(
            status_code=400,
            detail="Lista de IPs demasiado grande (máximo 1000 IPs)"
        )
    
    # Descubrir dispositivos en paralelo
    discovered_devices = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=request.max_workers) as executor:
        # Crear tasks para cada IP
        future_to_ip = {
            executor.submit(discover_single_device, ip, request.timeout): ip 
            for ip in ip_list
        }
        
        # Procesar resultados conforme van completándose
        for future in concurrent.futures.as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                device = future.result()
                discovered_devices.append(device)
            except Exception as e:
                # Crear dispositivo con error
                error_device = DiscoveredDevice(
                    ip=ip,
                    error=f"Error de procesamiento: {str(e)}"
                )
                discovered_devices.append(error_device)
    
    # Ordenar por IP
    discovered_devices.sort(key=lambda x: ipaddress.IPv4Address(x.ip))
    
    # Verificar si alguna de las IPs descubiertas ya existe en la base de datos
    for device in discovered_devices:
        if device.is_printer:
            existing_printer = db.query(Printer).filter(Printer.ip == device.ip).first()
            if existing_printer:
                device.device_info = device.device_info or {}
                device.device_info['existing_in_db'] = True
                device.device_info['existing_printer'] = {
                    'id': existing_printer.id,
                    'asset_tag': existing_printer.asset_tag,
                    'brand': existing_printer.brand,
                    'model': existing_printer.model
                }
    
    print(f"Descubrimiento completado. Encontrados {len([d for d in discovered_devices if d.is_printer])} dispositivos de impresión")
    
    return discovered_devices

@router.post("/discover/validate")
def validate_discovered_printers(
    devices: List[Dict[str, Any]], 
    db: Session = Depends(get_db)
):
    """
    Valida dispositivos descubiertos antes de agregarlos
    Devuelve información detallada sobre conflictos y asset tags propuestos
    Con manejo mejorado de asset tags únicos por lote
    """
    validation_results = []
    used_asset_tags = set()  # Track asset tags used in this validation batch
    
    for device_data in devices:
        conflicts = []
        warnings = []
        
        # Verificar IP duplicada
        existing_by_ip = db.query(Printer).filter(Printer.ip == device_data['ip']).first()
        if existing_by_ip:
            conflicts.append({
                'type': 'ip_duplicate',
                'message': f"IP ya en uso por: {existing_by_ip.brand} {existing_by_ip.model} (Asset: {existing_by_ip.asset_tag})",
                'severity': 'error',
                'existing_printer': {
                    'id': existing_by_ip.id,
                    'asset_tag': existing_by_ip.asset_tag,
                    'brand': existing_by_ip.brand,
                    'model': existing_by_ip.model
                }
            })
        
        # Verificar número de serie duplicado (si existe)
        if device_data.get('serial_number'):
            existing_by_serial = db.query(Printer).filter(
                Printer.serial_number == device_data['serial_number']
            ).first()
            if existing_by_serial:
                conflicts.append({
                    'type': 'serial_duplicate',
                    'message': f"Número de serie ya en uso por: {existing_by_serial.brand} {existing_by_serial.model} (Asset: {existing_by_serial.asset_tag})",
                    'severity': 'error',
                    'existing_printer': {
                        'id': existing_by_serial.id,
                        'asset_tag': existing_by_serial.asset_tag,
                        'brand': existing_by_serial.brand,
                        'model': existing_by_serial.model
                    }
                })
        
        # Generar asset tag secuencial en formato PRT-001, PRT-002, etc.
        proposed_asset_tag = generate_sequential_asset_tag(db, used_asset_tags)
        
        # Marcar este asset tag como usado en esta validación
        used_asset_tags.add(proposed_asset_tag)
        
        # Verificar si hay dispositivos similares en base de datos
        similar_devices = db.query(Printer).filter(
            Printer.brand.ilike(f"%{device_data.get('brand', '')}%"),
            Printer.model.ilike(f"%{device_data.get('model', '')}%")
        ).all()
        
        if similar_devices:
            warnings.append({
                'type': 'similar_device',
                'message': f"Existen {len(similar_devices)} dispositivos similares en inventario",
                'severity': 'warning',
                'similar_count': len(similar_devices)
            })
        
        can_add = len([c for c in conflicts if c['severity'] == 'error']) == 0
        
        validation_result = {
            'device': device_data,
            'proposed_asset_tag': proposed_asset_tag,
            'conflicts': conflicts,
            'warnings': warnings,
            'can_add': can_add,
            'validation_timestamp': datetime.now().isoformat()
        }
        
        validation_results.append(validation_result)
    
    return {
        'validation_results': validation_results,
        'summary': {
            'total_devices': len(validation_results),
            'valid_devices': len([r for r in validation_results if r['can_add']]),
            'invalid_devices': len([r for r in validation_results if not r['can_add']]),
            'devices_with_warnings': len([r for r in validation_results if r['warnings']])
        }
    }

@router.post("/discover/add-selected")
def add_discovered_printers(
    devices: List[Dict[str, Any]], 
    db: Session = Depends(get_db)
):
    """
    Agrega las impresoras seleccionadas del descubrimiento a la base de datos
    Con procesamiento individual para evitar fallos en lote y detección inteligente de cambios de IP
    """
    results = []
    used_asset_tags = set()  # Track asset tags used in this operation
    snmp_service = SNMPService()
    
    for device_data in devices:
        try:
            # 🔍 BÚSQUEDA INTELIGENTE: Verificar si ya existe por serial o MAC
            existing_printer = None
            
            # Primero: Buscar por serial (si viene en device_data)
            serial_to_check = device_data.get('serial_number')
            if serial_to_check and serial_to_check.strip():
                existing_printer = db.query(Printer).filter(
                    Printer.serial_number == serial_to_check
                ).first()
            
            # Segundo: Si no se encontró por serial, buscar por MAC
            if not existing_printer:
                mac_to_check = device_data.get('mac_address')
                if mac_to_check and mac_to_check.strip():
                    existing_printer = db.query(Printer).filter(
                        Printer.mac_address == mac_to_check
                    ).first()
            
            # Tercero: Si no se encontró por serial ni MAC, intentar SNMP
            if not existing_printer:
                existing_printer = snmp_service.identify_printer_by_multiple_criteria(
                    device_data['ip'], 
                    db
                )
            
            if existing_printer:
                # Si ya existe, verificar si cambió la IP
                if existing_printer.ip != device_data['ip']:
                    # Registrar el cambio de IP
                    snmp_service.handle_ip_change(
                        db, 
                        existing_printer, 
                        existing_printer.ip, 
                        device_data['ip'], 
                        "discovery_auto",
                        f"Detectado durante discovery. Serial: {serial_to_check or 'N/A'}"
                    )
                    
                    results.append({
                        'ip': device_data['ip'],
                        'success': True,
                        'message': f"Impresora existente detectada. IP actualizada de {existing_printer.ip} a {device_data['ip']}",
                        'asset_tag': existing_printer.asset_tag,
                        'printer_id': existing_printer.id,
                        'action': 'ip_updated'
                    })
                else:
                    results.append({
                        'ip': device_data['ip'],
                        'success': False,
                        'error': f"La impresora ya existe con Asset Tag: {existing_printer.asset_tag}",
                        'asset_tag': existing_printer.asset_tag,
                        'action': 'duplicate'
                    })
                continue
            
            # Validaciones múltiples
            validation_errors = []
            
            # Validar IP duplicada (para casos donde serial/MAC no coinciden pero IP sí)
            existing_by_ip = db.query(Printer).filter(Printer.ip == device_data['ip']).first()
            if existing_by_ip:
                validation_errors.append(f"Ya existe una impresora diferente con IP {device_data['ip']} (Asset: {existing_by_ip.asset_tag})")
            
            # Si hay errores de validación, reportar y continuar
            if validation_errors:
                results.append({
                    'ip': device_data['ip'],
                    'success': False,
                    'error': '; '.join(validation_errors),
                    'action': 'ip_conflict'
                })
                continue
            
            # Generar asset_tag secuencial en formato PRT-XXX
            asset_tag = generate_sequential_asset_tag(db, used_asset_tags)
            
            # Marcar este asset tag como usado en esta operación
            used_asset_tags.add(asset_tag)
            
            # Crear nueva impresora con valores seguros
            # Manejar serial_number vacío para evitar constraint duplicados
            serial_number = device_data.get('serial_number')
            if not serial_number or serial_number.strip() == '':
                serial_number = None  # NULL en BD en lugar de string vacío
                
            new_printer = Printer(
                brand=device_data.get('brand', 'Desconocido'),
                model=device_data.get('model') or 'Modelo Desconocido',  # Asegurar que nunca sea None
                serial_number=serial_number,
                asset_tag=asset_tag,
                ip=device_data['ip'],
                hostname=device_data.get('hostname'),
                snmp_profile=device_data.get('snmp_profile', 'generic_v2c'),
                is_color=device_data.get('is_color', False),
                printer_type='printer',
                network_capable=True,
                location=device_data.get('location', 'Descubierto automáticamente'),
                status='active',
                condition='good',
                equipment_condition='used'  # Asumimos que es usado ya que fue descubierto
            )
            
            # Procesar cada impresora individualmente
            try:
                db.add(new_printer)
                db.commit()
                
                results.append({
                    'ip': device_data['ip'],
                    'success': True,
                    'printer_id': new_printer.id,
                    'asset_tag': asset_tag,
                    'message': f"Impresora agregada exitosamente como {asset_tag}"
                })
                
            except Exception as commit_error:
                db.rollback()
                results.append({
                    'ip': device_data['ip'],
                    'success': False,
                    'error': f"Error al guardar en BD: {str(commit_error)}"
                })
            
        except Exception as e:
            results.append({
                'ip': device_data.get('ip', 'Unknown'),
                'success': False,
                'error': f"Error preparando impresora: {str(e)}"
            })
    
    success_count = sum(1 for r in results if r['success'])
    total_count = len(results)
    
    return {
        'success': True,
        'message': f"Proceso completado: {success_count}/{total_count} impresoras agregadas",
        'results': results,
        'summary': {
            'total': total_count,
            'successful': success_count,
            'failed': total_count - success_count
        }
    }

@router.get("/{printer_id}/lease-contract")
async def get_printer_lease_contract(printer_id: int, db: Session = Depends(get_db)):
    """
    Obtiene el contrato de arrendamiento activo de una impresora específica
    """
    # Verificar que la impresora existe
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    # Buscar el contrato activo de la impresora
    contract_printer = db.query(ContractPrinter).filter(
        ContractPrinter.printer_id == printer_id,
        ContractPrinter.is_active == True
    ).first()
    
    if not contract_printer:
        return {
            "has_lease_contract": False,
            "message": "Esta impresora no tiene un contrato de arrendamiento activo"
        }
    
    # Obtener los datos del contrato
    contract = db.query(LeaseContract).filter(
        LeaseContract.id == contract_printer.contract_id
    ).first()
    
    if not contract:
        return {
            "has_lease_contract": False,
            "message": "Contrato no encontrado"
        }
    
    return {
        "has_lease_contract": True,
        "contract": {
            "id": contract.id,
            "contract_number": contract.contract_number,
            "contract_name": contract.contract_name,
            "supplier": contract.supplier,
            "ownership_type": "Arrendado",
            "purchase_date": contract.start_date,
            "installation_date": contract_printer.installation_date or contract.start_date,
            "warranty_expiry": contract.end_date,
            "lease_contract": contract.contract_number,
            "cost_center": contract.cost_center
        },
        "contract_details": {
            "start_date": contract.start_date,
            "end_date": contract.end_date,
            "renewal_date": contract.renewal_date,
            "auto_renewal": contract.auto_renewal,
            "contact_person": contract.contact_person,
            "contact_email": contract.contact_email,
            "contact_phone": contract.contact_phone
        }
    }

# Bulk Actions Endpoints
@router.post("/bulk-update-status")
def bulk_update_status(request: dict, db: Session = Depends(get_db)):
    """Actualiza el estado de múltiples impresoras"""
    printer_ids = request.get("printer_ids", [])
    new_status = request.get("status", "")
    
    if not printer_ids or not new_status:
        raise HTTPException(status_code=400, detail="Se requieren printer_ids y status")
    
    if new_status not in ["active", "inactive", "maintenance"]:
        raise HTTPException(status_code=400, detail="Estado no válido")
    
    try:
        # Actualizar todas las impresoras seleccionadas
        updated_count = db.query(Printer).filter(Printer.id.in_(printer_ids)).update(
            {Printer.status: new_status},
            synchronize_session=False
        )
        db.commit()
        
        return {
            "success": True,
            "updated_count": updated_count,
            "message": f"Estado actualizado a '{new_status}' para {updated_count} impresoras"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar estado: {str(e)}")

@router.post("/bulk-update-location")
def bulk_update_location(request: dict, db: Session = Depends(get_db)):
    """Actualiza la ubicación de múltiples impresoras"""
    printer_ids = request.get("printer_ids", [])
    new_location = request.get("location", "")
    
    if not printer_ids or not new_location:
        raise HTTPException(status_code=400, detail="Se requieren printer_ids y location")
    
    try:
        # Actualizar todas las impresoras seleccionadas
        updated_count = db.query(Printer).filter(Printer.id.in_(printer_ids)).update(
            {Printer.location: new_location},
            synchronize_session=False
        )
        db.commit()
        
        return {
            "success": True,
            "updated_count": updated_count,
            "message": f"Ubicación actualizada a '{new_location}' para {updated_count} impresoras"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar ubicación: {str(e)}")

@router.post("/bulk-delete")
def bulk_delete_printers(request: dict, db: Session = Depends(get_db)):
    """Elimina múltiples impresoras y todos sus registros relacionados"""
    from ..models import (
        Incident, UsageReport, MonthlyCounter, CounterReading, 
        InvoiceLine, ContractPrinter
    )
    
    printer_ids = request.get("printer_ids", [])
    
    if not printer_ids:
        raise HTTPException(status_code=400, detail="Se requiere printer_ids")
    
    try:
        # Verificar que las impresoras existan
        existing_printers = db.query(Printer).filter(Printer.id.in_(printer_ids)).all()
        existing_ids = [p.id for p in existing_printers]
        
        if not existing_ids:
            return {
                "success": True,
                "deleted_count": 0,
                "message": "No se encontraron impresoras para eliminar"
            }
        
        # Eliminar registros relacionados en orden correcto (para evitar foreign key constraints)
        
        # 1. Eliminar incidentes
        incidents_deleted = db.query(Incident).filter(Incident.printer_id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        
        # 2. Eliminar reportes de uso
        usage_reports_deleted = db.query(UsageReport).filter(UsageReport.printer_id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        
        # 3. Eliminar contadores mensuales
        monthly_counters_deleted = db.query(MonthlyCounter).filter(MonthlyCounter.printer_id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        
        # 4. Eliminar lecturas de contador
        counter_readings_deleted = db.query(CounterReading).filter(CounterReading.printer_id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        
        # 5. Eliminar líneas de factura
        invoice_lines_deleted = db.query(InvoiceLine).filter(InvoiceLine.printer_id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        
        # 6. Eliminar relaciones con contratos
        contract_printers_deleted = db.query(ContractPrinter).filter(ContractPrinter.printer_id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        
        # 7. Finalmente, eliminar las impresoras
        printers_deleted = db.query(Printer).filter(Printer.id.in_(existing_ids)).delete(
            synchronize_session=False
        )
        
        db.commit()
        
        return {
            "success": True,
            "deleted_count": printers_deleted,
            "related_records_deleted": {
                "incidents": incidents_deleted,
                "usage_reports": usage_reports_deleted,
                "monthly_counters": monthly_counters_deleted,
                "counter_readings": counter_readings_deleted,
                "invoice_lines": invoice_lines_deleted,
                "contract_printers": contract_printers_deleted
            },
            "message": f"{printers_deleted} impresoras eliminadas exitosamente junto con {incidents_deleted + usage_reports_deleted + monthly_counters_deleted + counter_readings_deleted + invoice_lines_deleted + contract_printers_deleted} registros relacionados"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar impresoras: {str(e)}")

# ============================================================================
# ENDPOINTS PARA GESTIÓN DE HISTORIAL DE IPs
# ============================================================================

@router.get("/{printer_id}/ip-history")
def get_printer_ip_history(
    printer_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene el historial de cambios de IP de una impresora
    """
    from ..models import PrinterIPHistory
    
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    ip_history = db.query(PrinterIPHistory)\
        .filter(PrinterIPHistory.printer_id == printer_id)\
        .order_by(PrinterIPHistory.changed_at.desc())\
        .all()
    
    return {
        "printer_id": printer_id,
        "asset_tag": printer.asset_tag,
        "brand": printer.brand,
        "model": printer.model,
        "current_ip": printer.ip,
        "history": [
            {
                "id": record.id,
                "old_ip": record.old_ip,
                "new_ip": record.new_ip,
                "changed_at": record.changed_at.isoformat() if record.changed_at else None,
                "changed_by": record.changed_by,
                "reason": record.reason,
                "notes": record.notes
            }
            for record in ip_history
        ]
    }

class UpdateIPRequest(BaseModel):
    new_ip: str
    reason: str = "manual_update"
    notes: Optional[str] = None

@router.post("/{printer_id}/update-ip")
def manually_update_printer_ip(
    printer_id: int,
    request: UpdateIPRequest,
    db: Session = Depends(get_db)
):
    """
    Actualiza manualmente la IP de una impresora y registra el cambio
    """
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    # Validar que la nueva IP no esté en uso por otra impresora
    existing = db.query(Printer).filter(
        Printer.ip == request.new_ip,
        Printer.id != printer_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"La IP {request.new_ip} ya está en uso por la impresora {existing.asset_tag}"
        )
    
    old_ip = printer.ip
    
    # Usar el servicio SNMP para manejar el cambio
    snmp_service = SNMPService()
    try:
        snmp_service.handle_ip_change(
            db, 
            printer, 
            old_ip, 
            request.new_ip, 
            request.reason,
            request.notes
        )
        
        return {
            "success": True,
            "message": f"IP actualizada exitosamente de {old_ip} a {request.new_ip}",
            "printer_id": printer_id,
            "asset_tag": printer.asset_tag,
            "old_ip": old_ip,
            "new_ip": request.new_ip
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar IP: {str(e)}")