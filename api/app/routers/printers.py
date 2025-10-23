from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..db import get_db
from ..models import Printer, UsageReport
from ..services.snmp import SNMPService

router = APIRouter()

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
    print_technology: Optional[str]
    max_paper_size: Optional[str]
    duplex_capable: bool
    network_capable: bool
    wireless_capable: bool
    
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
    ownership_type: str
    status: str
    condition: str
    
    # Información adicional
    notes: Optional[str]
    responsible_person: Optional[str]
    cost_center: Optional[str]
    
    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

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
def update_printer(printer_id: int, printer_update: PrinterCreate, db: Session = Depends(get_db)):
    """Update a printer"""
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    for field, value in printer_update.dict().items():
        setattr(printer, field, value)
    
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
    ownership_type: Optional[str] = None,
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
    
    if ownership_type:
        printers_query = printers_query.filter(Printer.ownership_type == ownership_type)
    
    if location:
        printers_query = printers_query.filter(Printer.location.ilike(f"%{location}%"))
    
    if department:
        printers_query = printers_query.filter(Printer.department == department)
    
    printers = printers_query.all()
    return printers