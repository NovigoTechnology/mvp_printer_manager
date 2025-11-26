from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from ..db import get_db
from ..models import TonerRequest, Printer, Incident

router = APIRouter()

# Pydantic models
class TonerRequestCreate(BaseModel):
    printer_id: int
    toner_black_requested: bool = False
    toner_black_quantity: int = 1
    toner_cyan_requested: bool = False
    toner_cyan_quantity: int = 1
    toner_magenta_requested: bool = False
    toner_magenta_quantity: int = 1
    toner_yellow_requested: bool = False
    toner_yellow_quantity: int = 1
    toner_black_code: Optional[str] = None
    toner_cyan_code: Optional[str] = None
    toner_magenta_code: Optional[str] = None
    toner_yellow_code: Optional[str] = None
    other_supplies_requested: Optional[str] = None
    justification: Optional[str] = None
    notes: Optional[str] = None
    requested_by: str
    department: Optional[str] = None
    cost_center: Optional[str] = None
    priority: str = "normal"
    supply_type: str = "insumos"  # insumos, servicio

class TonerRequestUpdate(BaseModel):
    status: Optional[str] = None
    approved_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None

class TonerRequestResponse(BaseModel):
    id: int
    printer_id: int
    incident_id: Optional[int]
    request_date: datetime
    status: str
    priority: str
    supply_type: str
    toner_black_requested: bool
    toner_black_quantity: int
    toner_cyan_requested: bool
    toner_cyan_quantity: int
    toner_magenta_requested: bool
    toner_magenta_quantity: int
    toner_yellow_requested: bool
    toner_yellow_quantity: int
    toner_black_code: Optional[str]
    toner_cyan_code: Optional[str]
    toner_magenta_code: Optional[str]
    toner_yellow_code: Optional[str]
    other_supplies_requested: Optional[str]
    justification: Optional[str]
    notes: Optional[str]
    requested_by: str
    department: Optional[str]
    cost_center: Optional[str]
    approved_date: Optional[datetime]
    ordered_date: Optional[datetime]
    delivered_date: Optional[datetime]
    cancelled_date: Optional[datetime]
    approved_by: Optional[str]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Información de la impresora
    printer_brand: Optional[str] = None
    printer_model: Optional[str] = None
    printer_serial_number: Optional[str] = None
    printer_asset_tag: Optional[str] = None
    printer_location: Optional[str] = None
    
    # Información del incidente relacionado
    incident_status: Optional[str] = None
    incident_title: Optional[str] = None

    class Config:
        from_attributes = True

class PrinterSearchResult(BaseModel):
    id: int
    brand: str
    model: str
    serial_number: Optional[str]
    asset_tag: str
    location: Optional[str]
    department: Optional[str]
    toner_black_code: Optional[str]
    toner_cyan_code: Optional[str]
    toner_magenta_code: Optional[str]
    toner_yellow_code: Optional[str]
    status: str

    class Config:
        from_attributes = True

@router.post("/toner-requests", response_model=TonerRequestResponse)
def create_toner_request(request: TonerRequestCreate, db: Session = Depends(get_db)):
    """Crear un nuevo pedido de tóner"""
    
    # Verificar que la impresora existe
    printer = db.query(Printer).filter(Printer.id == request.printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    # Usar códigos de tóner de la impresora si no se especifican
    toner_black_code = request.toner_black_code or printer.toner_black_code
    toner_cyan_code = request.toner_cyan_code or printer.toner_cyan_code
    toner_magenta_code = request.toner_magenta_code or printer.toner_magenta_code
    toner_yellow_code = request.toner_yellow_code or printer.toner_yellow_code
    
    # Crear el pedido
    db_request = TonerRequest(
        printer_id=request.printer_id,
        supply_type=request.supply_type,
        toner_black_requested=request.toner_black_requested,
        toner_black_quantity=request.toner_black_quantity,
        toner_cyan_requested=request.toner_cyan_requested,
        toner_cyan_quantity=request.toner_cyan_quantity,
        toner_magenta_requested=request.toner_magenta_requested,
        toner_magenta_quantity=request.toner_magenta_quantity,
        toner_yellow_requested=request.toner_yellow_requested,
        toner_yellow_quantity=request.toner_yellow_quantity,
        toner_black_code=toner_black_code,
        toner_cyan_code=toner_cyan_code,
        toner_magenta_code=toner_magenta_code,
        toner_yellow_code=toner_yellow_code,
        other_supplies_requested=request.other_supplies_requested,
        justification=request.justification,
        notes=request.notes,
        requested_by=request.requested_by,
        department=request.department,
        cost_center=request.cost_center,
        priority=request.priority
    )
    
    # Crear incidente automáticamente
    supplies_list = []
    if request.toner_black_requested:
        supplies_list.append(f"Tóner Negro (x{request.toner_black_quantity})")
    if request.toner_cyan_requested:
        supplies_list.append(f"Tóner Cian (x{request.toner_cyan_quantity})")
    if request.toner_magenta_requested:
        supplies_list.append(f"Tóner Magenta (x{request.toner_magenta_quantity})")
    if request.toner_yellow_requested:
        supplies_list.append(f"Tóner Amarillo (x{request.toner_yellow_quantity})")
    if request.other_supplies_requested:
        supplies_list.append(f"Otros: {request.other_supplies_requested}")
    
    incident_title = f"Solicitud de {'Servicio' if request.supply_type == 'servicio' else 'Insumos'} - {printer.brand} {printer.model}"
    incident_description = f"""Solicitud de {request.supply_type} generada automáticamente.

Impresora: {printer.brand} {printer.model} (Asset: {printer.asset_tag})
Ubicación: {printer.location or 'No especificada'}
Solicitado por: {request.requested_by}
Departamento: {request.department or 'No especificado'}

Insumos solicitados:
{chr(10).join('- ' + item for item in supplies_list)}

Justificación: {request.justification or 'No especificada'}
Notas adicionales: {request.notes or 'Ninguna'}"""
    
    # Determinar el tipo de incidente basado en supply_type
    incident_type = "solicitud_insumos" if request.supply_type == 'insumos' else "solicitud_servicio"
    
    # Crear el incidente relacionado
    incident = Incident(
        printer_id=request.printer_id,
        title=incident_title,
        description=incident_description,
        status="open",
        priority=request.priority if request.priority in ["low", "medium", "high", "critical"] else "medium",
        incident_type=incident_type
    )
    
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    # Asociar el incidente con la solicitud
    db_request.incident_id = incident.id
    
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    
    # Obtener la información de la impresora para la respuesta
    response_data = TonerRequestResponse.from_orm(db_request)
    response_data.printer_brand = printer.brand
    response_data.printer_model = printer.model
    response_data.printer_serial_number = printer.serial_number
    response_data.printer_asset_tag = printer.asset_tag
    response_data.printer_location = printer.location
    
    return response_data

@router.get("/toner-requests", response_model=List[TonerRequestResponse])
def get_toner_requests(
    skip: int = 0, 
    limit: int = 100,
    status: Optional[str] = None,
    printer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Obtener lista de pedidos de tóner con filtros opcionales"""
    
    query = db.query(TonerRequest).join(Printer)
    
    if status:
        query = query.filter(TonerRequest.status == status)
    
    if printer_id:
        query = query.filter(TonerRequest.printer_id == printer_id)
    
    requests = query.offset(skip).limit(limit).all()
    
    # Agregar información de impresora e incidente a cada pedido
    result = []
    for req in requests:
        response_data = TonerRequestResponse.from_orm(req)
        response_data.printer_brand = req.printer.brand
        response_data.printer_model = req.printer.model
        response_data.printer_serial_number = req.printer.serial_number
        response_data.printer_asset_tag = req.printer.asset_tag
        response_data.printer_location = req.printer.location
        
        # Agregar información del incidente si existe
        if req.incident_id:
            incident = db.query(Incident).filter(Incident.id == req.incident_id).first()
            if incident:
                response_data.incident_status = incident.status
                response_data.incident_title = incident.title
        
        result.append(response_data)
    
    return result

@router.get("/toner-requests/{request_id}", response_model=TonerRequestResponse)
def get_toner_request(request_id: int, db: Session = Depends(get_db)):
    """Obtener un pedido de tóner específico"""
    
    request = db.query(TonerRequest).filter(TonerRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    response_data = TonerRequestResponse.from_orm(request)
    response_data.printer_brand = request.printer.brand
    response_data.printer_model = request.printer.model
    response_data.printer_serial_number = request.printer.serial_number
    response_data.printer_asset_tag = request.printer.asset_tag
    response_data.printer_location = request.printer.location
    
    return response_data

@router.put("/toner-requests/{request_id}", response_model=TonerRequestResponse)
def update_toner_request(request_id: int, update_data: TonerRequestUpdate, db: Session = Depends(get_db)):
    """Actualizar un pedido de tóner (cambiar estado, aprobar, etc.)"""
    
    request = db.query(TonerRequest).filter(TonerRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    # Actualizar campos
    if update_data.status is not None:
        request.status = update_data.status
        # Actualizar fechas según el estado
        if update_data.status == "approved":
            request.approved_date = datetime.now()
        elif update_data.status == "ordered":
            request.ordered_date = datetime.now()
        elif update_data.status == "delivered":
            request.delivered_date = datetime.now()
        elif update_data.status == "cancelled":
            request.cancelled_date = datetime.now()
    
    if update_data.approved_by is not None:
        request.approved_by = update_data.approved_by
    
    if update_data.rejection_reason is not None:
        request.rejection_reason = update_data.rejection_reason
    
    if update_data.notes is not None:
        request.notes = update_data.notes
    
    db.commit()
    db.refresh(request)
    
    response_data = TonerRequestResponse.from_orm(request)
    response_data.printer_brand = request.printer.brand
    response_data.printer_model = request.printer.model
    response_data.printer_serial_number = request.printer.serial_number
    response_data.printer_asset_tag = request.printer.asset_tag
    response_data.printer_location = request.printer.location
    
    return response_data

@router.get("/printers/search", response_model=List[PrinterSearchResult])
def search_printers(
    asset_tag: Optional[str] = None,
    serial_number: Optional[str] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
    location: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Buscar impresoras por diferentes criterios"""
    
    query = db.query(Printer)
    
    # Filtros exactos
    if asset_tag:
        query = query.filter(Printer.asset_tag.ilike(f"%{asset_tag}%"))
    
    if serial_number:
        query = query.filter(Printer.serial_number.ilike(f"%{serial_number}%"))
    
    if brand:
        query = query.filter(Printer.brand.ilike(f"%{brand}%"))
    
    if model:
        query = query.filter(Printer.model.ilike(f"%{model}%"))
    
    if location:
        query = query.filter(
            or_(
                Printer.location.ilike(f"%{location}%"),
                Printer.sector.ilike(f"%{location}%"),
                Printer.building.ilike(f"%{location}%"),
                Printer.floor.ilike(f"%{location}%")
            )
        )
    
    if department:
        query = query.filter(Printer.department.ilike(f"%{department}%"))
    
    # Solo impresoras activas
    query = query.filter(Printer.status == "active")
    
    printers = query.limit(50).all()  # Límite para evitar resultados muy grandes
    
    return [PrinterSearchResult.from_orm(printer) for printer in printers]

@router.get("/printers/{printer_id}/toner-history", response_model=List[TonerRequestResponse])
def get_printer_toner_history(printer_id: int, db: Session = Depends(get_db)):
    """Obtener historial de pedidos de tóner para una impresora específica"""
    
    # Verificar que la impresora existe
    printer = db.query(Printer).filter(Printer.id == printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    requests = db.query(TonerRequest).filter(
        TonerRequest.printer_id == printer_id
    ).order_by(TonerRequest.created_at.desc()).all()
    
    result = []
    for req in requests:
        response_data = TonerRequestResponse.from_orm(req)
        response_data.printer_brand = printer.brand
        response_data.printer_model = printer.model
        response_data.printer_serial_number = printer.serial_number
        response_data.printer_asset_tag = printer.asset_tag
        response_data.printer_location = printer.location
        result.append(response_data)
    
    return result