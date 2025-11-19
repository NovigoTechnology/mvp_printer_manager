from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..db import get_db
from ..models import LeaseContract, ContractPrinter, Printer, Company, ContractCompany
from ..services.exchange_rate_service import get_current_exchange_rate, get_current_exchange_rate_with_info

router = APIRouter()

def generate_contract_number(db: Session) -> str:
    """Generar número de contrato secuencial único"""
    from datetime import datetime
    import time
    
    current_year = datetime.now().year
    max_attempts = 10
    
    for attempt in range(max_attempts):
        # Buscar el último número de contrato del año actual
        last_contract = db.query(LeaseContract).filter(
            LeaseContract.contract_number.like(f"CONT-{current_year}-%")
        ).order_by(LeaseContract.contract_number.desc()).first()
        
        if last_contract:
            # Extraer el número secuencial del último contrato
            parts = last_contract.contract_number.split('-')
            if len(parts) == 3 and parts[2].isdigit():
                next_number = int(parts[2]) + 1
            else:
                next_number = 1
        else:
            next_number = 1
        
        # Formato: CONT-YYYY-XXX (con padding de 3 dígitos)
        candidate_number = f"CONT-{current_year}-{next_number:03d}"
        
        # Verificar que el número no exista ya
        existing = db.query(LeaseContract).filter(
            LeaseContract.contract_number == candidate_number
        ).first()
        
        if not existing:
            return candidate_number
        
        # Si existe, esperar un poco y reintentar
        time.sleep(0.1)
    
    # Si después de varios intentos no se puede generar un número único
    # agregar timestamp como fallback
    timestamp = int(time.time())
    return f"CONT-{current_year}-{next_number:03d}-{timestamp}"

# Company schemas
class CompanyCreate(BaseModel):
    name: str
    legal_name: Optional[str] = None
    tax_id: str
    business_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "Argentina"
    contact_person: Optional[str] = None
    contact_position: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    size: str = "medium"
    annual_revenue: Optional[float] = None
    employee_count: Optional[int] = None
    status: str = "active"
    priority: str = "medium"
    credit_rating: Optional[str] = None
    payment_terms: str = "30 days"
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    tags: Optional[str] = None

class CompanyResponse(BaseModel):
    id: int
    name: str
    legal_name: Optional[str]
    tax_id: str
    business_type: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postal_code: Optional[str]
    country: Optional[str]
    contact_person: Optional[str]
    contact_position: Optional[str]
    phone: Optional[str]
    mobile: Optional[str]
    email: Optional[str]
    website: Optional[str]
    industry: Optional[str]
    size: Optional[str]
    annual_revenue: Optional[float]
    employee_count: Optional[int]
    status: Optional[str]
    priority: Optional[str]
    credit_rating: Optional[str]
    payment_terms: Optional[str]
    notes: Optional[str]
    internal_notes: Optional[str]
    tags: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class ContractCompanyCreate(BaseModel):
    company_id: int
    role: str = "client"  # client, partner, supplier, guarantor
    participation_percentage: float = 100.0
    is_primary: bool = False
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None

class ContractCompanyResponse(BaseModel):
    id: int
    company_id: int
    role: str
    participation_percentage: float
    is_primary: bool
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    is_active: bool
    notes: Optional[str]
    company: Optional[CompanyResponse] = None  # Will contain company details
    
    class Config:
        from_attributes = True

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
    printer: Optional[dict] = None  # Will contain printer details
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_printer(cls, contract_printer):
        """Create response with printer details properly serialized"""
        data = {
            "id": contract_printer.id,
            "printer_id": contract_printer.printer_id,
            "device_type": contract_printer.device_type,
            "monthly_included_copies_bw": contract_printer.monthly_included_copies_bw,
            "monthly_included_copies_color": contract_printer.monthly_included_copies_color,
            "overage_cost_bw": contract_printer.overage_cost_bw,
            "overage_cost_color": contract_printer.overage_cost_color,
            "installation_date": contract_printer.installation_date,
            "removal_date": contract_printer.removal_date,
            "is_active": contract_printer.is_active,
        }
        
        if contract_printer.printer:
            data["printer"] = {
                "id": contract_printer.printer.id,
                "brand": contract_printer.printer.brand,
                "model": contract_printer.printer.model,
                "asset_tag": contract_printer.printer.asset_tag,
                "location": contract_printer.printer.location,
                "ip": contract_printer.printer.ip,
                "is_color": contract_printer.printer.is_color,
                "printer_type": contract_printer.printer.printer_type
            }
        
        return cls(**data)

class LeaseContractCreate(BaseModel):
    # Información básica del contrato
    contract_number: Optional[str] = None  # Será generado automáticamente si no se proporciona
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
    
    # Costos de páginas excedentes (cuando hay límite de copias incluidas)
    overage_cost_bw: float = 0
    overage_cost_color: float = 0
    
    # Soporte multimoneda
    currency: str = "ARS"  # ARS (Pesos Argentinos) o USD (Dólares)
    exchange_rate: float = 1.0  # Tasa de cambio al momento del contrato
    
    # Costos en moneda alternativa (para conversión)
    cost_bw_per_copy_usd: float = 0
    cost_color_per_copy_usd: float = 0
    fixed_monthly_cost_usd: float = 0
    fixed_annual_cost_usd: float = 0
    overage_cost_bw_usd: float = 0
    overage_cost_color_usd: float = 0
    
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
    contact_position: Optional[str] = None
    
    # Información administrativa
    priority: str = "medium"
    department: Optional[str] = None
    cost_center: Optional[str] = None
    budget_code: Optional[str] = None
    
    # Observaciones y notas
    internal_notes: Optional[str] = None
    special_conditions: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    notes: Optional[str] = None
    
    # Impresoras asignadas al contrato
    printer_ids: List[int] = []
    
    # Empresas asociadas al contrato
    companies: List[ContractCompanyCreate] = []

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
    overage_cost_bw: float
    overage_cost_color: float
    
    # Soporte multimoneda
    currency: str
    exchange_rate: float
    cost_bw_per_copy_usd: float
    cost_color_per_copy_usd: float
    fixed_monthly_cost_usd: float
    fixed_annual_cost_usd: float
    overage_cost_bw_usd: float
    overage_cost_color_usd: float
    
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
    contact_position: Optional[str]
    priority: Optional[str]
    department: Optional[str]
    cost_center: Optional[str]
    budget_code: Optional[str]
    internal_notes: Optional[str]
    special_conditions: Optional[str]
    terms_and_conditions: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    contract_printers: List[ContractPrinterResponse] = []
    contract_companies: List[ContractCompanyResponse] = []
    
    class Config:
        from_attributes = True

@router.get("/exchange-rates")
def get_exchange_rates():
    """Obtener tasas de cambio actuales con información de fecha y hora"""
    # Usar el servicio de exchange rate directamente (sin filtros de moneda erróneos)
    from ..services.exchange_rate_service import ExchangeRateService
    
    try:
        service = ExchangeRateService()
        
        # Obtener la tasa más reciente disponible sin importar las monedas
        from ..db import get_db_session
        from ..models import ExchangeRate
        from sqlalchemy import desc
        
        session = get_db_session()
        try:
            latest_rate = session.query(ExchangeRate).filter(
                ExchangeRate.is_active == True
            ).order_by(
                desc(ExchangeRate.date),
                desc(ExchangeRate.created_at)
            ).first()
            
            if latest_rate and latest_rate.rate > 0:
                # Si la tasa es mayor a 1, es USD->ARS (1445)
                if latest_rate.rate > 1:
                    usd_to_ars = latest_rate.rate
                    ars_to_usd = 1 / latest_rate.rate
                else:
                    # Si la tasa es menor a 1, es ARS->USD (0.0007)
                    ars_to_usd = latest_rate.rate
                    usd_to_ars = 1 / latest_rate.rate
                
                return {
                    # Nombres descriptivos principales  
                    "dolar_venta": ars_to_usd,
                    "dolar_compra": usd_to_ars,
                    
                    # Mantener compatibilidad
                    "ARS_to_USD": ars_to_usd,
                    "USD_to_ARS": usd_to_ars,
                    
                    # Información de fecha y hora
                    "last_updated": latest_rate.updated_at.isoformat() if latest_rate.updated_at else latest_rate.created_at.isoformat(),
                    "rate_date": latest_rate.date.isoformat() if latest_rate.date else None,
                    "source": latest_rate.source or "database"
                }
        finally:
            session.close()
            
    except Exception as e:
        print(f"Error getting exchange rate: {e}")
    
    # Fallback a valores por defecto
    return {
        "dolar_venta": 0.0011,
        "dolar_compra": 900.0,
        "ARS_to_USD": 0.0011, 
        "USD_to_ARS": 900.0,
        "last_updated": datetime.utcnow().isoformat(),
        "rate_date": None,
        "source": "default"
    }
    
    return {
        # Nombres descriptivos principales  
        "dolar_venta": ars_to_usd,       # Venta de dólares: cuántos USD obtienes por 1 ARS
        "dolar_compra": usd_to_ars,      # Compra de dólares: cuántos ARS necesitas por 1 USD
        
        # Mantener compatibilidad
        "ARS_to_USD": ars_to_usd,
        "USD_to_ARS": usd_to_ars,
        
        # Información de fecha y hora
        "last_updated": last_updated,
        "rate_date": date_from_db,
        "source": source
    }

@router.get("/next-contract-number")
def get_next_contract_number(db: Session = Depends(get_db)):
    """Obtener el próximo número de contrato disponible"""
    next_number = generate_contract_number(db)
    return {"contract_number": next_number}

@router.get("/", response_model=List[LeaseContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    """Listar todos los contratos de arrendamiento"""
    contracts = db.query(LeaseContract).all()
    
    # Construir respuestas manualmente para evitar problemas de serialización
    response_contracts = []
    for contract in contracts:
        response_data = LeaseContractResponse(
            id=contract.id,
            contract_number=contract.contract_number,
            contract_name=contract.contract_name,
            supplier=contract.supplier,
            contract_type=contract.contract_type,
            cost_bw_per_copy=contract.cost_bw_per_copy,
            cost_color_per_copy=contract.cost_color_per_copy,
            fixed_monthly_cost=contract.fixed_monthly_cost,
            fixed_annual_cost=contract.fixed_annual_cost,
            included_copies_bw=contract.included_copies_bw,
            included_copies_color=contract.included_copies_color,
            currency=contract.currency,
            exchange_rate=contract.exchange_rate,
            overage_cost_bw=getattr(contract, 'overage_cost_bw', 0.0),
            overage_cost_color=getattr(contract, 'overage_cost_color', 0.0),
            cost_bw_per_copy_usd=contract.cost_bw_per_copy_usd,
            cost_color_per_copy_usd=contract.cost_color_per_copy_usd,
            fixed_monthly_cost_usd=contract.fixed_monthly_cost_usd,
            fixed_annual_cost_usd=contract.fixed_annual_cost_usd,
            overage_cost_bw_usd=getattr(contract, 'overage_cost_bw_usd', 0.0),
            overage_cost_color_usd=getattr(contract, 'overage_cost_color_usd', 0.0),
            total_printers=contract.total_printers,
            printers_bw_only=contract.printers_bw_only,
            printers_color=contract.printers_color,
            multifunction_devices=contract.multifunction_devices,
            start_date=contract.start_date,
            end_date=contract.end_date,
            renewal_date=contract.renewal_date,
            status=contract.status,
            auto_renewal=contract.auto_renewal,
            renewal_notice_days=contract.renewal_notice_days,
            contact_person=contract.contact_person,
            contact_email=contract.contact_email,
            contact_phone=contract.contact_phone,
            contact_position=contract.contact_position,
            priority=contract.priority,
            department=contract.department,
            cost_center=contract.cost_center,
            budget_code=contract.budget_code,
            internal_notes=contract.internal_notes,
            special_conditions=contract.special_conditions,
            terms_and_conditions=contract.terms_and_conditions,
            notes=contract.notes,
            created_at=contract.created_at,
            updated_at=contract.updated_at,
            contract_printers=[
                ContractPrinterResponse.from_orm_with_printer(cp) 
                for cp in contract.contract_printers
            ],
            contract_companies=[
                ContractCompanyResponse(
                    id=cc.id,
                    company_id=cc.company_id,
                    role=cc.role,
                    participation_percentage=cc.participation_percentage,
                    is_primary=cc.is_primary,
                    start_date=cc.start_date,
                    end_date=cc.end_date,
                    is_active=cc.is_active,
                    notes=cc.notes,
                    company=CompanyResponse.from_orm(cc.company) if cc.company else None
                )
                for cc in contract.contract_companies
            ]
        )
        response_contracts.append(response_data)
    
    return response_contracts

@router.post("/", response_model=LeaseContractResponse)
def create_contract(contract: LeaseContractCreate, db: Session = Depends(get_db)):
    """Crear un nuevo contrato de arrendamiento"""
    
    # Generar número de contrato automáticamente si no se proporciona
    if not contract.contract_number:
        contract.contract_number = generate_contract_number(db)
    
    # Verificar que no exista un contrato con el mismo número
    existing_contract = db.query(LeaseContract).filter(
        LeaseContract.contract_number == contract.contract_number
    ).first()
    
    if existing_contract:
        raise HTTPException(
            status_code=400, 
            detail="Ya existe un contrato con este número"
        )
    
    # Verificar que las impresoras seleccionadas no estén ya asignadas a otros contratos
    if contract.printer_ids:
        already_assigned = db.query(ContractPrinter.printer_id).filter(
            ContractPrinter.printer_id.in_(contract.printer_ids),
            ContractPrinter.is_active == True
        ).all()
        
        if already_assigned:
            assigned_ids = [row[0] for row in already_assigned]
            raise HTTPException(
                status_code=400,
                detail=f"Las siguientes impresoras ya están asignadas a otros contratos: {assigned_ids}"
            )
    
    # Crear el contrato (sin printer_ids y companies en el dict)
    contract_dict = contract.dict()
    printer_ids = contract_dict.pop('printer_ids', [])
    companies = contract_dict.pop('companies', [])
    
    db_contract = LeaseContract(**contract_dict)
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    
    # Asignar impresoras al contrato
    if printer_ids:
        for printer_id in printer_ids:
            # Verificar que la impresora existe
            printer = db.query(Printer).filter(Printer.id == printer_id).first()
            if not printer:
                # Si una impresora no existe, hacer rollback y reportar error
                db.rollback()
                raise HTTPException(
                    status_code=404,
                    detail=f"Impresora con ID {printer_id} no encontrada"
                )
            
            # Crear asignación de impresora al contrato
            contract_printer = ContractPrinter(
                contract_id=db_contract.id,
                printer_id=printer_id,
                device_type="printer_bw" if not printer.is_color else "printer_color",
                monthly_included_copies_bw=0,
                monthly_included_copies_color=0,
                overage_cost_bw=0.0,
                overage_cost_color=0.0,
                installation_date=datetime.utcnow(),
                is_active=True
            )
            db.add(contract_printer)
        
        db.commit()
    
    # Asignar empresas al contrato
    if companies:
        for company_data in companies:
            # Si company_data es un diccionario, convertirlo a ContractCompanyCreate
            if isinstance(company_data, dict):
                company_data = ContractCompanyCreate(**company_data)
            
            # Verificar que la empresa existe
            company = db.query(Company).filter(Company.id == company_data.company_id).first()
            if not company:
                # Si una empresa no existe, hacer rollback y reportar error
                db.rollback()
                raise HTTPException(
                    status_code=404,
                    detail=f"Empresa con ID {company_data.company_id} no encontrada"
                )
            
            # Crear asignación de empresa al contrato
            contract_company = ContractCompany(
                contract_id=db_contract.id,
                company_id=company_data.company_id,
                role=company_data.role,
                participation_percentage=company_data.participation_percentage,
                is_primary=company_data.is_primary,
                start_date=company_data.start_date,
                end_date=company_data.end_date,
                notes=company_data.notes,
                is_active=True
            )
            db.add(contract_company)
        
        db.commit()
    
    # Refrescar el contrato
    db.refresh(db_contract)
    
    # Construir respuesta manual para evitar problemas de serialización
    response_data = LeaseContractResponse(
        id=db_contract.id,
        contract_number=db_contract.contract_number,
        contract_name=db_contract.contract_name,
        supplier=db_contract.supplier,
        contract_type=db_contract.contract_type,
        cost_bw_per_copy=db_contract.cost_bw_per_copy,
        cost_color_per_copy=db_contract.cost_color_per_copy,
        fixed_monthly_cost=db_contract.fixed_monthly_cost,
        fixed_annual_cost=db_contract.fixed_annual_cost,
        included_copies_bw=db_contract.included_copies_bw,
        included_copies_color=db_contract.included_copies_color,
        currency=db_contract.currency,
        exchange_rate=db_contract.exchange_rate,
        overage_cost_bw=getattr(db_contract, 'overage_cost_bw', 0.0),
        overage_cost_color=getattr(db_contract, 'overage_cost_color', 0.0),
        cost_bw_per_copy_usd=db_contract.cost_bw_per_copy_usd,
        cost_color_per_copy_usd=db_contract.cost_color_per_copy_usd,
        fixed_monthly_cost_usd=db_contract.fixed_monthly_cost_usd,
        fixed_annual_cost_usd=db_contract.fixed_annual_cost_usd,
        overage_cost_bw_usd=getattr(db_contract, 'overage_cost_bw_usd', 0.0),
        overage_cost_color_usd=getattr(db_contract, 'overage_cost_color_usd', 0.0),
        total_printers=db_contract.total_printers,
        printers_bw_only=db_contract.printers_bw_only,
        printers_color=db_contract.printers_color,
        multifunction_devices=db_contract.multifunction_devices,
        start_date=db_contract.start_date,
        end_date=db_contract.end_date,
        renewal_date=db_contract.renewal_date,
        status=db_contract.status,
        auto_renewal=db_contract.auto_renewal,
        renewal_notice_days=db_contract.renewal_notice_days,
        contact_person=db_contract.contact_person,
        contact_email=db_contract.contact_email,
        contact_phone=db_contract.contact_phone,
        contact_position=db_contract.contact_position,
        priority=db_contract.priority,
        department=db_contract.department,
        cost_center=db_contract.cost_center,
        budget_code=db_contract.budget_code,
        internal_notes=db_contract.internal_notes,
        special_conditions=db_contract.special_conditions,
        terms_and_conditions=db_contract.terms_and_conditions,
        notes=db_contract.notes,
        created_at=db_contract.created_at,
        updated_at=db_contract.updated_at,
        contract_printers=[
            ContractPrinterResponse.from_orm_with_printer(cp) 
            for cp in db_contract.contract_printers
        ],
        contract_companies=[
            ContractCompanyResponse(
                id=cc.id,
                company_id=cc.company_id,
                role=cc.role,
                participation_percentage=cc.participation_percentage,
                is_primary=cc.is_primary,
                start_date=cc.start_date,
                end_date=cc.end_date,
                is_active=cc.is_active,
                notes=cc.notes,
                company=CompanyResponse.from_orm(cc.company) if cc.company else None
            )
            for cc in db_contract.contract_companies
        ]
    )
    
    return response_data

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

@router.get("/{contract_id}/printers", response_model=List[ContractPrinterResponse])
def get_contract_printers(contract_id: int, db: Session = Depends(get_db)):
    """Obtener todas las impresoras asociadas a un contrato con información completa"""
    contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    
    contract_printers = []
    for contract_printer in contract.contract_printers:
        if contract_printer.is_active:  # Solo mostrar las activas
            printer_data = ContractPrinterResponse.from_orm_with_printer(contract_printer)
            contract_printers.append(printer_data)
    
    return contract_printers

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
    
    # Construir respuesta manual para evitar problemas de serialización
    response_data = LeaseContractResponse(
        id=contract.id,
        contract_number=contract.contract_number,
        contract_name=contract.contract_name,
        supplier=contract.supplier,
        contract_type=contract.contract_type,
        cost_bw_per_copy=contract.cost_bw_per_copy,
        cost_color_per_copy=contract.cost_color_per_copy,
        fixed_monthly_cost=contract.fixed_monthly_cost,
        fixed_annual_cost=contract.fixed_annual_cost,
        included_copies_bw=contract.included_copies_bw,
        included_copies_color=contract.included_copies_color,
        currency=contract.currency,
        exchange_rate=contract.exchange_rate,
        overage_cost_bw=getattr(contract, 'overage_cost_bw', 0.0),
        overage_cost_color=getattr(contract, 'overage_cost_color', 0.0),
        cost_bw_per_copy_usd=contract.cost_bw_per_copy_usd,
        cost_color_per_copy_usd=contract.cost_color_per_copy_usd,
        fixed_monthly_cost_usd=contract.fixed_monthly_cost_usd,
        fixed_annual_cost_usd=contract.fixed_annual_cost_usd,
        overage_cost_bw_usd=getattr(contract, 'overage_cost_bw_usd', 0.0),
        overage_cost_color_usd=getattr(contract, 'overage_cost_color_usd', 0.0),
        total_printers=contract.total_printers,
        printers_bw_only=contract.printers_bw_only,
        printers_color=contract.printers_color,
        multifunction_devices=contract.multifunction_devices,
        start_date=contract.start_date,
        end_date=contract.end_date,
        renewal_date=contract.renewal_date,
        status=contract.status,
        auto_renewal=contract.auto_renewal,
        renewal_notice_days=contract.renewal_notice_days,
        contact_person=contract.contact_person,
        contact_email=contract.contact_email,
        contact_phone=contract.contact_phone,
        contact_position=contract.contact_position,
        priority=contract.priority,
        department=contract.department,
        cost_center=contract.cost_center,
        budget_code=contract.budget_code,
        internal_notes=contract.internal_notes,
        special_conditions=contract.special_conditions,
        terms_and_conditions=contract.terms_and_conditions,
        notes=contract.notes,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
        contract_printers=[
            ContractPrinterResponse.from_orm_with_printer(cp) 
            for cp in contract.contract_printers
        ],
        contract_companies=[
            ContractCompanyResponse(
                id=cc.id,
                company_id=cc.company_id,
                role=cc.role,
                participation_percentage=cc.participation_percentage,
                is_primary=cc.is_primary,
                start_date=cc.start_date,
                end_date=cc.end_date,
                is_active=cc.is_active,
                notes=cc.notes,
                company=CompanyResponse.from_orm(cc.company) if cc.company else None
            )
            for cc in contract.contract_companies
        ]
    )
    
    return response_data

@router.delete("/{contract_id}")
def delete_contract(contract_id: int, force: bool = False, db: Session = Depends(get_db)):
    """Eliminar un contrato de arrendamiento"""
    contract = db.query(LeaseContract).filter(LeaseContract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    
    # Verificar si hay impresoras asignadas activamente
    active_contract_printers = db.query(ContractPrinter).filter(
        ContractPrinter.contract_id == contract_id,
        ContractPrinter.is_active == True
    ).all()
    
    if active_contract_printers and not force:
        # Obtener información detallada de las impresoras para el mensaje
        printer_info = []
        for cp in active_contract_printers:
            printer = db.query(Printer).filter(Printer.id == cp.printer_id).first()
            if printer:
                printer_info.append(f"{printer.brand} {printer.model} ({printer.asset_tag})")
        
        printer_list = ", ".join(printer_info) if printer_info else "impresoras registradas"
        
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede eliminar el contrato porque tiene impresoras asignadas: {printer_list}. Use el parámetro 'force=true' para forzar la eliminación o remueva las impresoras manualmente."
        )
    
    # Si force=true o no hay impresoras activas, proceder con la eliminación
    # Marcar todas las impresoras del contrato como inactivas antes de eliminar
    db.query(ContractPrinter).filter(
        ContractPrinter.contract_id == contract_id
    ).update({
        "is_active": False,
        "removal_date": func.now()
    })
    
    # Eliminar todos los registros de ContractPrinter para este contrato
    db.query(ContractPrinter).filter(ContractPrinter.contract_id == contract_id).delete()
    
    # Eliminar el contrato
    db.delete(contract)
    db.commit()
    
    message = "Contrato eliminado exitosamente"
    if active_contract_printers:
        message += f" junto con {len(active_contract_printers)} impresora(s) asignada(s)"
    
    return {"message": message}

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
    
    # Cargar la relación printer explícitamente
    contract_printer_with_printer = db.query(ContractPrinter).options(
        joinedload(ContractPrinter.printer)
    ).filter(ContractPrinter.id == contract_printer.id).first()
    
    # Devolver la respuesta usando el método correcto
    return ContractPrinterResponse.from_orm_with_printer(contract_printer_with_printer)

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

@router.delete("/cleanup/all")
def cleanup_all_contracts(confirm: bool = False, db: Session = Depends(get_db)):
    """Limpiar completamente la tabla de contratos
    
    ADVERTENCIA: Esta operación eliminará TODOS los contratos y sus relaciones.
    Use con extrema precaución. Requiere confirm=true para ejecutarse.
    """
    if not confirm:
        return {
            "message": "Para confirmar la limpieza completa de contratos, use: DELETE /contracts/cleanup/all?confirm=true",
            "warning": "Esta operación eliminará TODOS los contratos y sus impresoras asignadas. Esta acción NO se puede deshacer.",
            "contracts_count": db.query(LeaseContract).count(),
            "contract_printers_count": db.query(ContractPrinter).count()
        }
    
    try:
        # 1. Contar registros antes de la limpieza
        contracts_count = db.query(LeaseContract).count()
        contract_printers_count = db.query(ContractPrinter).count()
        contract_companies_count = db.query(ContractCompany).count()
        
        # 2. Eliminar todas las relaciones de impresoras con contratos
        deleted_contract_printers = db.query(ContractPrinter).delete()
        
        # 3. Eliminar todas las relaciones de empresas con contratos
        deleted_contract_companies = db.query(ContractCompany).delete()
        
        # 4. Eliminar todos los contratos
        deleted_contracts = db.query(LeaseContract).delete()
        
        # 5. Confirmar cambios
        db.commit()
        
        return {
            "message": "Limpieza de contratos completada exitosamente",
            "summary": {
                "contracts_deleted": deleted_contracts,
                "contract_printers_deleted": deleted_contract_printers,
                "contract_companies_deleted": deleted_contract_companies,
                "total_records_deleted": deleted_contracts + deleted_contract_printers + deleted_contract_companies
            },
            "before_cleanup": {
                "contracts": contracts_count,
                "contract_printers": contract_printers_count,
                "contract_companies": contract_companies_count
            },
            "warning": "Todos los contratos y sus relaciones han sido eliminados permanentemente"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error durante la limpieza de contratos: {str(e)}"
        )