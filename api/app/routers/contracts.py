from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..db import get_db
from ..models import LeaseContract, ContractPrinter, Printer

router = APIRouter()

class ContractPrinterCreate(BaseModel):
    printer_id: int
    device_type: str  # printer_bw, printer_color, multifunction
    monthly_included_copies_bw: int = 0
    monthly_included_copies_color: int = 0
    overage_cost_bw: float = 0
    overage_cost_color: float = 0
    installation_date: Optional[datetime] = None

class ContractPrinterResponse(BaseModel):
    id: int
    printer_id: int
    device_type: str
    monthly_included_copies_bw: int
    monthly_included_copies_color: int
    overage_cost_bw: float
    overage_cost_color: float
    installation_date: Optional[datetime]
    removal_date: Optional[datetime]
    is_active: bool
    printer: dict  # Will contain printer details
    
    class Config:
        from_attributes = True

class LeaseContractCreate(BaseModel):
    # Información básica del contrato
    contract_number: str
    contract_name: str
    supplier: str
    
    # Tipo de contrato
    contract_type: str  # cost_per_copy, fixed_cost_per_quantity, monthly_fixed, annual_fixed
    
    # Detalles de costos
    cost_bw_per_copy: float = 0
    cost_color_per_copy: float = 0
    fixed_monthly_cost: float = 0
    fixed_annual_cost: float = 0
    included_copies_bw: int = 0
    included_copies_color: int = 0
    
    # Detalles de equipos
    total_printers: int = 0
    printers_bw_only: int = 0
    printers_color: int = 0
    multifunction_devices: int = 0
    
    # Fechas del contrato
    start_date: datetime
    end_date: datetime
    renewal_date: Optional[datetime] = None
    
    # Estado y condiciones
    status: str = "active"
    auto_renewal: bool = False
    renewal_notice_days: int = 30
    
    # Información de contacto
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    
    # Información administrativa
    department: Optional[str] = None
    cost_center: Optional[str] = None
    budget_code: Optional[str] = None
    
    # Observaciones y notas
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None

class LeaseContractResponse(BaseModel):
    id: int
    contract_number: str
    contract_name: str
    supplier: str
    contract_type: str
    cost_bw_per_copy: float
    cost_color_per_copy: float
    fixed_monthly_cost: float
    fixed_annual_cost: float
    included_copies_bw: int
    included_copies_color: int
    total_printers: int
    printers_bw_only: int
    printers_color: int
    multifunction_devices: int
    start_date: datetime
    end_date: datetime
    renewal_date: Optional[datetime]
    status: str
    auto_renewal: bool
    renewal_notice_days: int
    contact_person: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    department: Optional[str]
    cost_center: Optional[str]
    budget_code: Optional[str]
    terms_and_conditions: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    contract_printers: List[ContractPrinterResponse] = []
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[LeaseContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    """Listar todos los contratos de arrendamiento"""
    contracts = db.query(LeaseContract).all()
    
    # Enriquecer con información de impresoras
    for contract in contracts:
        for contract_printer in contract.contract_printers:
            if contract_printer.printer:
                contract_printer.printer = {
                    "id": contract_printer.printer.id,
                    "brand": contract_printer.printer.brand,
                    "model": contract_printer.printer.model,
                    "asset_tag": contract_printer.printer.asset_tag,
                    "location": contract_printer.printer.location,
                    "is_color": contract_printer.printer.is_color
                }
    
    return contracts

@router.post("/", response_model=LeaseContractResponse)
def create_contract(contract: LeaseContractCreate, db: Session = Depends(get_db)):
    """Crear un nuevo contrato de arrendamiento"""
    
    # Verificar que no exista un contrato con el mismo número
    existing_contract = db.query(LeaseContract).filter(
        LeaseContract.contract_number == contract.contract_number
    ).first()
    
    if existing_contract:
        raise HTTPException(
            status_code=400, 
            detail="Ya existe un contrato con este número"
        )
    
    db_contract = LeaseContract(**contract.dict())
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    
    return db_contract

@router.get("/{contract_id}", response_model=LeaseContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    """Obtener un contrato específico"""
    contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    
    # Enriquecer con información de impresoras
    for contract_printer in contract.contract_printers:
        if contract_printer.printer:
            contract_printer.printer = {
                "id": contract_printer.printer.id,
                "brand": contract_printer.printer.brand,
                "model": contract_printer.printer.model,
                "asset_tag": contract_printer.printer.asset_tag,
                "location": contract_printer.printer.location,
                "is_color": contract_printer.printer.is_color
            }
    
    return contract

@router.put("/{contract_id}", response_model=LeaseContractResponse)
def update_contract(contract_id: int, contract_update: LeaseContractCreate, db: Session = Depends(get_db)):
    """Actualizar un contrato de arrendamiento"""
    contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    
    # Verificar que no exista otro contrato con el mismo número
    if contract_update.contract_number != contract.contract_number:
        existing_contract = db.query(LeaseContract).filter(
            LeaseContract.contract_number == contract_update.contract_number,
            LeaseContract.id != contract_id
        ).first()
        
        if existing_contract:
            raise HTTPException(
                status_code=400, 
                detail="Ya existe otro contrato con este número"
            )
    
    for field, value in contract_update.dict().items():
        setattr(contract, field, value)
    
    db.commit()
    db.refresh(contract)
    return contract

@router.delete("/{contract_id}")
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    """Eliminar un contrato de arrendamiento"""
    contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    
    # Verificar si hay impresoras asignadas
    contract_printers_count = db.query(ContractPrinter).filter(
        ContractPrinter.contract_id == contract_id,
        ContractPrinter.is_active == True
    ).count()
    
    if contract_printers_count > 0:
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar el contrato porque tiene impresoras asignadas. Primero remueva todas las impresoras del contrato."
        )
    
    # Eliminar registros de impresoras del contrato (inactivas)
    db.query(ContractPrinter).filter(ContractPrinter.contract_id == contract_id).delete()
    
    # Eliminar el contrato
    db.delete(contract)
    db.commit()
    
    return {"message": "Contrato eliminado exitosamente"}

@router.post("/{contract_id}/printers", response_model=ContractPrinterResponse)
def add_printer_to_contract(
    contract_id: int, 
    printer_data: ContractPrinterCreate, 
    db: Session = Depends(get_db)
):
    """Agregar una impresora a un contrato"""
    
    # Verificar que el contrato existe
    contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    
    # Verificar que la impresora existe
    printer = db.query(Printer).filter(Printer.id == printer_data.printer_id).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Impresora no encontrada")
    
    # Verificar que la impresora no esté ya asignada a este contrato
    existing_assignment = db.query(ContractPrinter).filter(
        ContractPrinter.contract_id == contract_id,
        ContractPrinter.printer_id == printer_data.printer_id,
        ContractPrinter.is_active == True
    ).first()
    
    if existing_assignment:
        raise HTTPException(
            status_code=400, 
            detail="Esta impresora ya está asignada a este contrato"
        )
    
    # Crear la asignación
    contract_printer = ContractPrinter(
        contract_id=contract_id,
        **printer_data.dict()
    )
    
    db.add(contract_printer)
    db.commit()
    db.refresh(contract_printer)
    
    # Enriquecer con información de la impresora
    contract_printer.printer = {
        "id": printer.id,
        "brand": printer.brand,
        "model": printer.model,
        "asset_tag": printer.asset_tag,
        "location": printer.location,
        "is_color": printer.is_color
    }
    
    return contract_printer

@router.delete("/{contract_id}/printers/{printer_id}")
def remove_printer_from_contract(contract_id: int, printer_id: int, db: Session = Depends(get_db)):
    """Remover una impresora de un contrato"""
    
    contract_printer = db.query(ContractPrinter).filter(
        ContractPrinter.contract_id == contract_id,
        ContractPrinter.printer_id == printer_id,
        ContractPrinter.is_active == True
    ).first()
    
    if not contract_printer:
        raise HTTPException(
            status_code=404, 
            detail="Esta impresora no está asignada a este contrato"
        )
    
    # Marcar como inactiva en lugar de eliminar
    contract_printer.is_active = False
    contract_printer.removal_date = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Impresora removida del contrato exitosamente"}

@router.get("/stats/summary")
def get_contracts_stats(db: Session = Depends(get_db)):
    """Obtener estadísticas generales de contratos"""
    from sqlalchemy import func
    
    total_contracts = db.query(LeaseContract).count()
    
    # Contratos por estado
    status_stats = db.query(
        LeaseContract.status,
        func.count(LeaseContract.id).label('count')
    ).group_by(LeaseContract.status).all()
    
    # Contratos por tipo
    type_stats = db.query(
        LeaseContract.contract_type,
        func.count(LeaseContract.id).label('count')
    ).group_by(LeaseContract.contract_type).all()
    
    # Contratos que expiran pronto (próximos 30 días)
    from datetime import datetime, timedelta
    future_date = datetime.utcnow() + timedelta(days=30)
    expiring_contracts = db.query(LeaseContract).filter(
        LeaseContract.end_date.between(datetime.utcnow(), future_date),
        LeaseContract.status == 'active'
    ).count()
    
    # Total de equipos en contratos
    total_equipment = db.query(func.sum(LeaseContract.total_printers)).scalar() or 0
    
    return {
        "total_contracts": total_contracts,
        "status_distribution": [{"status": row.status, "count": row.count} for row in status_stats],
        "type_distribution": [{"type": row.contract_type, "count": row.count} for row in type_stats],
        "contracts_expiring_soon": expiring_contracts,
        "total_equipment": total_equipment
    }

@router.get("/search")
def search_contracts(
    query: Optional[str] = None,
    status: Optional[str] = None,
    contract_type: Optional[str] = None,
    supplier: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Buscar contratos con múltiples filtros"""
    contracts_query = db.query(LeaseContract)
    
    if query:
        contracts_query = contracts_query.filter(
            (LeaseContract.contract_number.ilike(f"%{query}%")) |
            (LeaseContract.contract_name.ilike(f"%{query}%")) |
            (LeaseContract.supplier.ilike(f"%{query}%"))
        )
    
    if status:
        contracts_query = contracts_query.filter(LeaseContract.status == status)
    
    if contract_type:
        contracts_query = contracts_query.filter(LeaseContract.contract_type == contract_type)
    
    if supplier:
        contracts_query = contracts_query.filter(LeaseContract.supplier.ilike(f"%{supplier}%"))
    
    contracts = contracts_query.all()
    
    # Enriquecer con información de impresoras
    for contract in contracts:
        for contract_printer in contract.contract_printers:
            if contract_printer.printer:
                contract_printer.printer = {
                    "id": contract_printer.printer.id,
                    "brand": contract_printer.printer.brand,
                    "model": contract_printer.printer.model,
                    "asset_tag": contract_printer.printer.asset_tag,
                    "location": contract_printer.printer.location,
                    "is_color": contract_printer.printer.is_color
                }
    
    return contracts